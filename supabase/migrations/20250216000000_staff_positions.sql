-- Puestos de personal por organización
-- Cada organización define sus propios puestos (ej. Médico Turnate, Médico de refuerzo).
-- Los memberships pueden tener un staff_position_id opcional.

-- 1) Tabla organization_staff_positions
create table public.organization_staff_positions (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_staff_positions_name_non_empty check (char_length(trim(name)) >= 1)
);

create index organization_staff_positions_org_id_idx on public.organization_staff_positions(org_id);

create trigger organization_staff_positions_updated_at
  before update on public.organization_staff_positions
  for each row execute function public.set_updated_at();

alter table public.organization_staff_positions enable row level security;

create policy "organization_staff_positions_select" on public.organization_staff_positions
  for select using (org_id in (select user_org_ids()));

create policy "organization_staff_positions_insert" on public.organization_staff_positions
  for insert with check (
    org_id in (select user_org_ids())
    and (
      user_is_org_admin(org_id)
      or exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.org_id = org_id and m.role = 'team_manager')
    )
  );

create policy "organization_staff_positions_update" on public.organization_staff_positions
  for update using (
    org_id in (select user_org_ids())
    and (
      user_is_org_admin(org_id)
      or exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.org_id = organization_staff_positions.org_id and m.role = 'team_manager')
    )
  );

create policy "organization_staff_positions_delete" on public.organization_staff_positions
  for delete using (
    org_id in (select user_org_ids())
    and (
      user_is_org_admin(org_id)
      or exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.org_id = organization_staff_positions.org_id and m.role = 'team_manager')
    )
  );

create policy "organization_staff_positions_insert_superadmin" on public.organization_staff_positions
  for insert with check (user_is_superadmin());

create policy "organization_staff_positions_update_superadmin" on public.organization_staff_positions
  for update using (user_is_superadmin());

create policy "organization_staff_positions_delete_superadmin" on public.organization_staff_positions
  for delete using (user_is_superadmin());

-- 2) Añadir staff_position_id a memberships (nullable)
alter table public.memberships
  add column staff_position_id uuid references public.organization_staff_positions(id) on delete set null;

create index memberships_staff_position_id_idx on public.memberships(staff_position_id);

-- 3) Extender change_user_role para aceptar staff_position_id opcional
create or replace function public.change_user_role(
  p_org_id uuid,
  p_user_id uuid,
  p_new_role text,
  p_staff_position_id uuid default null
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
  v_before jsonb;
  v_after jsonb;
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

  -- validar staff_position_id pertenece a la org si se proporciona
  if p_staff_position_id is not null then
    if not exists (select 1 from public.organization_staff_positions where id = p_staff_position_id and org_id = p_org_id) then
      return jsonb_build_object('ok', false, 'error', 'invalid_staff_position');
    end if;
  end if;

  select * into v_m from public.memberships
  where org_id = p_org_id and user_id = p_user_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'membership_not_found');
  end if;

  if v_m.role = 'superadmin' and not public.user_is_superadmin() then
    return jsonb_build_object('ok', false, 'error', 'cannot_change_superadmin');
  end if;

  if v_m.role in ('org_admin','superadmin') and p_new_role not in ('org_admin','superadmin') then
    select count(*) into v_admin_count from public.memberships
    where org_id = p_org_id and role in ('org_admin','superadmin');
    if v_admin_count <= 1 then
      return jsonb_build_object('ok', false, 'error', 'cannot_remove_last_admin');
    end if;
  end if;

  v_before := jsonb_build_object('role', v_m.role, 'staff_position_id', v_m.staff_position_id);
  v_after := jsonb_build_object('role', p_new_role, 'staff_position_id', p_staff_position_id);

  update public.memberships
  set role = p_new_role, staff_position_id = p_staff_position_id
  where id = v_m.id;

  insert into public.audit_log (org_id, actor_id, entity, entity_id, action, before_snapshot, after_snapshot, comment)
  values (p_org_id, v_actor_id, 'membership', v_m.id, 'update', v_before, v_after, 'change_user_role');

  return jsonb_build_object('ok', true);
end;
$$;
