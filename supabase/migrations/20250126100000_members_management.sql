-- Módulo 2.2: Gestión de miembros — RPC change_user_role, remove_from_org
-- Requiere: user_is_org_admin(oid), user_is_superadmin(), set_updated_at()

-- 1) Trigger updated_at en memberships (si no existe)
drop trigger if exists memberships_updated_at on public.memberships;
create trigger memberships_updated_at
  before update on public.memberships
  for each row execute function public.set_updated_at();

-- 2) RPC: change_user_role(org_id, user_id, new_role)
-- Solo org_admin o superadmin. new_role: org_admin | team_manager | user | viewer (no superadmin).
-- No se puede bajar de rol al último org_admin/superadmin de la org.
create or replace function public.change_user_role(
  p_org_id uuid,
  p_user_id uuid,
  p_new_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_m record;
  v_admin_count int;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if not (public.user_is_org_admin(p_org_id) or public.user_is_superadmin()) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if p_new_role is null or p_new_role not in ('org_admin','team_manager','user','viewer') then
    return jsonb_build_object('ok', false, 'error', 'invalid_role');
  end if;

  select * into v_m from public.memberships
  where org_id = p_org_id and user_id = p_user_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'membership_not_found');
  end if;

  if v_m.role = 'superadmin' and not public.user_is_superadmin() then
    return jsonb_build_object('ok', false, 'error', 'cannot_change_superadmin');
  end if;

  -- Si se baja de rol a un org_admin/superadmin, debe quedar al menos uno en la org
  if v_m.role in ('org_admin','superadmin') and p_new_role not in ('org_admin','superadmin') then
    select count(*) into v_admin_count from public.memberships
    where org_id = p_org_id and role in ('org_admin','superadmin');
    if v_admin_count <= 1 then
      return jsonb_build_object('ok', false, 'error', 'cannot_remove_last_admin');
    end if;
  end if;

  update public.memberships
  set role = p_new_role
  where id = v_m.id;

  insert into public.audit_log (org_id, actor_id, entity, entity_id, action, before_snapshot, after_snapshot, comment)
  values (p_org_id, v_actor_id, 'membership', v_m.id, 'update',
    jsonb_build_object('role', v_m.role),
    jsonb_build_object('role', p_new_role),
    'change_user_role');

  return jsonb_build_object('ok', true);
end;
$$;

-- 3) RPC: remove_from_org(org_id, user_id)
-- Solo org_admin o superadmin. No se puede eliminar al último org_admin/superadmin.
-- Un org_admin no puede eliminar a un superadmin; sí un superadmin.
create or replace function public.remove_from_org(p_org_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_m record;
  v_admin_count int;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if not (public.user_is_org_admin(p_org_id) or public.user_is_superadmin()) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select * into v_m from public.memberships
  where org_id = p_org_id and user_id = p_user_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'membership_not_found');
  end if;

  if v_m.role = 'superadmin' and not public.user_is_superadmin() then
    return jsonb_build_object('ok', false, 'error', 'cannot_remove_superadmin');
  end if;

  if v_m.role in ('org_admin','superadmin') then
    select count(*) into v_admin_count from public.memberships
    where org_id = p_org_id and role in ('org_admin','superadmin');
    if v_admin_count <= 1 then
      return jsonb_build_object('ok', false, 'error', 'cannot_remove_last_admin');
    end if;
  end if;

  delete from public.memberships where id = v_m.id;

  insert into public.audit_log (org_id, actor_id, entity, entity_id, action, before_snapshot, comment)
  values (p_org_id, v_actor_id, 'membership', v_m.id, 'delete',
    jsonb_build_object('user_id', v_m.user_id, 'role', v_m.role),
    'remove_from_org');

  return jsonb_build_object('ok', true);
end;
$$;
