-- Turnia: Sistema de invitaciones a organizaciones
-- @see project-roadmap.md Módulo 1

create table public.organization_invitations (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  email text not null,
  role text not null check (role in ('org_admin', 'team_manager', 'user', 'viewer')),
  token text not null unique,
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at timestamptz not null,
  metadata jsonb default '{}',
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

-- Índices para búsquedas frecuentes
create index idx_organization_invitations_token on public.organization_invitations(token);
create index idx_organization_invitations_email on public.organization_invitations(email);
create index idx_organization_invitations_org_status on public.organization_invitations(org_id, status);

-- RLS
alter table public.organization_invitations enable row level security;

-- SELECT: org_admin/superadmin de la org pueden ver invitaciones de su org;
-- Cualquiera con el token puede validar vía Edge Function (sin SELECT directo).
create policy "invitations_select_org_admins" on public.organization_invitations
  for select using (
    org_id in (
      select m.org_id from public.memberships m
      where m.user_id = auth.uid() and m.role in ('org_admin', 'superadmin')
    )
  );

-- INSERT: solo org_admin o superadmin de la org
create policy "invitations_insert_org_admins" on public.organization_invitations
  for insert with check (
    org_id in (
      select m.org_id from public.memberships m
      where m.user_id = auth.uid() and m.role in ('org_admin', 'superadmin')
    )
  );

-- UPDATE: solo org_admin o superadmin (para cancelar, reenviar, etc.)
create policy "invitations_update_org_admins" on public.organization_invitations
  for update using (
    org_id in (
      select m.org_id from public.memberships m
      where m.user_id = auth.uid() and m.role in ('org_admin', 'superadmin')
    )
  );

-- DELETE: solo org_admin o superadmin
create policy "invitations_delete_org_admins" on public.organization_invitations
  for delete using (
    org_id in (
      select m.org_id from public.memberships m
      where m.user_id = auth.uid() and m.role in ('org_admin', 'superadmin')
    )
  );

-- Función para que Edge Functions (service_role) actualicen status a 'accepted'
-- Las Edge Functions usan service_role y bypasean RLS, no necesitan política extra.
