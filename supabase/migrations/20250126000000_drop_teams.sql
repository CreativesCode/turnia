-- Eliminar el modelo Team: drop tabla teams y todas las referencias.
-- memberships, shifts y shift_requests pasan a ser solo org-scoped.
-- organization_invitations deja de tener team_id.

-- 1) organization_invitations: quitar team_id
alter table public.organization_invitations
  drop column if exists team_id;

-- 2) memberships: quitar team_id y ajustar unique a (org_id, user_id)
alter table public.memberships
  drop constraint if exists memberships_org_id_team_id_user_id_key;

alter table public.memberships
  drop column if exists team_id;

-- Consolidar duplicados (mismo org_id, user_id) manteniendo el de menor id
delete from public.memberships m1
using public.memberships m2
where m1.org_id = m2.org_id and m1.user_id = m2.user_id and m1.id > m2.id;

alter table public.memberships
  add constraint memberships_org_id_user_id_key unique (org_id, user_id);

-- 3) shifts: quitar team_id (turnos pasan a ser solo por org)
alter table public.shifts
  drop column if exists team_id;

-- 4) shift_requests: quitar team_id
alter table public.shift_requests
  drop column if exists team_id;

-- 5) Eliminar tabla teams (y sus políticas RLS)
drop table if exists public.teams cascade;
