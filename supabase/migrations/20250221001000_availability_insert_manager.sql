-- Permite a managers (team_manager, org_admin, superadmin) crear availability_events
-- para cualquier miembro de su organización.
-- Necesario para que al aprobar una solicitud de permiso se cree el evento automáticamente desde el cliente.

create policy "availability_insert_manager" on public.availability_events
  for insert with check (
    org_id in (select public.user_org_ids())
    and (public.user_can_manage_shifts(org_id) or public.user_is_superadmin())
  );
