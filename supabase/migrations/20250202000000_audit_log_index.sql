-- Índice para listar audit_log por organización y fecha (Módulo 8.1)
create index if not exists audit_log_org_created_idx
  on public.audit_log (org_id, created_at desc)
  where org_id is not null;
