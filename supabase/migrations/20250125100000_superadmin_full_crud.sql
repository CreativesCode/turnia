-- Superadmin: CRUD completo en todos los modelos
-- 1) user_org_ids() devuelve todas las orgs si user_is_superadmin()
-- 2) organization_invitations: bypass superadmin en SELECT/INSERT/UPDATE/DELETE
-- 3) memberships, shifts, shift_requests, availability_events: INSERT/UPDATE/DELETE para superadmin
--    (teams se eliminó en 20250126000000_drop_teams)
-- 4) profiles: UPDATE (y INSERT) para superadmin (DELETE no; es sensible)

-- 1) user_org_ids: si superadmin ve todas las orgs (y por tanto todos los datos scoped por org_id)
create or replace function public.user_org_ids()
returns setof uuid as $$
  select id from public.organizations where public.user_is_superadmin()
  union
  select org_id from public.memberships where user_id = auth.uid();
$$ language sql security definer stable;

-- 2) organization_invitations: superadmin puede ver y modificar invitaciones de cualquier org
drop policy if exists "invitations_select_org_admins" on public.organization_invitations;
drop policy if exists "invitations_insert_org_admins" on public.organization_invitations;
drop policy if exists "invitations_update_org_admins" on public.organization_invitations;
drop policy if exists "invitations_delete_org_admins" on public.organization_invitations;

create policy "invitations_select_org_admins" on public.organization_invitations
  for select using (
    org_id in (
      select m.org_id from public.memberships m
      where m.user_id = auth.uid() and m.role in ('org_admin', 'superadmin')
    )
    or public.user_is_superadmin()
  );

create policy "invitations_insert_org_admins" on public.organization_invitations
  for insert with check (
    org_id in (
      select m.org_id from public.memberships m
      where m.user_id = auth.uid() and m.role in ('org_admin', 'superadmin')
    )
    or public.user_is_superadmin()
  );

create policy "invitations_update_org_admins" on public.organization_invitations
  for update using (
    org_id in (
      select m.org_id from public.memberships m
      where m.user_id = auth.uid() and m.role in ('org_admin', 'superadmin')
    )
    or public.user_is_superadmin()
  );

create policy "invitations_delete_org_admins" on public.organization_invitations
  for delete using (
    org_id in (
      select m.org_id from public.memberships m
      where m.user_id = auth.uid() and m.role in ('org_admin', 'superadmin')
    )
    or public.user_is_superadmin()
  );

-- 3) memberships: INSERT, UPDATE, DELETE para superadmin
drop policy if exists "memberships_insert_superadmin" on public.memberships;
drop policy if exists "memberships_update_superadmin" on public.memberships;
drop policy if exists "memberships_delete_superadmin" on public.memberships;
create policy "memberships_insert_superadmin" on public.memberships
  for insert with check (public.user_is_superadmin());

create policy "memberships_update_superadmin" on public.memberships
  for update using (public.user_is_superadmin());

create policy "memberships_delete_superadmin" on public.memberships
  for delete using (public.user_is_superadmin());

-- 3) shifts: INSERT, UPDATE, DELETE para superadmin
drop policy if exists "shifts_insert_superadmin" on public.shifts;
drop policy if exists "shifts_update_superadmin" on public.shifts;
drop policy if exists "shifts_delete_superadmin" on public.shifts;
create policy "shifts_insert_superadmin" on public.shifts
  for insert with check (public.user_is_superadmin());

create policy "shifts_update_superadmin" on public.shifts
  for update using (public.user_is_superadmin());

create policy "shifts_delete_superadmin" on public.shifts
  for delete using (public.user_is_superadmin());

-- 3) shift_requests: INSERT, UPDATE, DELETE para superadmin
drop policy if exists "shift_requests_insert_superadmin" on public.shift_requests;
drop policy if exists "shift_requests_update_superadmin" on public.shift_requests;
drop policy if exists "shift_requests_delete_superadmin" on public.shift_requests;
create policy "shift_requests_insert_superadmin" on public.shift_requests
  for insert with check (public.user_is_superadmin());

create policy "shift_requests_update_superadmin" on public.shift_requests
  for update using (public.user_is_superadmin());

create policy "shift_requests_delete_superadmin" on public.shift_requests
  for delete using (public.user_is_superadmin());

-- 3) availability_events: INSERT, UPDATE, DELETE para superadmin
drop policy if exists "availability_insert_superadmin" on public.availability_events;
drop policy if exists "availability_update_superadmin" on public.availability_events;
drop policy if exists "availability_delete_superadmin" on public.availability_events;
create policy "availability_insert_superadmin" on public.availability_events
  for insert with check (public.user_is_superadmin());

create policy "availability_update_superadmin" on public.availability_events
  for update using (public.user_is_superadmin());

create policy "availability_delete_superadmin" on public.availability_events
  for delete using (public.user_is_superadmin());

-- 4) profiles: SELECT ya es (true). Añadir INSERT y UPDATE para superadmin (DELETE no; sensible)
drop policy if exists "profiles_insert_superadmin" on public.profiles;
drop policy if exists "profiles_update_superadmin" on public.profiles;
create policy "profiles_insert_superadmin" on public.profiles
  for insert with check (public.user_is_superadmin());

create policy "profiles_update_superadmin" on public.profiles
  for update using (public.user_is_superadmin());

-- 5) organizations: INSERT para superadmin (UPDATE/DELETE ya en 20250125000000)
drop policy if exists "orgs_insert_superadmin" on public.organizations;
create policy "orgs_insert_superadmin" on public.organizations
  for insert with check (public.user_is_superadmin());

-- audit_log: se deja solo lectura (inmutable). SELECT ya cubierto por user_org_ids().
