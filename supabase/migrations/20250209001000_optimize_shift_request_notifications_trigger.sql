-- Optimize notifications trigger for shift_requests inserts
-- Replaces row-by-row loop with set-based INSERT ... SELECT
-- @see MEJORAS-RENDIMIENTO.md (Optimizar Trigger de Notificaciones)

create or replace function public.notify_on_shift_request_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  req_type_label text;
begin
  if NEW.status <> 'submitted' then
    return NEW;
  end if;

  req_type_label := case NEW.request_type
    when 'give_away' then 'dar de baja'
    when 'swap' then 'intercambio'
    when 'take_open' then 'tomar turno abierto'
    else 'solicitud'
  end;

  -- 1) Swap: notificar a la contraparte (target_user_id)
  if NEW.request_type = 'swap' and NEW.target_user_id is not null then
    insert into public.notifications (user_id, title, message, type, entity_type, entity_id)
    values (
      NEW.target_user_id,
      'Nueva solicitud de intercambio',
      'Alguien te ha propuesto intercambiar turnos. Revisa en Transacciones para aceptar o rechazar.',
      'request',
      'shift_request',
      NEW.id
    );
  end if;

  -- 2) Notificar a managers de la org (excluir al requester) - set-based
  insert into public.notifications (user_id, title, message, type, entity_type, entity_id)
  select
    m.user_id,
    'Nueva solicitud',
    'Se ha enviado una solicitud de ' || req_type_label || '. Revisa en Solicitudes.',
    'request',
    'shift_request',
    NEW.id
  from public.memberships m
  where m.org_id = NEW.org_id
    and m.role in ('team_manager', 'org_admin', 'superadmin')
    and m.user_id <> NEW.requester_id;

  return NEW;
end;
$$;

