-- RPC para exportar horarios (Edge Function export-schedule)
-- Objetivo: evitar over-fetching y resolver joins (tipo + asignado) en DB.

create or replace function public.export_schedule_rows(
  p_org_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table(
  start_at timestamptz,
  end_at timestamptz,
  status text,
  location text,
  shift_type_name text,
  shift_type_letter text,
  assigned_user_id uuid,
  assigned_full_name text
)
language sql
security invoker
set search_path = public
as $$
  select
    s.start_at,
    s.end_at,
    s.status::text as status,
    s.location::text as location,
    coalesce(ost.name, '')::text as shift_type_name,
    coalesce(ost.letter, '')::text as shift_type_letter,
    s.assigned_user_id,
    coalesce(p.full_name, '')::text as assigned_full_name
  from public.shifts s
  left join public.organization_shift_types ost on ost.id = s.shift_type_id
  left join public.profiles p on p.id = s.assigned_user_id
  where s.org_id = p_org_id
    and s.start_at >= p_from
    and s.start_at <= p_to
  order by s.start_at asc
$$;

