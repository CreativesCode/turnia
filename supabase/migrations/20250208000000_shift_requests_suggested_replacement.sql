-- Opción "sugerir reemplazo" en Give Away (Módulo 4.1, opcional).
-- El solicitante puede sugerir un miembro como reemplazo al dar de baja un turno.
-- El manager ve la sugerencia en el detalle de la solicitud.

alter table public.shift_requests
  add column if not exists suggested_replacement_user_id uuid references auth.users(id) on delete set null;

comment on column public.shift_requests.suggested_replacement_user_id is 'Opcional: usuario sugerido como reemplazo en give_away. Solo informativo para el manager.';
