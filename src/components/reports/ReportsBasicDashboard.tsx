'use client';

import { Pill } from '@/components/ui/Pill';
import { Stat } from '@/components/ui/Stat';
import {
  AlertIcon,
  CheckIcon,
  ClockIcon,
  DownloadIcon,
  MoonIcon,
  SwapIcon,
  TrendIcon,
  UsersIcon,
} from '@/components/ui/icons';
import { createClient } from '@/lib/supabase/client';
import { fetchProfilesMap } from '@/lib/supabase/queries';
import { useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';

type Props = { orgId: string };

type ReportByUserTypeRow = {
  user_id: string | null;
  shift_type_name: string;
  shift_type_letter: string;
  shift_count: number;
};

type ReportSummaryRow = {
  unassigned_count: number;
  night_count: number;
  weekend_count: number;
};

type ReportRequestsStatusRow = {
  status: string;
  request_count: number;
};

type Period = 'month' | 'quarter' | 'year';

const REQUEST_STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  submitted: 'Enviada',
  accepted: 'Aceptada',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'var(--muted-color)',
  submitted: 'var(--amber)',
  accepted: 'var(--blue)',
  approved: 'var(--green)',
  rejected: 'var(--red)',
  cancelled: 'var(--muted-color)',
};

const MONTH_LABELS = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const PALETTE = ['#0EA5E9', '#8B5CF6', '#14B8A6', '#F97316', '#F59E0B', '#A78BFA', '#EC4899', '#22C55E'];

function colorForUser(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function getInitials(label: string): string {
  const parts = (label || '?').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function periodRange(period: Period, base: Date): { start: Date; end: Date; label: string } {
  if (period === 'month') {
    const start = new Date(base.getFullYear(), base.getMonth(), 1);
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59);
    return { start, end, label: `${start.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}` };
  }
  if (period === 'quarter') {
    const startMonth = Math.max(0, base.getMonth() - 2);
    const start = new Date(base.getFullYear(), startMonth, 1);
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59);
    return {
      start,
      end,
      label: `${start.toLocaleDateString('es-ES', { month: 'short' })} – ${end.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}`,
    };
  }
  const start = new Date(base.getFullYear(), 0, 1);
  const end = new Date(base.getFullYear(), 11, 31, 23, 59, 59);
  return { start, end, label: `${base.getFullYear()}` };
}

export function ReportsBasicDashboard({ orgId }: Props) {
  const [period, setPeriod] = useState<Period>('year');
  const today = useMemo(() => new Date(), []);
  const { start, end, label: periodLabel } = useMemo(() => periodRange(period, today), [period, today]);

  const startISO = start.toISOString();
  const endISO = end.toISOString();

  const swrKey = useMemo(
    () => ['reportsBasic', orgId, startISO, endISO] as const,
    [orgId, startISO, endISO],
  );

  const fetcher = useCallback(async () => {
    const supabase = createClient();

    const [byUserTypeRes, summaryRes, byStatusRes, monthlyRes] = await Promise.all([
      supabase.rpc('report_shift_counts_by_user_type', { p_org_id: orgId, p_from: startISO, p_to: endISO }),
      supabase.rpc('report_shift_counts_summary', { p_org_id: orgId, p_from: startISO, p_to: endISO }),
      supabase.rpc('report_shift_requests_status_counts', { p_org_id: orgId, p_from: startISO, p_to: endISO }),
      supabase
        .from('shifts')
        .select('start_at')
        .eq('org_id', orgId)
        .gte('start_at', startISO)
        .lte('start_at', endISO)
        .limit(20_000),
    ]);

    if (byUserTypeRes.error) throw new Error(byUserTypeRes.error.message);
    if (summaryRes.error) throw new Error(summaryRes.error.message);
    if (byStatusRes.error) throw new Error(byStatusRes.error.message);

    const byUserType = (byUserTypeRes.data ?? []) as unknown as ReportByUserTypeRow[];
    const summary = (summaryRes.data?.[0] ?? {
      unassigned_count: 0,
      night_count: 0,
      weekend_count: 0,
    }) as ReportSummaryRow;
    const byStatus = (byStatusRes.data ?? []) as unknown as ReportRequestsStatusRow[];
    const monthlyRaw = (monthlyRes.data ?? []) as { start_at: string }[];

    const userIds = Array.from(new Set(byUserType.map((r) => r.user_id).filter(Boolean))) as string[];
    const names =
      userIds.length > 0
        ? await fetchProfilesMap(supabase, userIds, { fallbackName: (id) => id.slice(0, 8) })
        : {};

    const userTotals = new Map<string, number>();
    for (const r of byUserType) {
      const uid = r.user_id ?? '__unassigned__';
      userTotals.set(uid, (userTotals.get(uid) || 0) + Number(r.shift_count ?? 0));
    }
    const topUsers = Array.from(userTotals.entries())
      .filter(([uid]) => uid !== '__unassigned__')
      .map(([uid, total]) => ({
        userId: uid,
        label: names[uid] ?? uid.slice(0, 8),
        total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    const statusRows = (byStatus ?? [])
      .map((r) => ({
        status: r.status,
        label: REQUEST_STATUS_LABELS[r.status] ?? r.status,
        count: Number(r.request_count ?? 0),
        color: STATUS_COLORS[r.status] ?? 'var(--muted-color)',
      }))
      .sort((a, b) => b.count - a.count);

    /* Bucket by month for the bar chart. */
    const monthlyMap = new Map<string, number>();
    for (const s of monthlyRaw) {
      const d = new Date(s.start_at);
      const k = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      monthlyMap.set(k, (monthlyMap.get(k) || 0) + 1);
    }

    let monthlyBars: { key: string; label: string; value: number; current: boolean }[] = [];
    if (period === 'year') {
      monthlyBars = Array.from({ length: 12 }, (_, i) => {
        const k = `${start.getFullYear()}-${String(i).padStart(2, '0')}`;
        return {
          key: k,
          label: MONTH_LABELS[i],
          value: monthlyMap.get(k) || 0,
          current: i === today.getMonth() && start.getFullYear() === today.getFullYear(),
        };
      });
    } else if (period === 'quarter') {
      const startM = start.getMonth();
      monthlyBars = Array.from({ length: 3 }, (_, idx) => {
        const m = startM + idx;
        const k = `${start.getFullYear()}-${String(m).padStart(2, '0')}`;
        return {
          key: k,
          label: new Date(start.getFullYear(), m, 1).toLocaleDateString('es-ES', { month: 'short' }),
          value: monthlyMap.get(k) || 0,
          current: m === today.getMonth() && start.getFullYear() === today.getFullYear(),
        };
      });
    } else {
      /* Month: bucket by week of month. */
      const weekly = new Map<number, number>();
      for (const s of monthlyRaw) {
        const d = new Date(s.start_at);
        const week = Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7);
        weekly.set(week, (weekly.get(week) || 0) + 1);
      }
      monthlyBars = Array.from({ length: 5 }, (_, i) => ({
        key: `w${i + 1}`,
        label: `S${i + 1}`,
        value: weekly.get(i + 1) || 0,
        current: false,
      }));
    }

    const total = monthlyRaw.length;
    const assigned = total - Number(summary.unassigned_count ?? 0);
    const coverage = total > 0 ? Math.round((assigned / total) * 100) : 0;

    const swapCount = statusRows.find((r) => r.status === 'approved')?.count ?? 0;
    const totalRequests = statusRows.reduce((a, b) => a + b.count, 0);
    const swapRate = totalRequests > 0 ? Math.round((swapCount / totalRequests) * 100) : 0;

    return {
      total,
      assigned,
      coverage,
      unassignedCount: Number(summary.unassigned_count ?? 0),
      nightCount: Number(summary.night_count ?? 0),
      weekendCount: Number(summary.weekend_count ?? 0),
      topUsers,
      byStatus: statusRows,
      monthlyBars,
      totalRequests,
      swapRate,
    };
  }, [orgId, startISO, endISO, period, start, today]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
  });

  const loading = isLoading || (isValidating && !data);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-subtle-bg" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-subtle-bg" />
        <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
          <div className="h-72 animate-pulse rounded-2xl bg-subtle-bg" />
          <div className="h-72 animate-pulse rounded-2xl bg-subtle-bg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-2xl border border-border bg-subtle-bg p-3 text-[13px] text-red">
        <AlertIcon size={14} />
        <div className="flex-1">
          {String((error as Error).message ?? error)}
          <button
            type="button"
            onClick={() => void mutate()}
            className="ml-2 font-semibold underline hover:no-underline"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const d = data!;
  const monthlyMax = Math.max(1, ...d.monthlyBars.map((b) => b.value));
  const userMax = Math.max(1, ...d.topUsers.map((u) => u.total));
  const statusMax = Math.max(1, ...d.byStatus.map((s) => s.count));

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-full bg-subtle-2 p-1">
          {(['month', 'quarter', 'year'] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={
                'rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ' +
                (period === p ? 'bg-bg text-text shadow-sm' : 'text-text-sec hover:bg-subtle')
              }
            >
              {p === 'month' ? 'Mes' : p === 'quarter' ? 'Trimestre' : 'Año'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-border bg-bg px-3 py-1.5 text-[12px] font-semibold text-text-sec">
            Periodo: {periodLabel}
          </span>
          <button
            type="button"
            disabled
            title="Próximamente"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-semibold text-white opacity-50"
          >
            <DownloadIcon size={14} stroke={2.4} />
            Exportar PDF
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Turnos cubiertos"
          value={d.assigned}
          sub={`de ${d.total} programados`}
          accent="var(--color-primary)"
          icon={<CheckIcon size={15} stroke={2.4} />}
        />
        <Stat
          label="Cobertura"
          value={`${d.coverage}%`}
          sub={
            d.unassignedCount > 0
              ? `${d.unassignedCount} sin asignar`
              : 'Todos los turnos asignados'
          }
          accent={d.coverage >= 85 ? 'var(--green)' : d.coverage >= 70 ? 'var(--amber)' : 'var(--red)'}
          icon={<TrendIcon size={15} stroke={2.4} />}
        />
        <Stat
          label="Tasa de aprobación"
          value={`${d.swapRate}%`}
          sub={`${d.totalRequests} solicitudes`}
          accent="var(--blue)"
          icon={<SwapIcon size={15} stroke={2.4} />}
        />
        <Stat
          label="Nocturnos · finde"
          value={d.nightCount + d.weekendCount}
          sub={`${d.nightCount} noct · ${d.weekendCount} finde`}
          accent="var(--violet)"
          icon={<MoonIcon size={15} stroke={2.4} />}
        />
      </div>

      {/* Bar chart "Turnos por mes" */}
      <section className="rounded-2xl border border-border bg-bg p-5">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="tn-h text-[15px] font-bold">Turnos por {period === 'year' ? 'mes' : period === 'quarter' ? 'mes' : 'semana'}</h2>
            <p className="text-[12px] text-muted">{periodLabel}</p>
          </div>
          <div className="flex items-center gap-2 text-[11.5px] text-muted">
            <ClockIcon size={12} />
            {d.total} turnos en total
          </div>
        </div>
        <div className="flex h-44 items-end gap-2 sm:gap-3">
          {d.monthlyBars.map((b) => {
            const h = (b.value / monthlyMax) * 100;
            return (
              <div key={b.key} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="relative flex h-full w-full items-end">
                  <div
                    className="w-full rounded-t-md transition-[height] duration-500 ease-out"
                    style={{
                      height: `${h}%`,
                      minHeight: b.value > 0 ? 4 : 0,
                      background: b.current
                        ? 'linear-gradient(180deg, var(--color-primary), var(--color-primary-dark))'
                        : 'linear-gradient(180deg, color-mix(in oklab, var(--color-primary) 75%, transparent), color-mix(in oklab, var(--color-primary) 95%, transparent))',
                    }}
                    aria-label={`${b.label}: ${b.value} turnos`}
                  />
                  {b.value > 0 ? (
                    <span
                      className="tn-num pointer-events-none absolute left-1/2 -translate-x-1/2 text-[10.5px] font-bold text-text-sec"
                      style={{ bottom: `calc(${h}% + 4px)` }}
                    >
                      {b.value}
                    </span>
                  ) : null}
                </div>
                <span
                  className={
                    'text-[10.5px] font-semibold ' +
                    (b.current ? 'text-primary' : 'text-muted')
                  }
                >
                  {b.label}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Top usuarios + Solicitudes por estado */}
      <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-border bg-bg p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="tn-h text-[15px] font-bold">Top personas por turnos</h2>
              <p className="text-[12px] text-muted">Quién más cubrió en este período</p>
            </div>
            <UsersIcon size={16} className="text-muted" />
          </div>
          {d.topUsers.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-muted">No hay turnos asignados en el período.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {d.topUsers.map((u, i) => {
                const color = colorForUser(u.userId);
                const w = (u.total / userMax) * 100;
                return (
                  <li key={u.userId} className="flex items-center gap-3">
                    <span className="tn-num w-5 shrink-0 text-center text-[11px] font-bold text-muted">
                      {i + 1}
                    </span>
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10.5px] font-extrabold"
                      style={{
                        background: `color-mix(in oklab, ${color} 22%, transparent)`,
                        color,
                      }}
                      aria-hidden
                    >
                      {getInitials(u.label)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[13px] font-medium text-text">{u.label}</span>
                        <span className="tn-num text-[12px] font-bold text-text-sec">{u.total}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-subtle-2">
                        <div
                          className="h-full rounded-full transition-[width] duration-500 ease-out"
                          style={{
                            width: `${w}%`,
                            background: color,
                          }}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {d.unassignedCount > 0 ? (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-subtle-bg p-3 text-[12.5px]">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-md"
                style={{
                  background: 'color-mix(in oklab, var(--amber) 18%, transparent)',
                  color: 'var(--amber)',
                }}
              >
                <AlertIcon size={12} />
              </span>
              <span className="text-text-sec">
                <strong className="text-text">{d.unassignedCount}</strong> turno{d.unassignedCount === 1 ? '' : 's'} sin asignar en este período
              </span>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-border bg-bg p-5">
          <h2 className="tn-h text-[15px] font-bold">Solicitudes por estado</h2>
          <p className="text-[12px] text-muted">{d.totalRequests} solicitud{d.totalRequests === 1 ? '' : 'es'} en el período</p>

          {d.byStatus.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-muted">Sin solicitudes en el período.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {d.byStatus.map((s) => {
                const w = (s.count / statusMax) * 100;
                const pct = d.totalRequests > 0 ? Math.round((s.count / d.totalRequests) * 100) : 0;
                return (
                  <li key={s.status}>
                    <div className="mb-1 flex items-center justify-between text-[12.5px]">
                      <span className="flex items-center gap-1.5 font-medium text-text">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: s.color }}
                          aria-hidden
                        />
                        {s.label}
                      </span>
                      <span className="text-muted">
                        <span className="tn-num font-bold text-text">{s.count}</span> · {pct}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-subtle-2">
                      <div
                        className="h-full rounded-full transition-[width] duration-500 ease-out"
                        style={{ width: `${w}%`, background: s.color }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
