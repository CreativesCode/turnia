'use client';

/**
 * Lista de eventos del audit log con filtros: entidad, actor, acción, rango de fechas.
 * @see project-roadmap.md Módulo 8.1
 */

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AuditLogDetailModal, type AuditLogRow } from './AuditLogDetailModal';

const ENTITY_LABELS: Record<string, string> = {
  shift: 'Turno',
  shift_request: 'Solicitud',
  membership: 'Miembro',
  organization_invitation: 'Invitación',
};

const ACTION_LABELS: Record<string, string> = {
  insert: 'Creación',
  request_approved: 'Solicitud aprobada',
  request_rejected: 'Solicitud rechazada',
  swap_accepted_by_target: 'Swap aceptado por contraparte',
  swap_declined_by_target: 'Swap rechazado por contraparte',
  update: 'Actualización',
  delete: 'Eliminación',
  accept: 'Invitación aceptada',
};

const PAGE_SIZE = 50;

type Filters = {
  entity: string;
  actorId: string;
  action: string;
  dateFrom: string;
  dateTo: string;
};

type ActorOption = { id: string; label: string };

type Props = { orgId: string };

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toStartOfDay(s: string): string {
  return s ? `${s}T00:00:00.000Z` : '';
}

function toEndOfDay(s: string): string {
  return s ? `${s}T23:59:59.999Z` : '';
}

function getEntityLabel(e: string): string {
  return ENTITY_LABELS[e] ?? e;
}

function getActionLabel(a: string): string {
  return ACTION_LABELS[a] ?? a;
}

export function AuditLogList({ orgId }: Props) {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [actors, setActors] = useState<ActorOption[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<AuditLogRow | null>(null);
  const [filters, setFilters] = useState<Filters>(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      entity: '',
      actorId: '',
      action: '',
      dateFrom: toDateInput(first),
      dateTo: toDateInput(last),
    };
  });

  const loadActors = useCallback(async () => {
    const supabase = createClient();
    const { data: mems } = await supabase
      .from('memberships')
      .select('user_id')
      .eq('org_id', orgId);
    const ids = [...new Set((mems ?? []).map((m: { user_id: string }) => m.user_id))];
    if (ids.length === 0) {
      setActors([]);
      return;
    }
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', ids);
    const opts: ActorOption[] = (profs ?? []).map((p: { id: string; full_name: string | null; email: string | null }) => ({
      id: p.id,
      label: (p.full_name || p.email || p.id.slice(0, 8)).trim(),
    }));
    opts.sort((a, b) => a.label.localeCompare(b.label));
    setActors(opts);
  }, [orgId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    let q = supabase
      .from('audit_log')
      .select('id, org_id, actor_id, entity, entity_id, action, before_snapshot, after_snapshot, comment, created_at', { count: 'exact' })
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (filters.entity) q = q.eq('entity', filters.entity);
    if (filters.actorId) q = q.eq('actor_id', filters.actorId);
    if (filters.action) q = q.eq('action', filters.action);
    const from = toStartOfDay(filters.dateFrom);
    const to = toEndOfDay(filters.dateTo);
    if (from) q = q.gte('created_at', from);
    if (to) q = q.lte('created_at', to);

    const fromIdx = (page - 1) * PAGE_SIZE;
    const { data, error: err, count } = await q.range(fromIdx, fromIdx + PAGE_SIZE - 1);

    if (err) {
      setError(err.message);
      setRows([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    const list = (data ?? []) as AuditLogRow[];
    setRows(list);
    setTotal(count ?? 0);

    const actorIds = [...new Set(list.map((r) => r.actor_id).filter(Boolean))] as string[];
    if (actorIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', actorIds);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: { id: string; full_name: string | null; email: string | null }) => {
        map[p.id] = (p.full_name || p.email || p.id.slice(0, 8)).trim();
      });
      setNames(map);
    } else {
      setNames({});
    }
    setLoading(false);
  }, [orgId, page, filters.entity, filters.actorId, filters.action, filters.dateFrom, filters.dateTo]);

  useEffect(() => {
    loadActors();
  }, [loadActors]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-background p-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text-secondary">Entidad</span>
          <select
            value={filters.entity}
            onChange={(e) => {
              setFilters((f) => ({ ...f, entity: e.target.value }));
              setPage(1);
            }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">Todas</option>
            {Object.entries(ENTITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text-secondary">Actor</span>
          <select
            value={filters.actorId}
            onChange={(e) => {
              setFilters((f) => ({ ...f, actorId: e.target.value }));
              setPage(1);
            }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">Todos</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text-secondary">Acción</span>
          <select
            value={filters.action}
            onChange={(e) => {
              setFilters((f) => ({ ...f, action: e.target.value }));
              setPage(1);
            }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">Todas</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text-secondary">Desde</span>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => {
              setFilters((f) => ({ ...f, dateFrom: e.target.value }));
              setPage(1);
            }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text-secondary">Hasta</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => {
              setFilters((f) => ({ ...f, dateTo: e.target.value }));
              setPage(1);
            }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </label>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <div className="rounded-xl border border-border bg-background p-8 text-center text-sm text-text-secondary">
          Cargando…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-background p-8 text-center text-sm text-text-secondary">
          No hay eventos en el rango y filtros seleccionados.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-background">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-subtle-bg">
                  <th className="px-4 py-3 font-medium text-text-secondary">Fecha</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">Entidad</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">Acción</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">Actor</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">Comentario</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setDetail(r)}
                    className="cursor-pointer border-b border-border hover:bg-subtle-bg last:border-b-0"
                  >
                    <td className="px-4 py-3 text-text-primary">
                      {new Date(r.created_at).toLocaleString('es-ES', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-4 py-3 text-text-primary">{getEntityLabel(r.entity)}</td>
                    <td className="px-4 py-3 text-text-primary">{getActionLabel(r.action)}</td>
                    <td className="px-4 py-3 text-text-primary">
                      {r.actor_id ? names[r.actor_id] ?? r.actor_id.slice(0, 8) : '—'}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-text-secondary">
                      {r.comment || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-text-secondary">
                {total} evento{total !== 1 ? 's' : ''} · Página {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-text-primary hover:bg-subtle-bg disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-text-primary hover:bg-subtle-bg disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <AuditLogDetailModal
        open={!!detail}
        onClose={() => setDetail(null)}
        entry={detail}
        actorName={detail?.actor_id ? names[detail.actor_id] ?? detail.actor_id.slice(0, 8) : '—'}
        entityLabel={detail ? getEntityLabel(detail.entity) : ''}
        actionLabel={detail ? getActionLabel(detail.action) : ''}
      />
    </div>
  );
}
