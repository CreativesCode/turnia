-- RPC check_shift_conflicts: overlap, disponibilidad (availability_events) y descanso mínimo.
-- @see project-roadmap.md Módulo 3.2

create or replace function public.check_shift_conflicts(
  p_user_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_exclude_shift_id uuid,
  p_org_id uuid,
  p_min_rest_hours integer default 0
)
returns table(has_conflict boolean, message text)
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Sin usuario asignado: no hay conflictos que revisar
  if p_user_id is null then
    has_conflict := false;
    message := null;
    return next;
    return;
  end if;

  -- 1) Overlap: otro turno del mismo usuario en la misma org que se solapa
  if exists (
    select 1 from public.shifts s
    where s.org_id = p_org_id
      and s.assigned_user_id = p_user_id
      and (p_exclude_shift_id is null or s.id <> p_exclude_shift_id)
      and tstzrange(s.start_at, s.end_at) && tstzrange(p_start_at, p_end_at)
    limit 1
  ) then
    has_conflict := true;
    message := 'El usuario tiene otro turno que se solapa con el horario seleccionado.';
    return next;
    return;
  end if;

  -- 2) Disponibilidad: evento (vacaciones, baja, etc.) que se solapa
  if exists (
    select 1 from public.availability_events ae
    where ae.org_id = p_org_id
      and ae.user_id = p_user_id
      and tstzrange(ae.start_at, ae.end_at) && tstzrange(p_start_at, p_end_at)
    limit 1
  ) then
    has_conflict := true;
    message := 'El usuario tiene un evento de disponibilidad (vacaciones, baja, etc.) que se solapa con el horario.';
    return next;
    return;
  end if;

  -- 3) Descanso mínimo entre turnos (si p_min_rest_hours > 0)
  if p_min_rest_hours is not null and p_min_rest_hours > 0 then
    if exists (
      select 1 from public.shifts s
      where s.org_id = p_org_id
        and s.assigned_user_id = p_user_id
        and (p_exclude_shift_id is null or s.id <> p_exclude_shift_id)
        and (
          -- turno que termina demasiado cerca del inicio del nuevo
          (s.end_at > p_start_at - (p_min_rest_hours || ' hours')::interval and s.end_at <= p_start_at)
          or
          -- turno que empieza demasiado pronto después del fin del nuevo
          (s.start_at >= p_end_at and s.start_at < p_end_at + (p_min_rest_hours || ' hours')::interval)
        )
      limit 1
    ) then
      has_conflict := true;
      message := 'No se cumple el descanso mínimo de ' || p_min_rest_hours || ' horas entre turnos.';
      return next;
      return;
    end if;
  end if;

  has_conflict := false;
  message := null;
  return next;
end;
$$;

comment on function public.check_shift_conflicts(uuid, timestamptz, timestamptz, uuid, uuid, integer) is
  'Comprueba solapamiento con otros turnos, disponibilidad (availability_events) y descanso mínimo. p_exclude_shift_id: id a excluir (edición). p_min_rest_hours: 0 o null para no comprobar.';
