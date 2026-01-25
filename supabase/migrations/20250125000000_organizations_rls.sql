-- Módulo 2: RLS y triggers para organizations
-- Helpers: user_is_org_admin, user_is_superadmin
-- Políticas: SELECT (incl. superadmin ve todas), UPDATE, DELETE
-- Trigger: updated_at en organizations

-- 1) Funciones helper (SECURITY DEFINER para leer memberships sin RLS)
create or replace function public.user_is_org_admin(oid uuid)
returns boolean as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid() and org_id = oid and role in ('org_admin','superadmin')
  );
$$ language sql security definer stable;

create or replace function public.user_is_superadmin()
returns boolean as $$
  select exists (
    select 1 from public.memberships where user_id = auth.uid() and role = 'superadmin'
  );
$$ language sql security definer stable;

-- 2) Trigger updated_at (reutilizable para teams/memberships después)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- 3) Organizations: reemplazar SELECT y añadir UPDATE, DELETE
drop policy if exists "orgs_select" on public.organizations;

create policy "orgs_select" on public.organizations
  for select using (
    id in (select user_org_ids()) or user_is_superadmin()
  );

create policy "orgs_update" on public.organizations
  for update using (user_is_org_admin(id) or user_is_superadmin());

create policy "orgs_delete" on public.organizations
  for delete using (user_is_org_admin(id) or user_is_superadmin());
