'use client';

/**
 * Right rail del calendario manager (320px en desktop).
 * Diseño: ref docs/design/screens/desktop.jsx DCalendar (línea 232) — secciones
 * "Hoy", "Tipos de turno" y "Cobertura del mes".
 */

import { Pill } from '@/components/ui/Pill';
import { ShiftLetter } from '@/components/ui/ShiftLetter';
import { Skeleton } from '@/components/ui/Skeleton';
import { Icons } from '@/components/ui/icons';
import { createClient } from '@/lib/supabase/client';
import { fetchProfilesMap } from '@/lib/supabase/queries';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type ShiftTypeInfo = {
  id: string;
  name: string;
  letter: string;
  color: string;
  start_time: string | null;
  end_time: string | null;
};

type TodayRow = {
  id: string;
  start_at: string;
  end_at: string;
  assigned_user_id: string | null;
  organization_shift_types: ShiftTypeInfo | ShiftTypeInfo[] | null;
};

function normalizeType(t: TodayRow['organization_shift_types']): ShiftTypeInfo | null {
  if (!t) return null;
  return (Array.isArray(t) ? t[0] : t) ?? null;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function todayHeader(): string {
  const d = new Date();
  const wd = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][d.getDay()];
  return `Hoy · ${wd} ${d.getDate()}`;
}

export type CalendarRightRailProps = {
  orgId: string;
  /** Cambiar este número para forzar refresh tras edits. */
  refreshKey?: number;
  /** Callback al hacer click en un turno (abre el detalle). */
  onSelectShift?: (shiftId: string) => void;
};

/**
 * Wrapper del rail con las 3 secciones en orden.
 */
export function CalendarRightRail({ orgId, refreshKey, onSelectShift }: CalendarRightRailProps) {
  return (
    <aside className="space-y-4">
      <TodayShiftsRail orgId={orgId} refreshKey={refreshKey} onSelectShift={onSelectShift} />
      <ShiftTypesLegendRail orgId={orgId} refreshKey={refreshKey} />
      <MonthCoverageRail orgId={orgId} refreshKey={refreshKey} />
    </aside>
  );
}

// ────────────────────────────────────────────────
// Sección 1: Turnos de hoy
// ────────────────────────────────────────────────

function TodayShiftsRail({
  orgId,
  refreshKey,
  onSelectShift,
}: {
  orgId: string;
  refreshKey?: number;
  onSelectShift?: (shiftId: string) => void;
}) {
  const [shifts, setShifts] = useState<TodayRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from('shifts')
        .select(
          `id, start_at, end_at, assigned_user_id,
           organization_shift_types (id, name, letter, color, start_time, end_time)`
        )
        .eq('org_id', orgId)
        .gte('start_at', startOfDay.toISOString())
        .lte('start_at', endOfDay.toISOString())
        .order('start_at', { ascending: true })
        .limit(8);
      if (cancelled) return;

      const list = (data ?? []) as TodayRow[];
      setShifts(list);

      const ids = [...new Set(list.map((s) => s.assigned_user_id).filter(Boolean))] as string[];
      if (ids.length > 0) {
        const map = await fetchProfilesMap(supabase, ids);
        if (!cancelled) setNames(map);
      } else {
        setNames({});
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, refreshKey]);

  const header = todayHeader();

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="tn-h text-[14px] font-bold text-text">{header}</h3>
        <span className="text-[11px] text-muted">
          {loading ? '…' : shifts.length === 1 ? '1 turno' : `${shifts.length} turnos`}
        </span>
      </div>

      <div className="px-3 py-3">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : shifts.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted">No hay turnos hoy.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {shifts.map((s) => {
              const t = normalizeType(s.organization_shift_types);
              const isUnassigned = !s.assigned_user_id;
              const name = isUnassigned
                ? 'Sin asignar'
                : (s.assigned_user_id && names[s.assigned_user_id]) || 'Asignado';
              const color = t?.color ?? '#94A3B8';
              const letter = t?.letter ?? '?';
              const time = `${formatTime(s.start_at)} — ${formatTime(s.end_at)}`;
              const typeName = t?.name ?? 'Turno';

              const cardStyle: React.CSSProperties = isUnassigned
                ? {
                    backgroundColor: 'color-mix(in oklab, var(--amber) 8%, transparent)',
                    borderColor: 'color-mix(in oklab, var(--amber) 55%, transparent)',
                  }
                : {};

              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelectShift?.(s.id)}
                  className="flex items-center gap-2.5 rounded-xl border border-border bg-subtle p-2.5 text-left transition-colors hover:border-border-strong"
                  style={cardStyle}
                >
                  <ShiftLetter letter={letter} color={color} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-text">{name}</p>
                    <p className="mt-0.5 truncate text-[10.5px] text-muted">
                      {time} · {typeName}
                    </p>
                  </div>
                  {isUnassigned ? <Pill tone="amber">Abierto</Pill> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// Sección 2: Tipos de turno (leyenda con horario)
// ────────────────────────────────────────────────

function ShiftTypesLegendRail({
  orgId,
  refreshKey,
}: {
  orgId: string;
  refreshKey?: number;
}) {
  const [types, setTypes] = useState<ShiftTypeInfo[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    setLoading(true);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    (async () => {
      const [typesRes, shiftsRes] = await Promise.all([
        supabase
          .from('organization_shift_types')
          .select('id, name, letter, color, start_time, end_time')
          .eq('org_id', orgId)
          .order('name', { ascending: true }),
        supabase
          .from('shifts')
          .select('shift_type_id')
          .eq('org_id', orgId)
          .gte('start_at', monthStart.toISOString())
          .lte('start_at', monthEnd.toISOString())
          .limit(2000),
      ]);
      if (cancelled) return;
      setTypes((typesRes.data ?? []) as ShiftTypeInfo[]);

      const c: Record<string, number> = {};
      for (const r of (shiftsRes.data ?? []) as Array<{ shift_type_id: string | null }>) {
        if (!r.shift_type_id) continue;
        c[r.shift_type_id] = (c[r.shift_type_id] ?? 0) + 1;
      }
      setCounts(c);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, refreshKey]);

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h3 className="tn-h mb-3 text-[14px] font-bold text-text">Tipos de turno</h3>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      ) : types.length === 0 ? (
        <p className="text-sm text-muted">Sin tipos configurados.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {types.map((t) => {
            const time =
              t.start_time && t.end_time
                ? `${t.start_time.slice(0, 5)} — ${t.end_time.slice(0, 5)}`
                : 'Día completo';
            return (
              <div key={t.id} className="flex items-center gap-2.5 text-[12.5px]">
                <ShiftLetter
                  letter={t.letter || '?'}
                  color={t.color || '#14B8A6'}
                  size={18}
                  aria-hidden
                />
                <span className="flex-1 font-medium text-text">{t.name}</span>
                <span className="text-muted">{time}</span>
                <span
                  className="min-w-[22px] text-right font-semibold text-text"
                  title={`${counts[t.id] ?? 0} turnos este mes`}
                >
                  {counts[t.id] ?? 0}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// Sección 3: Cobertura del mes
// ────────────────────────────────────────────────

type CoverageData = {
  totalShifts: number;
  totalHours: number;
  unassignedShifts: number;
};

function MonthCoverageRail({
  orgId,
  refreshKey,
}: {
  orgId: string;
  refreshKey?: number;
}) {
  const [data, setData] = useState<CoverageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    setLoading(true);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    (async () => {
      const [stats, unassigned] = await Promise.all([
        supabase.rpc('shift_hours_stats', {
          p_org_id: orgId,
          p_from: monthStart.toISOString(),
          p_to: monthEnd.toISOString(),
          p_user_id: null,
        }),
        supabase
          .from('shifts')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .is('assigned_user_id', null)
          .gte('start_at', monthStart.toISOString())
          .lte('start_at', monthEnd.toISOString()),
      ]);
      if (cancelled) return;
      const agg = (stats.data as Array<{ shift_count: number; total_hours: number | string }> | null | undefined)?.[0];
      const totalShifts = Number(agg?.shift_count ?? 0);
      const totalHours = Number(agg?.total_hours ?? 0);
      const unassignedShifts = unassigned.count ?? 0;
      setData({ totalShifts, totalHours, unassignedShifts });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, refreshKey]);

  // Aproximación de cobertura: turnos asignados vs totales.
  const pct = useMemo(() => {
    if (!data || data.totalShifts === 0) return 0;
    const assigned = data.totalShifts - data.unassignedShifts;
    return Math.max(0, Math.min(100, Math.round((assigned / data.totalShifts) * 100)));
  }, [data]);

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h3 className="tn-h mb-3 text-[14px] font-bold text-text">Cobertura del mes</h3>
      {loading ? (
        <Skeleton className="h-12 w-full" />
      ) : !data || data.totalShifts === 0 ? (
        <p className="text-sm text-muted">Aún no hay turnos en este mes.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-1.5">
            <span className="tn-h text-[32px] font-extrabold leading-none tracking-[-0.02em] text-text">
              {pct}
              <span className="ml-0.5 text-[18px] text-muted">%</span>
            </span>
            {data.unassignedShifts > 0 ? (
              <Pill tone="amber">{data.unassignedShifts} sin asignar</Pill>
            ) : (
              <Pill tone="green">Cubierto</Pill>
            )}
          </div>

          {/* Barra de progreso simple */}
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-subtle-2">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${pct}%` }}
            />
          </div>

          <p className="mt-2.5 text-[11px] leading-[1.6] text-muted">
            <span className="font-semibold text-text">{Math.round(data.totalHours)}h</span>{' '}
            programadas en{' '}
            <span className="font-semibold text-text">{data.totalShifts} turnos</span>
            {data.unassignedShifts > 0 ? (
              <>
                . <Icons.alert size={11} className="inline align-text-bottom text-amber" />{' '}
                <span className="font-semibold text-amber">{data.unassignedShifts}</span> sin
                cubrir.
              </>
            ) : null}
          </p>
        </>
      )}
    </div>
  );
}
