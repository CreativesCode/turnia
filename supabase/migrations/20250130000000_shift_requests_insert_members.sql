-- Permitir a miembros (user, team_manager, org_admin, superadmin) crear shift_requests
-- cuando ellos son el requester. Viewer no puede crear solicitudes (canCreateRequests en rbac).

create or replace function public.user_can_create_requests(p_org_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org_id and m.user_id = auth.uid()
    and m.role in ('user', 'team_manager', 'org_admin', 'superadmin')
  );
$$ language sql security definer stable;

create policy "shift_requests_insert_member" on public.shift_requests
  for insert with check (
    org_id in (select public.user_org_ids())
    and requester_id = auth.uid()
    and public.user_can_create_requests(org_id)
  );
