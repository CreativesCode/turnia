-- Módulo 9.1: Refinar políticas RLS
-- - shifts: INSERT/UPDATE manager o admin; DELETE solo org_admin o superadmin
-- - shift_requests: UPDATE manager (approve/reject); UPDATE target (swap accept/decline)
-- - memberships: INSERT/UPDATE/DELETE org_admin en su org (superadmin ya tiene)
-- availability_events: ya tiene insert/update/delete propio usuario (20250205000000)
-- @see project-roadmap.md Módulo 9.1

-- 1) Helper: user_can_manage_shifts(org_id) — team_manager, org_admin o superadmin en esa org
create or replace function public.user_can_manage_shifts(oid uuid)
returns boolean as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid() and org_id = oid
    and role in ('team_manager', 'org_admin', 'superadmin')
  );
$$ language sql security definer stable;

-- 2) Shifts: INSERT — manager o admin (team_manager, org_admin, superadmin)
--    Superadmin puede en cualquier org (user_org_ids los incluye todos)
create policy "shifts_insert_manager" on public.shifts
  for insert with check (
    org_id in (select public.user_org_ids())
    and (public.user_can_manage_shifts(org_id) or public.user_is_superadmin())
  );

-- 3) Shifts: UPDATE — manager o admin
create policy "shifts_update_manager" on public.shifts
  for update using (
    org_id in (select public.user_org_ids())
    and (public.user_can_manage_shifts(org_id) or public.user_is_superadmin())
  );

-- 4) Shifts: DELETE — solo org_admin o superadmin (no team_manager)
create policy "shifts_delete_admin" on public.shifts
  for delete using (
    public.user_is_org_admin(org_id) or public.user_is_superadmin()
  );

-- 5) Shift_requests: UPDATE — manager para approve/reject
--    Solo si estado previo submitted o accepted; solo puede poner approved o rejected
create policy "shift_requests_update_manager_approve_reject" on public.shift_requests
  for update
  using (
    org_id in (select public.user_org_ids())
    and (public.user_can_manage_shifts(org_id) or public.user_is_superadmin())
    and status in ('submitted', 'accepted')
  )
  with check (status in ('approved', 'rejected'));

-- 6) Shift_requests: UPDATE — target_user para swap (aceptar/rechazar)
create policy "shift_requests_update_target_swap_respond" on public.shift_requests
  for update
  using (
    target_user_id = auth.uid()
    and request_type = 'swap'
    and status = 'submitted'
  )
  with check (status in ('accepted', 'cancelled'));

-- 7) Memberships: INSERT — org_admin en su org (no puede crear superadmin)
create policy "memberships_insert_org_admin" on public.memberships
  for insert with check (
    public.user_is_org_admin(org_id)
    and role <> 'superadmin'
  );

-- 8) Memberships: UPDATE — org_admin en su org (no puede poner rol superadmin)
create policy "memberships_update_org_admin" on public.memberships
  for update
  using (public.user_is_org_admin(org_id))
  with check (role <> 'superadmin');

-- 9) Memberships: DELETE — org_admin en su org
create policy "memberships_delete_org_admin" on public.memberships
  for delete using (public.user_is_org_admin(org_id));
