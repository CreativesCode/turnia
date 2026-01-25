-- Permitir al requester cancelar su propia solicitud cuando está en draft, submitted o accepted.
-- Solo se permite cambiar status a 'cancelled'.

create policy "shift_requests_update_requester_cancel" on public.shift_requests
  for update
  using (
    requester_id = auth.uid()
    and status in ('draft', 'submitted', 'accepted')
  )
  with check (status = 'cancelled');
