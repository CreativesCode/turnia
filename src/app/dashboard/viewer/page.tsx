'use client';

import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { Pill } from '@/components/ui/Pill';
import { Stat } from '@/components/ui/Stat';
import { CheckIcon, EyeIcon } from '@/components/ui/icons';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { createClient } from '@/lib/supabase/client';
import { useCallback, useMemo } from 'react';
import useSWR from 'swr';

type ShiftRow = {
  id: string;
  start_at: string;
  end_at: string;
  assigned_user_id: string | null;
  organization_shift_types?: { color?: string | null } | null;
};

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTH_LABELS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ViewerPage() {
  const { orgId, isLoading: orgLoading, error: orgError } = useScheduleOrg();

  const { firstDay, lastDay, monthLabel, today } = useMemo(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return {
      firstDay: first,
      lastDay: last,
      monthLabel: `${MONTH_LABELS[now.getMonth()]} ${now.getFullYear()}`,
      today: now,
    };
  }, []);

  const fetchData = useCallback(async () => {
    if (!orgId) return null;
    const supabase = createClient();
    const [shiftsRes, requestsRes] = await Promise.all([
      supabase
        .from('shifts')
        .select('id, start_at, end_at, assigned_user_id, organization_shift_types(color)')
        .eq('org_id', orgId)
        .gte('start_at', firstDay.toISOString())
        .lte('start_at', lastDay.toISOString()),
      supabase
        .from('shift_requests')
        .select('status', { count: 'exact', head: false })
        .eq('org_id', orgId)
        .gte('created_at', firstDay.toISOString()),
    ]);

    if (shiftsRes.error) throw new Error(shiftsRes.error.message);
    if (requestsRes.error) throw new Error(requestsRes.error.message);

    const rawShifts = (shiftsRes.data ?? []) as ShiftRow[];
    const requests = requestsRes.data ?? [];

    const totalShifts = rawShifts.length;
    const assigned = rawShifts.filter((s) => !!s.assigned_user_id).length;
    const coverage = totalShifts > 0 ? Math.round((assigned / totalShifts) * 100) : 0;

    const requestsResolved = requests.filter((r) =>
      ['approved', 'rejected', 'cancelled'].includes(r.status as string),
    ).length;

    /* Group shifts by day for the mini-calendar dots. */
    const byDay = new Map<string, { color: string; assigned: boolean }[]>();
    for (const s of rawShifts) {
      const k = dayKey(new Date(s.start_at));
      const arr = byDay.get(k);
      const entry = {
        color: s.organization_shift_types?.color || 'var(--color-primary)',
        assigned: !!s.assigned_user_id,
      };
      if (arr) arr.push(entry);
      else byDay.set(k, [entry]);
    }

    return {
      totalShifts,
      assigned,
      coverage,
      requestsResolved,
      byDay,
    };
  }, [orgId, firstDay, lastDay]);

  const { data, isLoading, error } = useSWR(
    orgId ? ['viewerOverview', orgId, firstDay.toISOString(), lastDay.toISOString()] : null,
    fetchData,
    { revalidateOnFocus: true, dedupingInterval: 30_000 },
  );

  /* Build mini-calendar grid (Monday first). */
  const cells = useMemo(() => {
    const first = firstDay;
    const startWeekday = (first.getDay() + 6) % 7; // 0 = Monday
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const grid: Array<{ date: Date | null; isToday: boolean }> = [];
    for (let i = 0; i < startWeekday; i++) grid.push({ date: null, isToday: false });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(first.getFullYear(), first.getMonth(), d);
      grid.push({
        date,
        isToday:
          date.getFullYear() === today.getFullYear() &&
          date.getMonth() === today.getMonth() &&
          date.getDate() === today.getDate(),
      });
    }
    while (grid.length % 7 !== 0) grid.push({ date: null, isToday: false });
    return grid;
  }, [firstDay, today]);

  if (orgLoading || isLoading) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader
          title="Viewer"
          subtitle="Solo lectura: horarios y métricas"
        />
        <div className="rounded-2xl border border-border bg-bg p-8 text-center text-sm text-text-sec">
          Cargando…
        </div>
      </div>
    );
  }

  if (orgError || error) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Viewer" subtitle="Solo lectura" />
        <p className="rounded-2xl border border-border bg-subtle-bg p-4 text-sm text-red">
          {orgError || (error instanceof Error ? error.message : String(error))}
        </p>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Viewer" subtitle="Solo lectura" />
        <p className="rounded-2xl border border-border bg-bg p-4 text-sm text-text-sec">
          No tienes una organización asignada. Contacta a un administrador.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <DashboardDesktopHeader
        title="Viewer"
        subtitle="Solo lectura: horarios y métricas del equipo"
        actions={<Pill tone="muted">Solo lectura</Pill>}
      />

      {/* Banner amber */}
      <div
        className="flex items-start gap-3 rounded-2xl border p-4"
        style={{
          background: 'color-mix(in oklab, var(--amber) 12%, transparent)',
          borderColor: 'color-mix(in oklab, var(--amber) 40%, var(--color-border))',
        }}
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: 'color-mix(in oklab, var(--amber) 22%, transparent)',
            color: 'var(--amber)',
          }}
          aria-hidden
        >
          <EyeIcon size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-text">
            Tienes acceso como Viewer
          </h2>
          <p className="mt-0.5 text-[12.5px] text-text-sec">
            Puedes consultar la planificación y los reportes del equipo, pero no realizar cambios. Para crear o
            modificar turnos pide al administrador que te suba a Staff o Manager.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Cobertura del mes"
          value={`${data?.coverage ?? 0}%`}
          accent={
            data && data.coverage >= 85
              ? 'var(--green)'
              : data && data.coverage >= 70
                ? 'var(--amber)'
                : 'var(--red)'
          }
          icon={<CheckIcon size={16} stroke={2.4} />}
        />
        <Stat
          label="Turnos asignados"
          value={data?.assigned ?? 0}
          sub={`de ${data?.totalShifts ?? 0} programados`}
          accent="var(--color-primary)"
        />
        <Stat
          label="Solicitudes resueltas"
          value={data?.requestsResolved ?? 0}
          sub="este mes"
          accent="var(--blue)"
        />
      </div>

      {/* Mini calendar */}
      <section className="rounded-2xl border border-border bg-bg p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="tn-h text-[14.5px] font-bold">{monthLabel}</h2>
          <span className="text-[11.5px] text-muted">
            {data?.totalShifts ?? 0} turno{data?.totalShifts === 1 ? '' : 's'} este mes
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAY_LABELS.map((d) => (
            <div
              key={d}
              className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted"
            >
              {d}
            </div>
          ))}
          {cells.map((cell, i) => {
            const k = cell.date ? dayKey(cell.date) : '';
            const dayShifts = (cell.date && data?.byDay.get(k)) || [];
            return (
              <div
                key={i}
                className={
                  'flex flex-col items-center justify-start gap-1 rounded-md py-1.5 text-[12px] ' +
                  (cell.date ? 'text-text' : 'text-muted/40') +
                  (cell.isToday ? ' border border-primary bg-primary-soft/40' : '')
                }
              >
                <span
                  className={
                    'tn-num ' +
                    (cell.isToday ? 'font-bold text-primary' : 'font-semibold')
                  }
                >
                  {cell.date ? cell.date.getDate() : ''}
                </span>
                <div className="flex h-1.5 items-center gap-0.5">
                  {dayShifts.slice(0, 3).map((s, j) => (
                    <span
                      key={j}
                      className="block h-1.5 w-1.5 rounded-full"
                      style={{
                        background: s.color,
                        opacity: s.assigned ? 1 : 0.45,
                      }}
                      aria-hidden
                    />
                  ))}
                  {dayShifts.length > 3 ? (
                    <span className="text-[8px] font-bold leading-none text-muted">+</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Asignado
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary opacity-45" />
            Vacante
          </div>
        </div>
      </section>
    </div>
  );
}
