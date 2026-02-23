-- Organizaciones con 2 niveles: una organización puede tener varias hijas (parent_id).
-- Las invitaciones se pueden hacer desde cualquier org; si se invita a una org con hijas,
-- el usuario tiene acceso también a las hijas (vía user_org_ids y get_my_accessible_organizations).

-- 1) parent_id en organizations (solo 2 niveles: raíz o hija de raíz)
alter table public.organizations
  add column if not exists parent_id uuid references public.organizations(id) on delete set null;

-- Solo permitir 2 niveles: el padre (si existe) debe ser raíz (parent_id null). Trigger porque CHECK no permite subconsultas.
create or replace function public.check_org_only_two_levels()
returns trigger as $$
begin
  if new.parent_id is not null then
    if exists (select 1 from public.organizations p where p.id = new.parent_id and p.parent_id is not null) then
      raise exception 'Solo se permiten 2 niveles: la organización padre debe ser raíz (sin padre).';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists org_only_two_levels_trigger on public.organizations;
create trigger org_only_two_levels_trigger
  before insert or update of parent_id on public.organizations
  for each row execute function public.check_org_only_two_levels();

create index if not exists idx_organizations_parent_id on public.organizations(parent_id) where parent_id is not null;

-- 2) user_org_ids: incluir orgs donde el usuario tiene membership Y todas las hijas de esas orgs
create or replace function public.user_org_ids()
returns setof uuid as $$
  select id from public.organizations where public.user_is_superadmin()
  union
  select org_id from public.memberships where user_id = auth.uid()
  union
  select o.id from public.organizations o
  inner join public.memberships m on m.user_id = auth.uid() and o.parent_id = m.org_id;
$$ language sql security definer stable;

-- 3) user_can_manage_org: true si el usuario es org_admin de la org o de su padre (para gestionar invitaciones/hijas)
create or replace function public.user_can_manage_org(oid uuid)
returns boolean as $$
  select public.user_is_org_admin(oid)
  or exists (
    select 1 from public.organizations o
    where o.id = oid and o.parent_id is not null and public.user_is_org_admin(o.parent_id)
  );
$$ language sql security definer stable;

-- 4) Invitaciones: permitir ver/crear/actualizar/eliminar si user_can_manage_org(org_id) o superadmin
drop policy if exists "invitations_select_org_admins" on public.organization_invitations;
drop policy if exists "invitations_insert_org_admins" on public.organization_invitations;
drop policy if exists "invitations_update_org_admins" on public.organization_invitations;
drop policy if exists "invitations_delete_org_admins" on public.organization_invitations;

create policy "invitations_select_org_admins" on public.organization_invitations
  for select using (public.user_can_manage_org(org_id) or public.user_is_superadmin());

create policy "invitations_insert_org_admins" on public.organization_invitations
  for insert with check (public.user_can_manage_org(org_id) or public.user_is_superadmin());

create policy "invitations_update_org_admins" on public.organization_invitations
  for update using (public.user_can_manage_org(org_id) or public.user_is_superadmin());

create policy "invitations_delete_org_admins" on public.organization_invitations
  for delete using (public.user_can_manage_org(org_id) or public.user_is_superadmin());

-- 5) Organizations INSERT: raíz (cualquier org_admin o superadmin) o hija (org_admin del padre)
drop policy if exists "orgs_insert_superadmin" on public.organizations;
create policy "orgs_insert_superadmin" on public.organizations
  for insert with check (public.user_is_superadmin());

create policy "orgs_insert_root" on public.organizations
  for insert with check (
    parent_id is null
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.role in ('org_admin', 'superadmin')
    )
  );

create policy "orgs_insert_child" on public.organizations
  for insert with check (
    parent_id is not null and public.user_is_org_admin(parent_id)
  );

-- 6) RPC: listar organizaciones accesibles por el usuario (direct membership + hijas), con rol
create or replace function public.get_my_accessible_organizations()
returns table (id uuid, name text, parent_id uuid, role text) as $$
  select o.id, o.name, o.parent_id,
    coalesce(m.role, parent_m.role) as role
  from public.organizations o
  left join public.memberships m on m.org_id = o.id and m.user_id = auth.uid()
  left join public.organizations parent on parent.id = o.parent_id
  left join public.memberships parent_m on parent_m.org_id = parent.id and parent_m.user_id = auth.uid()
  where o.id in (select public.user_org_ids())
  and (m.id is not null or parent_m.id is not null);
$$ language sql security definer stable;

comment on function public.get_my_accessible_organizations() is
  'Organizaciones que el usuario puede ver: las que tiene membership directa más las hijas de esas (con el mismo rol que en la padre).';

-- 7) Organizations UPDATE/DELETE: permitir a org_admin de la org o de su padre
drop policy if exists "orgs_update" on public.organizations;
drop policy if exists "orgs_delete" on public.organizations;

create policy "orgs_update" on public.organizations
  for update using (public.user_can_manage_org(id) or public.user_is_superadmin());

create policy "orgs_delete" on public.organizations
  for delete using (public.user_can_manage_org(id) or public.user_is_superadmin());
