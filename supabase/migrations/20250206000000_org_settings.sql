-- Configuraciones por organización (Módulo 9.3)
-- allow_self_assign_open_shifts, require_approval_for_swaps, require_approval_for_give_aways, min_rest_hours
-- @see project-roadmap.md Módulo 9.3

create table public.org_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  allow_self_assign_open_shifts boolean not null default true,
  require_approval_for_swaps boolean not null default true,
  require_approval_for_give_aways boolean not null default true,
  min_rest_hours integer not null default 0,
  settings_json jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.org_settings enable row level security;

-- SELECT: cualquier miembro de la org
create policy "org_settings_select" on public.org_settings
  for select using (org_id in (select public.user_org_ids()));

-- INSERT: org_admin o superadmin
create policy "org_settings_insert" on public.org_settings
  for insert with check (public.user_is_org_admin(org_id) or public.user_is_superadmin());

-- UPDATE: org_admin o superadmin
create policy "org_settings_update" on public.org_settings
  for update using (public.user_is_org_admin(org_id) or public.user_is_superadmin());
