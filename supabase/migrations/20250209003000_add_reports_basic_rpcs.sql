-- RPCs para reportes básicos (Módulo 7.2)
-- Objetivo: evitar over-fetching de shifts/shift_requests para agregaciones.

create or replace function public.report_shift_requests_status_counts(
  p_org_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table(status text, request_count bigint)
language sql
security invoker
set search_path = public
as $$
  select
    r.status::text as status,
    count(*)::bigint as request_count
  from public.shift_requests r
  where r.org_id = p_org_id
    and r.created_at >= p_from
    and r.created_at <= p_to
  group by r.status
$$;


create or replace function public.report_shift_counts_summary(
  p_org_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table(unassigned_count bigint, night_count bigint, weekend_count bigint)
language sql
security invoker
set search_path = public
as $$
  select
    count(*) filter (where s.assigned_user_id is null)::bigint as unassigned_count,
    count(*) filter (
      where
        lower(coalesce(ost.letter, '')) = 'n'
        or (ost.name ilike '%noche%' or ost.name ilike '%nocturn%' or ost.name ilike '%night%')
    )::bigint as night_count,
    count(*) filter (where extract(dow from s.start_at) in (0, 6))::bigint as weekend_count
  from public.shifts s
  left join public.organization_shift_types ost on ost.id = s.shift_type_id
  where s.org_id = p_org_id
    and s.start_at >= p_from
    and s.start_at <= p_to
$$;


create or replace function public.report_shift_counts_by_user_type(
  p_org_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table(user_id uuid, shift_type_name text, shift_type_letter text, shift_count bigint)
language sql
security invoker
set search_path = public
as $$
  select
    s.assigned_user_id as user_id,
    coalesce(ost.name, 'Sin tipo') as shift_type_name,
    coalesce(ost.letter, '?') as shift_type_letter,
    count(*)::bigint as shift_count
  from public.shifts s
  left join public.organization_shift_types ost on ost.id = s.shift_type_id
  where s.org_id = p_org_id
    and s.start_at >= p_from
    and s.start_at <= p_to
  group by s.assigned_user_id, ost.name, ost.letter
$$;

