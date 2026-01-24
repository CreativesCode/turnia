-- Turnia: tablas principales + RLS (multi-tenant Org/Team)
-- @see indications.md §3, §5, §7

-- Extensions
create extension if not exists "uuid-ossp";

-- Organizations (tenants)
create table public.organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Teams (services) per org
create table public.teams (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, slug)
);

-- Profiles (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Memberships: user role in org and optionally in team
-- role: superadmin | org_admin | team_manager | user | viewer
create table public.memberships (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('superadmin','org_admin','team_manager','user','viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, team_id, user_id)
);

-- Shifts
create table public.shifts (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  shift_type text not null check (shift_type in ('day','night','24h','custom')),
  status text not null default 'draft' check (status in ('draft','published')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Shift requests (give_away, swap, take_open)
create table public.shift_requests (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  request_type text not null check (request_type in ('give_away','swap','take_open')),
  status text not null default 'submitted' check (status in ('draft','submitted','accepted','approved','rejected','cancelled')),
  shift_id uuid references public.shifts(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  target_shift_id uuid references public.shifts(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  approver_id uuid references auth.users(id) on delete set null,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Availability events (vacation, sick, etc.)
create table public.availability_events (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Audit log (immutable; write via triggers or Edge Functions only)
create table public.audit_log (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  entity text not null,
  entity_id uuid,
  action text not null,
  before_snapshot jsonb,
  after_snapshot jsonb,
  comment text,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.organizations enable row level security;
alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.shifts enable row level security;
alter table public.shift_requests enable row level security;
alter table public.availability_events enable row level security;
alter table public.audit_log enable row level security;

-- Políticas básicas: solo usuarios con membership en la org pueden ver datos de esa org.
-- (Refinar según rol en migraciones posteriores.)

create or replace function public.user_org_ids()
returns setof uuid as $$
  select org_id from public.memberships where user_id = auth.uid();
$$ language sql security definer stable;

create policy "orgs_select" on public.organizations
  for select using (id in (select user_org_ids()));

create policy "teams_select" on public.teams
  for select using (org_id in (select user_org_ids()));

create policy "profiles_select" on public.profiles
  for select using (true);

create policy "memberships_select" on public.memberships
  for select using (org_id in (select user_org_ids()));

create policy "shifts_select" on public.shifts
  for select using (org_id in (select user_org_ids()));

create policy "shift_requests_select" on public.shift_requests
  for select using (org_id in (select user_org_ids()));

create policy "availability_select" on public.availability_events
  for select using (org_id in (select user_org_ids()));

create policy "audit_select" on public.audit_log
  for select using (org_id in (select user_org_ids()));

-- Trigger: profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
