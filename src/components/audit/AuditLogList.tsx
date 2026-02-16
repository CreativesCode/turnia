'use client';

/**
 * Lista de eventos del audit log con filtros: entidad, actor, acción, rango de fechas.
 * @see project-roadmap.md Módulo 8.1
 */

import { createClient } from '@/lib/supabase/client';
import { fetchOrgMemberIds, fetchProfilesMap } from '@/lib/supabase/queries';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
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
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailEntry, setDetailEntry] = useState<AuditLogRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
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

  const actorsKey = useMemo(() => ['auditActors', orgId] as const, [orgId]);
  const actorsFetcher = useCallback(async (): Promise<ActorOption[]> => {
    const supabase = createClient();
    const ids = await fetchOrgMemberIds(supabase, orgId);
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (unique.length === 0) return [];
    const map = await fetchProfilesMap(supabase, unique, { fallbackName: (id) => id.slice(0, 8) });
    const opts = unique.map((id) => ({ id, label: (map[id] || id.slice(0, 8)).trim() }));
    opts.sort((a, b) => a.label.localeCompare(b.label));
    return opts;
  }, [orgId]);

  const { data: actors = [] } = useSWR(actorsKey, actorsFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 30_000,
  });

  type AuditListRow = Pick<
    AuditLogRow,
    'id' | 'org_id' | 'actor_id' | 'entity' | 'entity_id' | 'action' | 'comment' | 'created_at'
  >;

  const listKey = useMemo(
    () =>
      [
        'auditLog',
        orgId,
        page,
        filters.entity,
        filters.actorId,
        filters.action,
        filters.dateFrom,
        filters.dateTo,
      ] as const,
    [orgId, page, filters.entity, filters.actorId, filters.action, filters.dateFrom, filters.dateTo]
  );

  const listFetcher = useCallback(async (): Promise<{ rows: AuditListRow[]; total: number; names: Record<string, string> }> => {
    const supabase = createClient();

    let q = supabase
      .from('audit_log')
      .select('id, org_id, actor_id, entity, entity_id, action, comment, created_at', { count: 'exact' })
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

    if (err) throw new Error(err.message);

    const rows = (data ?? []) as AuditListRow[];
    const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
    const names =
      actorIds.length > 0 ? await fetchProfilesMap(supabase, actorIds, { fallbackName: (id) => id.slice(0, 8) }) : {};
    return { rows, total: count ?? 0, names };
  }, [orgId, page, filters.actorId, filters.action, filters.dateFrom, filters.dateTo, filters.entity]);

  const { data: listData, error: listError, isLoading: listLoading, isValidating, mutate } = useSWR(listKey, listFetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
  });

  const rows = listData?.rows ?? [];
  const total = listData?.total ?? 0;
  const names = listData?.names ?? {};
  const loading = listLoading || (isValidating && !listData);
  const error = listError ? String((listError as Error).message ?? listError) : null;

  const realtimeTimerRef = useRef<number | null>(null);
  const scheduleRealtimeRefresh = useCallback(() => {
    if (realtimeTimerRef.current) window.clearTimeout(realtimeTimerRef.current);
    realtimeTimerRef.current = window.setTimeout(() => void mutate(), 250);
  }, [mutate]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`turnia:audit_log:${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'audit_log', filter: `org_id=eq.${orgId}` },
        () => scheduleRealtimeRefresh()
      )
      .subscribe();

    return () => {
      if (realtimeTimerRef.current) {
        window.clearTimeout(realtimeTimerRef.current);
        realtimeTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [orgId, scheduleRealtimeRefresh]);

  const openDetail = useCallback(
    async (id: string) => {
      setDetailId(id);
      setDetailEntry(null);
      setDetailError(null);
      setDetailLoading(true);
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from('audit_log')
        .select('id, org_id, actor_id, entity, entity_id, action, before_snapshot, after_snapshot, comment, created_at')
        .eq('id', id)
        .single();
      setDetailLoading(false);
      if (err) {
        setDetailError(err.message);
        return;
      }
      setDetailEntry(data as AuditLogRow);
    },
    [setDetailId]
  );

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
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none"
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
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none"
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
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none"
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
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none"
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
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none"
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
                    onClick={() => void openDetail(r.id)}
                    className="cursor-pointer border-b border-border hover:bg-subtle-bg last:border-b-0"
                  >
                    <td className="px-4 py-3 text-text-primary">
                      {new Date(r.created_at).toLocaleString('es-ES', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                        hour12: false,
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
        open={!!detailId}
        onClose={() => {
          setDetailId(null);
          setDetailEntry(null);
          setDetailError(null);
          setDetailLoading(false);
        }}
        entry={detailEntry}
        loading={detailLoading}
        error={detailError}
        actorName={
          (detailEntry?.actor_id ?? rows.find((x) => x.id === detailId)?.actor_id)
            ? names[(detailEntry?.actor_id ?? rows.find((x) => x.id === detailId)?.actor_id) as string] ??
            ((detailEntry?.actor_id ?? rows.find((x) => x.id === detailId)?.actor_id) as string).slice(0, 8)
            : '—'
        }
        entityLabel={detailEntry ? getEntityLabel(detailEntry.entity) : ''}
        actionLabel={detailEntry ? getActionLabel(detailEntry.action) : ''}
      />
    </div>
  );
}
