-- Performance indexes (Turnia)
-- @see MEJORAS-RENDIMIENTO.md (2 feb 2026)

-- Needed for multi-column GiST indexes on uuid/text/etc.
create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- shifts
-- ---------------------------------------------------------------------------

create index if not exists idx_shifts_org_id
  on public.shifts(org_id);

create index if not exists idx_shifts_org_start_at
  on public.shifts(org_id, start_at);

create index if not exists idx_shifts_org_end_at
  on public.shifts(org_id, end_at);

create index if not exists idx_shifts_org_assigned_user
  on public.shifts(org_id, assigned_user_id);

create index if not exists idx_shifts_assigned_user_id
  on public.shifts(assigned_user_id);

-- Composite btree to support common filters and conflict scans
create index if not exists idx_shifts_conflicts_check
  on public.shifts(org_id, assigned_user_id, start_at, end_at)
  where assigned_user_id is not null;

-- Multi-column GiST for overlap checks + filters
create index if not exists idx_shifts_time_range_gist
  on public.shifts
  using gist (org_id, assigned_user_id, tstzrange(start_at, end_at))
  where assigned_user_id is not null;

-- ---------------------------------------------------------------------------
-- shift_requests
-- ---------------------------------------------------------------------------

create index if not exists idx_shift_requests_org_id
  on public.shift_requests(org_id);

create index if not exists idx_shift_requests_requester_id
  on public.shift_requests(requester_id);

create index if not exists idx_shift_requests_shift_id
  on public.shift_requests(shift_id);

create index if not exists idx_shift_requests_target_user_id
  on public.shift_requests(target_user_id);

create index if not exists idx_shift_requests_org_status
  on public.shift_requests(org_id, status);

create index if not exists idx_shift_requests_org_requester
  on public.shift_requests(org_id, requester_id);

create index if not exists idx_shift_requests_org_status_created
  on public.shift_requests(org_id, status, created_at desc);

create index if not exists idx_shift_requests_pending
  on public.shift_requests(org_id, created_at desc)
  where status in ('submitted', 'accepted');

-- ---------------------------------------------------------------------------
-- memberships
-- ---------------------------------------------------------------------------

create index if not exists idx_memberships_user_id
  on public.memberships(user_id);

create index if not exists idx_memberships_org_role
  on public.memberships(org_id, role);

-- ---------------------------------------------------------------------------
-- availability_events
-- ---------------------------------------------------------------------------

create index if not exists idx_availability_events_org_user
  on public.availability_events(org_id, user_id);

create index if not exists idx_availability_events_time_range
  on public.availability_events
  using gist (org_id, tstzrange(start_at, end_at));

-- ---------------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------------

create index if not exists idx_audit_log_actor_id
  on public.audit_log(actor_id)
  where actor_id is not null;

create index if not exists idx_audit_log_entity
  on public.audit_log(entity, entity_id);

