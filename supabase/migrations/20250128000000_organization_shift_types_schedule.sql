-- Horario del tipo de turno: start_time y end_time (hora de inicio y fin del día).
-- Opcional: si son null, el tipo no define un horario fijo.
-- end_time puede ser 24:00 para turno 24h. Si end_time < start_time, cruza medianoche.

alter table public.organization_shift_types
  add column if not exists start_time time,
  add column if not exists end_time time;

-- Valores por defecto para los tipos creados en la migración anterior (D, N, H, C)
update public.organization_shift_types
set start_time = '08:00'::time, end_time = '16:00'::time
where letter = 'D';

update public.organization_shift_types
set start_time = '22:00'::time, end_time = '06:00'::time
where letter = 'N';

update public.organization_shift_types
set start_time = '00:00'::time, end_time = '24:00'::time
where letter = 'H';

-- Personalizado (C): se deja null para que la org lo configure o deje sin horario fijo.
