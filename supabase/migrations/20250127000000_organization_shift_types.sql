-- Tipos de turno por organización
-- Cada organización define sus propios tipos (ej. Mañana, Noche, 24h) con letra y color.
-- Los turnos (shifts) referencian organization_shift_types en lugar del enum fijo.

-- 1) Tabla organization_shift_types
create table public.organization_shift_types (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  letter text not null,
  color text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_shift_types_letter_length check (char_length(trim(letter)) >= 1),
  constraint organization_shift_types_letter_max check (char_length(letter) <= 5),
  unique(org_id, letter)
);

create index organization_shift_types_org_id_idx on public.organization_shift_types(org_id);

-- Trigger updated_at
create trigger organization_shift_types_updated_at
  before update on public.organization_shift_types
  for each row execute function public.set_updated_at();

-- RLS
alter table public.organization_shift_types enable row level security;

create policy "organization_shift_types_select" on public.organization_shift_types
  for select using (org_id in (select user_org_ids()));

create policy "organization_shift_types_insert" on public.organization_shift_types
  for insert with check (
    org_id in (select user_org_ids())
    and (
      user_is_org_admin(org_id)
      or exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.org_id = org_id and m.role = 'team_manager')
    )
  );

create policy "organization_shift_types_update" on public.organization_shift_types
  for update using (
    org_id in (select user_org_ids())
    and (
      user_is_org_admin(org_id)
      or exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.org_id = organization_shift_types.org_id and m.role = 'team_manager')
    )
  );

create policy "organization_shift_types_delete" on public.organization_shift_types
  for delete using (
    org_id in (select user_org_ids())
    and (
      user_is_org_admin(org_id)
      or exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.org_id = organization_shift_types.org_id and m.role = 'team_manager')
    )
  );

create policy "organization_shift_types_insert_superadmin" on public.organization_shift_types
  for insert with check (user_is_superadmin());

create policy "organization_shift_types_update_superadmin" on public.organization_shift_types
  for update using (user_is_superadmin());

create policy "organization_shift_types_delete_superadmin" on public.organization_shift_types
  for delete using (user_is_superadmin());

-- 2) Añadir shift_type_id a shifts (nullable para backfill)
alter table public.shifts
  add column shift_type_id uuid references public.organization_shift_types(id) on delete restrict;

-- 3) Crear tipos por defecto para cada org que ya tiene turnos y actualizar referencias
insert into public.organization_shift_types (org_id, name, letter, color, sort_order)
select o.org_id, t.name, t.letter, t.color, t.sort_order
from (values
  ('Día', 'D', '#FBBF24', 1),
  ('Noche', 'N', '#3B82F6', 2),
  ('24h', 'H', '#A855F7', 3),
  ('Personalizado', 'C', '#6B7280', 4)
) as t(name, letter, color, sort_order)
cross join (select distinct org_id from public.shifts) o;

update public.shifts s
set shift_type_id = ost.id
from public.organization_shift_types ost
where ost.org_id = s.org_id
  and ost.letter = case s.shift_type
    when 'day' then 'D'
    when 'night' then 'N'
    when '24h' then 'H'
    when 'custom' then 'C'
  end;

-- 4) Eliminar shift_type y hacer shift_type_id obligatorio
alter table public.shifts drop column shift_type;

alter table public.shifts alter column shift_type_id set not null;

create index shifts_shift_type_id_idx on public.shifts(shift_type_id);
