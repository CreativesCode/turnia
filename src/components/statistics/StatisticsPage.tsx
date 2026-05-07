'use client';

/**
 * Página "Mis estadísticas": hero gradiente teal con sparkline + tipos + KPIs 2x2.
 * Diseño: ref docs/design/screens/extras.jsx MStatistics (línea 287).
 */

import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { Icons } from '@/components/ui/icons';
import { Skeleton } from '@/components/ui/Skeleton';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { useStatistics } from '@/hooks/useStatistics';
import { useCallback, useMemo, useState } from 'react';
import { StatisticsFilters } from './StatisticsFilters';

const MONTH_INITIALS = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

function formatHours(h: number): string {
  if (!isFinite(h) || h <= 0) return '0h';
  if (h < 10) return `${Math.round(h * 10) / 10}h`;
  return `${Math.round(h).toLocaleString('es-ES')}h`;
}

function rangeLabel(start: Date, end: Date): string {
  const sameYear = start.getFullYear() === end.getFullYear();
  const fmt = (d: Date) =>
    d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: sameYear ? undefined : '2-digit' });
  return `${fmt(start)} – ${fmt(end)}`;
}

export default function StatisticsPage() {
  const { orgId, userId, isLoading: orgLoading, error: orgError } = useScheduleOrg();
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    return { start, end };
  });

  const { data, isLoading, error } = useStatistics(orgId, dateRange.start, dateRange.end, userId ?? undefined);

  const handleDateRangeChange = useCallback((start: Date, end: Date) => {
    setDateRange({ start, end });
  }, []);

  const subtitle = useMemo(() => `${rangeLabel(dateRange.start, dateRange.end)}`, [dateRange]);

  if (orgLoading) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Mis estadísticas" subtitle="Tu actividad" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (orgError) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Mis estadísticas" subtitle="Tu actividad" />
        <div className="rounded-2xl border border-border bg-surface p-6">
          <p className="text-sm text-red-600">{orgError}</p>
        </div>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Mis estadísticas" subtitle="Tu actividad" />
        <div className="rounded-2xl border border-border bg-surface p-6">
          <p className="text-sm text-muted">No tienes una organización asignada.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DashboardDesktopHeader
        title="Mis estadísticas"
        subtitle={subtitle}
      />

      <StatisticsFilters
        startDate={dateRange.start}
        endDate={dateRange.end}
        onDateRangeChange={handleDateRangeChange}
        showUserFilter={false}
      />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">Error al cargar: {error}</p>
        </div>
      ) : !data ? (
        <div className="rounded-2xl border border-border bg-surface p-6">
          <p className="text-sm text-muted">No hay datos para el período seleccionado.</p>
        </div>
      ) : (
        <>
          <HeroKpi data={data} dateRange={dateRange} />
          <div className="grid gap-3 md:grid-cols-2">
            <ByTypeCard data={data.shiftsByType} totalHours={data.totalHours} />
            <ComparativeKpis data={data} />
          </div>
        </>
      )}
    </div>
  );
}

function HeroKpi({
  data,
  dateRange,
}: {
  data: { totalHours: number; totalShifts: number; shiftsByDate: Array<{ date: string; hours: number }> };
  dateRange: { start: Date; end: Date };
}) {
  // Agrupar shiftsByDate por mes para los 12 meses (sólo cuando el rango cubre el año)
  const monthlyData = useMemo(() => {
    const totals = Array.from({ length: 12 }, () => 0);
    for (const r of data.shiftsByDate) {
      const d = new Date(r.date);
      if (isNaN(d.getTime())) continue;
      if (d.getFullYear() !== dateRange.start.getFullYear()) continue;
      totals[d.getMonth()] += r.hours;
    }
    return totals;
  }, [data.shiftsByDate, dateRange.start]);

  const max = Math.max(1, ...monthlyData);
  const yearLabel = dateRange.start.getFullYear();

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 text-white md:p-6"
      style={{
        background: 'linear-gradient(135deg, var(--primary), var(--primary-dark, var(--primary)))',
        boxShadow: '0 24px 50px -28px var(--primary)',
      }}
    >
      {/* Patrón concéntrico */}
      <svg
        aria-hidden
        width="500"
        height="500"
        viewBox="0 0 100 100"
        className="pointer-events-none absolute -right-44 -top-44 opacity-[0.16]"
      >
        <circle cx="50" cy="50" r="48" stroke="#fff" strokeWidth=".4" fill="none" />
        <circle cx="50" cy="50" r="34" stroke="#fff" strokeWidth=".4" fill="none" />
        <circle cx="50" cy="50" r="20" stroke="#fff" strokeWidth=".4" fill="none" />
      </svg>

      <p className="relative text-[11px] font-bold uppercase tracking-[0.08em] opacity-90">
        Total este período
      </p>
      <p
        className="tn-h relative mt-1.5 text-[40px] font-extrabold leading-none md:text-[44px]"
        style={{ fontFamily: 'var(--font-inter-tight), var(--font-inter), system-ui, sans-serif' }}
      >
        {formatHours(data.totalHours)}
      </p>
      <p className="relative mt-1 text-[12.5px] opacity-95">
        {data.totalShifts} {data.totalShifts === 1 ? 'turno' : 'turnos'} · {yearLabel}
      </p>

      {/* Sparkline */}
      <div className="relative mt-4 flex h-[70px] items-end gap-1">
        {monthlyData.map((v, i) => {
          const pct = max > 0 ? Math.max(2, (v / max) * 100) : 2;
          return (
            <div
              key={i}
              className="flex-1 rounded-sm bg-white/60 transition-all"
              style={{ height: `${pct}%` }}
              title={`${MONTH_INITIALS[i]}: ${formatHours(v)}`}
            />
          );
        })}
      </div>
      <div className="relative mt-1.5 flex justify-between text-[9.5px] font-semibold opacity-80">
        {MONTH_INITIALS.map((m, i) => (
          <span key={i}>{m}</span>
        ))}
      </div>
    </div>
  );
}

function ByTypeCard({
  data,
  totalHours,
}: {
  data: Array<{ typeName: string; count: number; hours: number; color: string }>;
  totalHours: number;
}) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4 md:p-5">
        <p className="tn-h mb-3 text-[14px] font-bold text-text">Por tipo de turno</p>
        <p className="text-[12.5px] text-muted">Aún no hay turnos registrados en este período.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 md:p-5">
      <p className="tn-h mb-4 text-[14px] font-bold text-text">Por tipo de turno</p>
      <div className="space-y-3.5">
        {data.map((r) => {
          const pct = totalHours > 0 ? Math.round((r.hours / totalHours) * 100) : 0;
          return (
            <div key={r.typeName}>
              <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block h-2 w-2 rounded-sm"
                    style={{ backgroundColor: r.color }}
                  />
                  <span className="text-text">{r.typeName}</span>
                </span>
                <span className="text-muted">
                  {formatHours(r.hours)} · {pct}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-subtle-2">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: r.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ComparativeKpis({
  data,
}: {
  data: {
    totalShifts: number;
    requestsStats: { total: number; approved: number; rejected: number; pending: number };
    shiftsByDate: Array<{ date: string; count: number }>;
    shiftsByDayOfWeek: Array<{ day: string; count: number }>;
  };
}) {
  const distinctDays = data.shiftsByDate.length;
  const successRate = useMemo(() => {
    const decided = data.requestsStats.approved + data.requestsStats.rejected;
    if (decided === 0) return null;
    return Math.round((data.requestsStats.approved / decided) * 100);
  }, [data.requestsStats]);
  const topDay = useMemo(() => {
    if (!data.shiftsByDayOfWeek.length) return null;
    const sorted = [...data.shiftsByDayOfWeek].sort((a, b) => b.count - a.count);
    return sorted[0];
  }, [data.shiftsByDayOfWeek]);

  const items = [
    {
      label: 'Turnos',
      value: String(data.totalShifts),
      sub: `${distinctDays} ${distinctDays === 1 ? 'día' : 'días'} distintos`,
      color: 'var(--primary)',
    },
    {
      label: 'Aprobadas',
      value: String(data.requestsStats.approved),
      sub: successRate !== null ? `${successRate}% éxito` : 'sin solicitudes',
      color: 'var(--green)',
    },
    {
      label: 'Pendientes',
      value: String(data.requestsStats.pending),
      sub: data.requestsStats.pending > 0 ? 'esperan aprobación' : 'al día',
      color: data.requestsStats.pending > 0 ? 'var(--amber)' : 'var(--muted)',
    },
    {
      label: 'Día top',
      value: topDay?.day ?? '—',
      sub: topDay ? `${topDay.count} turno${topDay.count === 1 ? '' : 's'}` : 'sin datos',
      color: 'var(--blue)',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {items.map((it) => (
        <div key={it.label} className="rounded-2xl border border-border bg-surface p-3.5">
          <p className="text-[11px] font-semibold text-muted">{it.label}</p>
          <p
            className="tn-h mt-1 text-[22px] font-extrabold tracking-[-0.02em]"
            style={{
              color: it.color,
              fontFamily: 'var(--font-inter-tight), var(--font-inter), system-ui, sans-serif',
            }}
          >
            {it.value}
          </p>
          <p className="mt-0.5 text-[10.5px] text-muted">{it.sub}</p>
        </div>
      ))}
    </div>
  );
}

export { StatisticsPage };
