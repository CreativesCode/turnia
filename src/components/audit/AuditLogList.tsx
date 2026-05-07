'use client';

import { Pill, type PillTone } from '@/components/ui/Pill';
import {
  AlertIcon,
  CheckIcon,
  CrossIcon,
  DocIcon,
  PlusIcon,
  SettingsIcon,
  XIcon,
} from '@/components/ui/icons';
import { createClient } from '@/lib/supabase/client';
import { fetchOrgMemberIds, fetchProfilesMap } from '@/lib/supabase/queries';
import * as React from 'react';
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
  swap_accepted_by_target: 'Swap aceptado',
  swap_declined_by_target: 'Swap rechazado',
  update: 'Actualización',
  delete: 'Eliminación',
  accept: 'Invitación aceptada',
};

type Category = 'all' | 'approvals' | 'creations' | 'edits' | 'rejections' | 'system';

const CATEGORIES: ReadonlyArray<{ key: Category; label: string }> = [
  { key: 'all', label: 'Todo' },
  { key: 'approvals', label: 'Aprobaciones' },
  { key: 'creations', label: 'Creaciones' },
  { key: 'edits', label: 'Ediciones' },
  { key: 'rejections', label: 'Rechazos' },
  { key: 'system', label: 'Sistema' },
];

function categoryOf(action: string): Category {
  if (action === 'request_approved' || action === 'swap_accepted_by_target' || action === 'accept') return 'approvals';
  if (action === 'insert') return 'creations';
  if (action === 'update') return 'edits';
  if (action === 'request_rejected' || action === 'swap_declined_by_target') return 'rejections';
  return 'system';
}

type ActionVisual = {
  tone: PillTone;
  color: string;
  Icon: React.FC<{ size?: number; stroke?: number }>;
};

function visualOf(action: string): ActionVisual {
  switch (categoryOf(action)) {
    case 'approvals':
      return { tone: 'green', color: 'var(--green)', Icon: CheckIcon };
    case 'creations':
      return { tone: 'blue', color: 'var(--blue)', Icon: PlusIcon };
    case 'edits':
      return { tone: 'amber', color: 'var(--amber)', Icon: DocIcon };
    case 'rejections':
      return { tone: 'red', color: 'var(--red)', Icon: action.includes('swap') ? CrossIcon : XIcon };
    default:
      return { tone: 'muted', color: 'var(--muted-color)', Icon: SettingsIcon };
  }
}

const PAGE_SIZE = 50;

type Filters = {
  entity: string;
  actorId: string;
  action: string;
  dateFrom: string;
  dateTo: string;
  category: Category;
};

type ActorOption = { id: string; label: string };

type Props = { orgId: string };

function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayHeader(iso: string, today: Date): string {
  const d = new Date(iso);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(d, today)) return `Hoy · ${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  if (sameDay(d, yesterday))
    return `Ayer · ${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

function timeOnly(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getInitials(label: string): string {
  const base = (label || '?').trim();
  const parts = base.split(/\s+|@/).filter(Boolean);
  const a = parts[0]?.[0] ?? '?';
  const b = parts[1]?.[0] ?? '';
  return (a + b).toUpperCase();
}

const ACTOR_PALETTE = ['#0EA5E9', '#8B5CF6', '#14B8A6', '#F97316', '#F59E0B', '#A78BFA', '#EC4899', '#22C55E'];

function colorForActor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return ACTOR_PALETTE[Math.abs(hash) % ACTOR_PALETTE.length];
}

export function AuditLogList({ orgId }: Props) {
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailEntry, setDetailEntry] = useState<AuditLogRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(() => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - 7);
    return {
      entity: '',
      actorId: '',
      action: '',
      dateFrom: toDateInput(from),
      dateTo: toDateInput(now),
      category: 'all',
    };
  });

  const today = useMemo(() => new Date(), []);
  const isLast7Days = useMemo(() => {
    const d7 = new Date();
    d7.setDate(d7.getDate() - 7);
    return filters.dateFrom === toDateInput(d7) && filters.dateTo === toDateInput(new Date());
  }, [filters.dateFrom, filters.dateTo]);

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

  const allRows = listData?.rows ?? [];
  const total = listData?.total ?? 0;
  const names = listData?.names ?? {};
  const loading = listLoading || (isValidating && !listData);
  const error = listError ? String((listError as Error).message ?? listError) : null;

  /* Filter by category client-side (server already filters by other dimensions). */
  const rows = useMemo(() => {
    if (filters.category === 'all') return allRows;
    return allRows.filter((r) => categoryOf(r.action) === filters.category);
  }, [allRows, filters.category]);

  /* Counts by category for the tabs. */
  const counts = useMemo(() => {
    const c: Record<Category, number> = {
      all: allRows.length,
      approvals: 0,
      creations: 0,
      edits: 0,
      rejections: 0,
      system: 0,
    };
    for (const r of allRows) {
      c[categoryOf(r.action)]++;
    }
    return c;
  }, [allRows]);

  /* Group filtered rows by day. */
  const grouped = useMemo(() => {
    const map = new Map<string, AuditListRow[]>();
    for (const r of rows) {
      const k = dayKey(r.created_at);
      const arr = map.get(k);
      if (arr) arr.push(r);
      else map.set(k, [r]);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [rows]);

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

  const setLast7Days = () => {
    const d7 = new Date();
    d7.setDate(d7.getDate() - 7);
    setFilters((f) => ({ ...f, dateFrom: toDateInput(d7), dateTo: toDateInput(new Date()) }));
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Tabs Pills negros con conteo + chip "Últimos 7 días" */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => {
            const active = filters.category === cat.key;
            const n = counts[cat.key];
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setFilters((f) => ({ ...f, category: cat.key }))}
                className={
                  'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors ' +
                  (active ? 'bg-text text-bg' : 'bg-subtle-2 text-text-sec hover:bg-subtle')
                }
              >
                {cat.label}
                {n > 0 ? (
                  <span className="text-[10px] font-bold opacity-70">·{n}</span>
                ) : null}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={setLast7Days}
          className={
            'ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ' +
            (isLast7Days
              ? 'bg-primary text-white'
              : 'border border-border bg-bg text-text-sec hover:bg-subtle-2')
          }
        >
          Últimos 7 días
        </button>
      </div>

      {/* Filtros avanzados (rango + entidad + actor + acción) */}
      <details className="rounded-xl border border-border bg-bg">
        <summary className="cursor-pointer select-none px-4 py-3 text-[12.5px] font-semibold text-text-sec">
          Filtros avanzados
        </summary>
        <div className="grid grid-cols-1 gap-3 p-4 pt-0 sm:grid-cols-3 lg:grid-cols-5">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted">Entidad</span>
            <select
              value={filters.entity}
              onChange={(e) => {
                setFilters((f) => ({ ...f, entity: e.target.value }));
                setPage(1);
              }}
              className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
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
            <span className="text-xs font-semibold text-muted">Actor</span>
            <select
              value={filters.actorId}
              onChange={(e) => {
                setFilters((f) => ({ ...f, actorId: e.target.value }));
                setPage(1);
              }}
              className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
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
            <span className="text-xs font-semibold text-muted">Acción</span>
            <select
              value={filters.action}
              onChange={(e) => {
                setFilters((f) => ({ ...f, action: e.target.value }));
                setPage(1);
              }}
              className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
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
            <span className="text-xs font-semibold text-muted">Desde</span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => {
                setFilters((f) => ({ ...f, dateFrom: e.target.value }));
                setPage(1);
              }}
              className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted">Hasta</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => {
                setFilters((f) => ({ ...f, dateTo: e.target.value }));
                setPage(1);
              }}
              className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
            />
          </label>
        </div>
      </details>

      {error && (
        <p className="flex items-start gap-2 rounded-xl border border-border bg-subtle-bg p-3 text-sm text-red">
          <AlertIcon size={16} />
          {error}
        </p>
      )}

      {loading ? (
        <div className="rounded-2xl border border-border bg-bg p-8 text-center text-sm text-text-sec">
          Cargando…
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-2xl border border-border bg-bg p-8 text-center text-sm text-text-sec">
          No hay eventos en el rango y filtros seleccionados.
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([k, dayRows]) => (
            <section key={k}>
              <div className="mb-2 flex items-center gap-2 px-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted">
                <span>{dayHeader(`${k}T12:00:00`, today)}</span>
                <span className="opacity-50">·</span>
                <span>{dayRows.length} evento{dayRows.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="overflow-hidden rounded-2xl border border-border bg-bg">
                {dayRows.map((r, i) => {
                  const v = visualOf(r.action);
                  const actorName = r.actor_id ? names[r.actor_id] ?? r.actor_id.slice(0, 8) : 'Sistema';
                  const actorColor = r.actor_id ? colorForActor(r.actor_id) : 'var(--muted-color)';
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => void openDetail(r.id)}
                      className={
                        'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-subtle-2/50 ' +
                        (i < dayRows.length - 1 ? 'border-b border-border' : '')
                      }
                    >
                      <span className="tn-num w-12 shrink-0 text-[12px] font-semibold text-muted">
                        {timeOnly(r.created_at)}
                      </span>
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold"
                        style={{
                          background: `color-mix(in oklab, ${actorColor} 22%, transparent)`,
                          color: actorColor,
                        }}
                      >
                        {getInitials(actorName)}
                      </span>
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="truncate text-[13px] text-text">
                          <strong className="font-semibold">{actorName}</strong>{' '}
                          <span className="text-text-sec">· {getActionLabel(r.action).toLowerCase()}</span>{' '}
                          <span
                            className="tn-num truncate rounded-md px-1.5 py-0.5 text-[11.5px]"
                            style={{
                              background: 'var(--subtle-2)',
                              color: 'var(--text-sec)',
                              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                            }}
                          >
                            {getEntityLabel(r.entity)}#{r.entity_id?.slice(0, 6) ?? '—'}
                          </span>
                        </span>
                      </span>
                      <span
                        className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-md md:inline-flex"
                        style={{
                          background: `color-mix(in oklab, ${v.color} 18%, transparent)`,
                          color: v.color,
                        }}
                        aria-hidden
                      >
                        <v.Icon size={13} stroke={2.4} />
                      </span>
                      <Pill tone={v.tone} dot>
                        {CATEGORIES.find((c) => c.key === categoryOf(r.action))?.label ?? 'Sistema'}
                      </Pill>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-text-sec">
            {total} evento{total !== 1 ? 's' : ''} · Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-border bg-bg px-4 py-2 text-sm font-medium text-text hover:bg-subtle-2 disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-border bg-bg px-4 py-2 text-sm font-medium text-text hover:bg-subtle-2 disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
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
