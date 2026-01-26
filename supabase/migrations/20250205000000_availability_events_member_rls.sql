-- RLS para que los usuarios (staff) puedan INSERT/UPDATE/DELETE sus propios availability_events.
-- SELECT ya existe (org members). Superadmin ya tiene sus políticas en 20250125100000.
-- @see project-roadmap.md Módulo 6.1, 9.1

-- INSERT: solo si user_id = auth.uid() y org_id pertenece a una membership del usuario
create policy "availability_insert_member" on public.availability_events
  for insert
  with check (
    user_id = auth.uid()
    and org_id in (select org_id from public.memberships where user_id = auth.uid())
  );

-- UPDATE: solo las propias filas
create policy "availability_update_member" on public.availability_events
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- DELETE: solo las propias filas
create policy "availability_delete_member" on public.availability_events
  for delete
  using (user_id = auth.uid());
