-- Tabla permission_requests: solicitudes de permiso (días no trabajar, fraccionar turno).
-- Flujo: usuario solicita → manager aprueba/rechaza → (opcional) crea availability_events al aprobar.

create table public.permission_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  permission_scope_type text not null check (permission_scope_type in ('days', 'fraction_shift')),
  request_type text not null check (request_type in (
    'administrativo', 'capacitacion', 'descanso_compensatorio', 'descanso_reparatorio',
    'licencia_medica', 'no_disponible', 'permisos_especiales', 'vacaciones'
  )),
  start_at timestamptz not null,
  end_at timestamptz not null,
  shift_id uuid references public.shifts(id) on delete set null,
  reason text,
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'rejected', 'cancelled')),
  approver_id uuid references auth.users(id) on delete set null,
  comment_approver text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices para consultas frecuentes
create index idx_permission_requests_org_id on public.permission_requests(org_id);
create index idx_permission_requests_requester_id on public.permission_requests(requester_id);
create index idx_permission_requests_status on public.permission_requests(status);
create index idx_permission_requests_org_status on public.permission_requests(org_id, status);

comment on table public.permission_requests is 'Solicitudes de permiso (días no trabajar, fraccionar turno). Requieren aprobación del manager.';

-- RLS
alter table public.permission_requests enable row level security;

-- SELECT: usuarios con membership en la org pueden ver solicitudes de esa org
create policy "permission_requests_select" on public.permission_requests
  for select using (org_id in (select public.user_org_ids()));

-- INSERT: miembros (user, team_manager, org_admin, superadmin) pueden crear solicitudes propias en orgs donde tienen membership
create policy "permission_requests_insert_member" on public.permission_requests
  for insert with check (
    auth.uid() = requester_id
    and org_id in (select public.user_org_ids())
    and public.user_can_create_requests(org_id)
  );

-- UPDATE: requester puede cancelar su propia solicitud
create policy "permission_requests_update_requester_cancel" on public.permission_requests
  for update using (
    auth.uid() = requester_id and status = 'submitted'
  )
  with check (status = 'cancelled');

-- UPDATE: manager/org_admin puede aprobar o rechazar
create policy "permission_requests_update_manager_approve" on public.permission_requests
  for update using (
    org_id in (select public.user_org_ids())
    and (public.user_can_manage_shifts(org_id) or public.user_is_superadmin())
    and status = 'submitted'
  )
  with check (status in ('approved', 'rejected'));

-- Superadmin: INSERT, UPDATE, DELETE completos
create policy "permission_requests_insert_superadmin" on public.permission_requests
  for insert with check (public.user_is_superadmin());
create policy "permission_requests_update_superadmin" on public.permission_requests
  for update using (public.user_is_superadmin());
create policy "permission_requests_delete_superadmin" on public.permission_requests
  for delete using (public.user_is_superadmin());
