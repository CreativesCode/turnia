-- Push tokens para notificaciones (Módulo 5.1)
-- Almacena tokens FCM (Android) / APNs (iOS) por usuario y plataforma.
-- El registro/actualización se hace desde la Edge Function register-push-token (service_role).

create table public.push_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  token text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  unique(token)
);

create index push_tokens_user_id_idx on public.push_tokens (user_id);

comment on table public.push_tokens is 'Tokens de dispositivos para push (FCM/APNs). Un token por dispositivo; se actualiza con upsert por token.';

alter table public.push_tokens enable row level security;

-- Usuarios pueden ver solo sus propios tokens (p. ej. futura UI "Mis dispositivos").
-- INSERT/UPDATE/DELETE se hace desde la Edge Function register-push-token con service_role.
create policy "push_tokens_select_own" on public.push_tokens
  for select using (user_id = auth.uid());
