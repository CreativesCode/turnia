-- Notificaciones in-app (Módulo 5.4)
-- Tabla notifications, RLS, y trigger para notificar al crear solicitudes (swap→User B; todas→managers)

-- Tabla notifications
create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'request' check (type in ('request', 'shift', 'system')),
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_id_created_at_idx on public.notifications (user_id, created_at desc);
create index notifications_user_id_read_at_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

-- Usuarios solo ven y actualizan (read_at) sus propias notificaciones
create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());

create policy "notifications_update_own_read" on public.notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- INSERT se hace desde Edge Functions (service_role) y desde la función SECURITY DEFINER del trigger.
-- Añadimos política que permite INSERT cuando la fila es para otro user_id (solo funciones/trigger con definer).
-- En la práctica, el trigger usará una función SECURITY DEFINER cuyo dueño (postgres) suele bypass RLS.
-- Por si acaso, permitimos INSERT al creador para su propio user_id: no lo usamos para "otros", pero
-- no rompe. Mejor: no dar política INSERT a authenticated para que solo service_role y definer inserten.
-- No creamos política INSERT para authenticated/anon. Las Edge Functions usan service_role (bypass RLS).
-- El trigger llama a una función SECURITY DEFINER: el dueño es el que corre migraciones (postgres/superuser)
-- y típicamente tiene BYPASSRLS. Si no, habría que usar una política más amplia. Dejamos sin política
-- INSERT para roles normales.

-- Función: crear notificaciones cuando se inserta una shift_request en status=submitted
-- - Swap: notificar a target_user_id
-- - Todas: notificar a managers de la org (team_manager, org_admin, superadmin) que no sean el requester
create or replace function public.notify_on_shift_request_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
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
      'Alguien te ha propuesto intercambiar turnos. Revisa en Mis solicitudes.',
      'request',
      'shift_request',
      NEW.id
    );
  end if;

  -- 2) Notificar a managers de la org (excluir al requester)
  for m in
    select user_id from public.memberships
    where org_id = NEW.org_id
      and role in ('team_manager', 'org_admin', 'superadmin')
      and user_id <> NEW.requester_id
  loop
    insert into public.notifications (user_id, title, message, type, entity_type, entity_id)
    values (
      m.user_id,
      'Nueva solicitud',
      'Se ha enviado una solicitud de ' || req_type_label || '. Revisa en Solicitudes.',
      'request',
      'shift_request',
      NEW.id
    );
  end loop;

  return NEW;
end;
$$;

create trigger on_shift_request_insert_notify
  after insert on public.shift_requests
  for each row execute function public.notify_on_shift_request_insert();
