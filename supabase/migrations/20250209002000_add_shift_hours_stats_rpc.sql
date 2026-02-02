-- RPC: aggregate shift count and hours for a range (avoid over-fetching start/end rows)
-- @see MEJORAS-RENDIMIENTO.md (Reducir límites altos / stats)

create or replace function public.shift_hours_stats(
  p_org_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_user_id uuid default null
)
returns table(shift_count bigint, total_hours numeric)
language sql
security invoker
set search_path = public
as $$
  select
    count(*)::bigint as shift_count,
    coalesce(
      sum(
        extract(epoch from (s.end_at - s.start_at)) / 3600.0
      ),
      0
    )::numeric as total_hours
  from public.shifts s
  where s.org_id = p_org_id
    and s.start_at >= p_from
    and s.start_at <= p_to
    and s.end_at > s.start_at
    and (p_user_id is null or s.assigned_user_id = p_user_id);
$$;

