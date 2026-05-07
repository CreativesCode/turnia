'use client';

/**
 * Movimientos: timeline cronológico de solicitudes (donde el usuario es requester
 * o target) agrupado por fecha. Tabs Pills filtran por tipo de operación.
 * Diseño: ref docs/design/screens/extras.jsx MTransactions (línea 227).
 */

import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { Icons, type IconName } from '@/components/ui/icons';
import { Pill, type PillTone } from '@/components/ui/Pill';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { cn } from '@/lib/cn';
import { createClient } from '@/lib/supabase/client';
import { fetchProfilesMap } from '@/lib/supabase/queries';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';

type Row = {
  id: string;
  org_id: string;
  request_type: string;
  status: string;
  comment: string | null;
  created_at: string;
  shift_id: string;
  target_shift_id: string | null;
  target_user_id: string | null;
  requester_id: string;
};

type Tab = 'all' | 'swap' | 'give_away' | 'take_open';

const TAB_LABEL: Record<Tab, string> = {
  all: 'Todos',
  swap: 'Swaps',
  give_away: 'Cesiones',
  take_open: 'Abiertos',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  submitted: 'Pendiente',
  accepted: 'Aceptada',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
};

function statusToTone(status: string): PillTone {
  if (status === 'approved' || status === 'accepted') return 'green';
  if (status === 'rejected') return 'red';
  if (status === 'cancelled') return 'muted';
  return 'amber';
}

function statusToColorVar(status: string): string {
  if (status === 'approved' || status === 'accepted') return 'var(--green)';
  if (status === 'rejected') return 'var(--red)';
  if (status === 'cancelled') return 'var(--muted)';
  return 'var(--amber)';
}

function iconForType(t: string): IconName {
  if (t === 'swap') return 'swap';
  if (t === 'give_away') return 'giveaway';
  return 'takeOpen';
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function groupHeader(date: Date, today: Date): string {
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const dayShort = date.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (isSameDay(date, today)) return `Hoy · ${cap(dayShort)}`;
  if (isSameDay(date, yesterday)) return `Ayer · ${cap(dayShort)}`;
  return cap(dayShort);
}

function formatTimeShort(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function buildEventText(
  row: Row,
  userId: string,
  names: Record<string, string>
): { actor: string; what: string } {
  const requesterName = names[row.requester_id] ?? row.requester_id.slice(0, 8);
  const targetName = row.target_user_id ? names[row.target_user_id] ?? row.target_user_id.slice(0, 8) : null;
  const isMine = row.requester_id === userId;
  const youAreTarget = row.target_user_id === userId;

  if (row.request_type === 'swap') {
    if (isMine) {
      if (row.status === 'submitted') return { actor: 'Tú', what: `pediste un intercambio${targetName ? ` con ${targetName}` : ''}` };
      if (row.status === 'accepted') return { actor: targetName ?? 'La contraparte', what: 'aceptó tu intercambio' };
      if (row.status === 'approved') return { actor: 'Tú', what: 'completaste un intercambio' };
      if (row.status === 'rejected') return { actor: targetName ?? 'La contraparte', what: 'rechazó tu intercambio' };
      if (row.status === 'cancelled') return { actor: 'Tú', what: 'cancelaste un intercambio' };
    }
    if (youAreTarget) {
      if (row.status === 'submitted') return { actor: requesterName, what: 'te pidió un intercambio' };
      if (row.status === 'accepted') return { actor: 'Tú', what: `aceptaste un intercambio con ${requesterName}` };
      if (row.status === 'approved') return { actor: requesterName, what: 'completó un intercambio contigo' };
      if (row.status === 'rejected') return { actor: 'Tú', what: `rechazaste un intercambio de ${requesterName}` };
    }
    return { actor: requesterName, what: 'pidió un intercambio' };
  }

  if (row.request_type === 'give_away') {
    if (isMine) {
      if (row.status === 'submitted' || row.status === 'accepted') return { actor: 'Tú', what: 'pediste ceder un turno' };
      if (row.status === 'approved') return { actor: 'Tú', what: 'cediste tu turno' };
      if (row.status === 'rejected') return { actor: 'Manager', what: 'rechazó tu cesión' };
      if (row.status === 'cancelled') return { actor: 'Tú', what: 'cancelaste una cesión' };
    }
    return { actor: requesterName, what: 'cedió un turno' };
  }

  // take_open
  if (isMine) {
    if (row.status === 'submitted' || row.status === 'accepted') return { actor: 'Tú', what: 'pediste tomar un turno abierto' };
    if (row.status === 'approved') return { actor: 'Tú', what: 'tomaste un turno abierto' };
    if (row.status === 'rejected') return { actor: 'Manager', what: 'rechazó tu solicitud de tomar un turno' };
    if (row.status === 'cancelled') return { actor: 'Tú', what: 'cancelaste tomar un turno' };
  }
  return { actor: requesterName, what: 'tomó un turno abierto' };
}

export default function TransactionsPage() {
  const { orgId, userId, canManageShifts, canApproveRequests, isLoading: orgLoading, error: orgError } = useScheduleOrg();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('all');
  const lastToastErrorRef = useRef<string | null>(null);

  const swrKey = useMemo(() => {
    if (!orgId || !userId) return null;
    return ['transactions', orgId, userId] as const;
  }, [orgId, userId]);

  const fetcher = useCallback(async (): Promise<{ rows: Row[]; names: Record<string, string> }> => {
    if (!orgId || !userId) return { rows: [], names: {} };
    const supabase = createClient();
    const { data, error } = await supabase
      .from('shift_requests')
      .select('id, org_id, request_type, status, comment, created_at, shift_id, target_shift_id, target_user_id, requester_id')
      .eq('org_id', orgId)
      .or(`requester_id.eq.${userId},target_user_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(150);
    if (error) throw new Error(error.message);
    const rows = ((data ?? []) as unknown) as Row[];
    const userIds = new Set<string>();
    rows.forEach((r) => {
      userIds.add(r.requester_id);
      if (r.target_user_id) userIds.add(r.target_user_id);
    });
    const names = userIds.size > 0
      ? await fetchProfilesMap(supabase, Array.from(userIds), { fallbackName: (id) => id.slice(0, 8) })
      : {};
    return { rows, names };
  }, [orgId, userId]);

  const { data, error, isLoading, isValidating } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
  });

  const rows = data?.rows ?? [];
  const names = data?.names ?? {};
  const loading = isLoading || (isValidating && !data);
  const fetchError = error ? String((error as Error).message ?? error) : null;

  useEffect(() => {
    if (!fetchError) return;
    if (lastToastErrorRef.current === fetchError) return;
    lastToastErrorRef.current = fetchError;
    toast({ variant: 'error', title: 'No se pudieron cargar movimientos', message: fetchError });
  }, [fetchError, toast]);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: rows.length, swap: 0, give_away: 0, take_open: 0 };
    for (const r of rows) {
      if (r.request_type === 'swap') c.swap += 1;
      else if (r.request_type === 'give_away') c.give_away += 1;
      else if (r.request_type === 'take_open') c.take_open += 1;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    if (tab === 'all') return rows;
    return rows.filter((r) => r.request_type === tab);
  }, [rows, tab]);

  // Agrupar por día
  const grouped = useMemo(() => {
    if (filtered.length === 0) return [] as Array<{ key: string; label: string; items: Row[] }>;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const map = new Map<string, Row[]>();
    for (const r of filtered) {
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    const groups: Array<{ key: string; label: string; items: Row[] }> = [];
    for (const [key, items] of map) {
      const d = new Date(items[0].created_at);
      d.setHours(0, 0, 0, 0);
      groups.push({ key, label: groupHeader(d, today), items });
    }
    return groups;
  }, [filtered]);

  const detailHrefFor = useCallback(
    (row: Row): string => {
      const isMine = row.requester_id === userId;
      if (canApproveRequests) return `/dashboard/manager/requests?request=${row.id}`;
      if (isMine) return `/dashboard/staff/my-requests?request=${row.id}`;
      return `/dashboard/transactions?request=${row.id}`;
    },
    [userId, canApproveRequests]
  );

  const calendarHref = canManageShifts ? '/dashboard/manager' : '/dashboard/my-shifts';

  if (orgLoading) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Movimientos" subtitle="Historial de solicitudes y cambios" />
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    );
  }

  if (orgError) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Movimientos" subtitle="Historial de solicitudes y cambios" />
        <div className="rounded-2xl border border-border bg-surface p-6">
          <p className="text-sm text-red-600">{orgError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DashboardDesktopHeader
        title="Movimientos"
        subtitle="Historial de solicitudes y cambios"
        actions={
          <Link
            href={calendarHref}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[12.5px] font-semibold text-white transition-transform hover:-translate-y-px"
            style={{ boxShadow: '0 6px 16px -8px var(--primary)' }}
          >
            <Icons.plus size={14} stroke={2.6 as unknown as number} /> Nueva
          </Link>
        }
      />

      <TabsBar tab={tab} counts={counts} onChange={setTab} />

      {loading && rows.length === 0 ? (
        <div className="space-y-2.5">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : grouped.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <div className="space-y-5">
          {grouped.map((g) => (
            <div key={g.key}>
              <p className="mb-2 px-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted">{g.label}</p>
              <div className="overflow-hidden rounded-2xl border border-border bg-surface">
                {g.items.map((r, i) => (
                  <MovementRow
                    key={r.id}
                    row={r}
                    userId={userId ?? ''}
                    names={names}
                    href={detailHrefFor(r)}
                    isLast={i === g.items.length - 1}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabsBar({
  tab,
  counts,
  onChange,
}: {
  tab: Tab;
  counts: Record<Tab, number>;
  onChange: (t: Tab) => void;
}) {
  const items: Tab[] = ['all', 'swap', 'give_away', 'take_open'];
  return (
    <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1">
      {items.map((key) => {
        const active = tab === key;
        const n = counts[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-pressed={active}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold whitespace-nowrap transition-colors',
              active ? 'bg-text text-bg' : 'bg-subtle-2 text-text-sec hover:text-text'
            )}
          >
            {TAB_LABEL[key]}
            {n > 0 ? (
              <span className={cn('text-[10px] font-bold', active ? 'opacity-80' : 'text-muted')}>· {n}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function MovementRow({
  row,
  userId,
  names,
  href,
  isLast,
}: {
  row: Row;
  userId: string;
  names: Record<string, string>;
  href: string;
  isLast: boolean;
}) {
  const Icon = Icons[iconForType(row.request_type)];
  const color = statusToColorVar(row.status);
  const tone = statusToTone(row.status);
  const { actor, what } = buildEventText(row, userId, names);
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-subtle-2/50',
        !isLast ? 'border-b border-border' : ''
      )}
    >
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`, color }}
      >
        <Icon size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] leading-[1.4] text-text">
          <span className="font-bold">{actor}</span> {what}
        </p>
        <p className="mt-0.5 text-[11px] text-muted">{formatTimeShort(row.created_at)}</p>
      </div>
      <Pill tone={tone} dot>
        {STATUS_LABEL[row.status] ?? row.status}
      </Pill>
    </Link>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  const copy = tab === 'all'
    ? 'No tienes movimientos aún.'
    : tab === 'swap'
      ? 'Aún no hay intercambios.'
      : tab === 'give_away'
        ? 'Aún no hay cesiones.'
        : 'Aún no hay solicitudes de turnos abiertos.';
  return (
    <div className="rounded-2xl border border-border bg-surface px-5 py-12 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-subtle-2 text-muted">
        <Icons.history size={18} />
      </div>
      <p className="tn-h text-[15px] font-bold text-text">Sin movimientos</p>
      <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted">{copy}</p>
    </div>
  );
}
