-- Módulo 8.2: Triggers automáticos para registrar cambios en shifts, shift_requests y memberships
-- en audit_log. La auditoría desde Edge Functions y RPCs se mantiene; estos triggers cubren
-- cambios directos en la base (p. ej. desde cliente Supabase u otras funciones).

-- 1) Función helper: log_audit_event(org_id, entity, entity_id, action, before, after, comment)
--    actor_id se toma de auth.uid() (puede ser null si el cambio viene de service role).
create or replace function public.log_audit_event(
  p_org_id uuid,
  p_entity text,
  p_entity_id uuid,
  p_action text,
  p_before jsonb default null,
  p_after jsonb default null,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (org_id, actor_id, entity, entity_id, action, before_snapshot, after_snapshot, comment)
  values (p_org_id, auth.uid(), p_entity, p_entity_id, p_action, p_before, p_after, p_comment);
end;
$$;

-- 2) Función genérica para triggers: usa TG_TABLE_NAME y TG_OP.
--    Mapeo: shifts -> 'shift', shift_requests -> 'shift_request', memberships -> 'membership'.
--    Acciones: 'insert', 'update', 'delete'.
create or replace function public.audit_trigger_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity text;
  v_entity_id uuid;
  v_org_id uuid;
  v_action text;
  v_before jsonb;
  v_after jsonb;
begin
  v_action := lower(TG_OP);
  if TG_TABLE_NAME = 'shifts' then
    v_entity := 'shift';
  elsif TG_TABLE_NAME = 'shift_requests' then
    v_entity := 'shift_request';
  elsif TG_TABLE_NAME = 'memberships' then
    v_entity := 'membership';
  else
    return coalesce(NEW, OLD);
  end if;

  if TG_OP = 'INSERT' then
    v_entity_id := NEW.id;
    v_org_id := NEW.org_id;
    v_before := null;
    v_after := to_jsonb(NEW);
  elsif TG_OP = 'UPDATE' then
    v_entity_id := NEW.id;
    v_org_id := NEW.org_id;
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
  else
    v_entity_id := OLD.id;
    v_org_id := OLD.org_id;
    v_before := to_jsonb(OLD);
    v_after := null;
  end if;

  perform public.log_audit_event(v_org_id, v_entity, v_entity_id, v_action, v_before, v_after, null);
  return coalesce(NEW, OLD);
end;
$$;

-- 3) Triggers en shifts
drop trigger if exists audit_shifts on public.shifts;
create trigger audit_shifts
  after insert or update or delete on public.shifts
  for each row execute function public.audit_trigger_fn();

-- 4) Triggers en shift_requests
drop trigger if exists audit_shift_requests on public.shift_requests;
create trigger audit_shift_requests
  after insert or update or delete on public.shift_requests
  for each row execute function public.audit_trigger_fn();

-- 5) Triggers en memberships
drop trigger if exists audit_memberships on public.memberships;
create trigger audit_memberships
  after insert or update or delete on public.memberships
  for each row execute function public.audit_trigger_fn();
