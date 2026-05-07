'use client';

/**
 * Calendario "Mis turnos" en mobile.
 * Diseño: ref docs/design/screens/mobile.jsx MCalendar (línea 301).
 *
 * Renderiza un grid 7×N para el mes con un mini-cuadrito de letra del tipo
 * por día con turno, y debajo la lista de turnos del día seleccionado.
 *
 * Reemplaza al FullCalendar en mobile (sigue siendo desktop-first allí).
 */

import { AppBar, AppBarAction } from '@/components/mobile/AppBar';
import { Pill } from '@/components/ui/Pill';
import { ShiftLetter } from '@/components/ui/ShiftLetter';
import { Skeleton } from '@/components/ui/Skeleton';
import { Icons } from '@/components/ui/icons';
import { getContrastTextColor } from '@/lib/colorContrast';
import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ShiftTypeInfo = {
  id: string;
  name: string;
  letter: string;
  color: string;
  start_time: string | null;
  end_time: string | null;
};

type ShiftRow = {
  id: string;
  org_id: string;
  shift_type_id: string | null;
  status: string;
  start_at: string;
  end_at: string;
  assigned_user_id: string | null;
  location: string | null;
  organization_shift_types: ShiftTypeInfo | ShiftTypeInfo[] | null;
};

function normalizeType(t: ShiftRow['organization_shift_types']): ShiftTypeInfo | null {
  if (!t) return null;
  return (Array.isArray(t) ? t[0] : t) ?? null;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const WEEKDAYS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function durationHours(startAt: string, endAt: string): number {
  const s = new Date(startAt).getTime();
  const e = new Date(endAt).getTime();
  if (!isFinite(s) || !isFinite(e) || e <= s) return 0;
  return (e - s) / (1000 * 60 * 60);
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export type MobileMyShiftsCalendarProps = {
  orgId: string;
  userId: string;
  onSelectShift: (shift: ShiftRow & { organization_shift_types: ShiftTypeInfo | null }) => void;
};

export function MobileMyShiftsCalendar({
  orgId,
  userId,
  onSelectShift,
}: MobileMyShiftsCalendarProps) {
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Rango del mes visible
  const monthStart = useMemo(
    () => new Date(cursor.getFullYear(), cursor.getMonth(), 1, 0, 0, 0, 0),
    [cursor]
  );
  const monthEnd = useMemo(
    () => new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999),
    [cursor]
  );

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from('shifts')
        .select(
          `id, org_id, shift_type_id, status, start_at, end_at, assigned_user_id, location,
           organization_shift_types (id, name, letter, color, start_time, end_time)`
        )
        .eq('org_id', orgId)
        .eq('assigned_user_id', userId)
        .gte('end_at', monthStart.toISOString())
        .lte('start_at', monthEnd.toISOString())
        .order('start_at', { ascending: true })
        .limit(200);
      if (cancelled) return;
      setShifts((data ?? []) as ShiftRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, userId, monthStart, monthEnd]);

  // Map de día → turnos
  const shiftsByDay = useMemo(() => {
    const m: Record<string, ShiftRow[]> = {};
    for (const s of shifts) {
      const k = ymd(new Date(s.start_at));
      if (!m[k]) m[k] = [];
      m[k].push(s);
    }
    return m;
  }, [shifts]);

  // Tipos únicos en el mes (para leyenda)
  const monthTypes = useMemo(() => {
    const map = new Map<string, ShiftTypeInfo>();
    for (const s of shifts) {
      const t = normalizeType(s.organization_shift_types);
      if (t) map.set(t.id, t);
    }
    return [...map.values()];
  }, [shifts]);

  // Grid (42 celdas, 6 semanas, lunes primero)
  const grid = useMemo(() => {
    const firstDow = (monthStart.getDay() + 6) % 7; // 0 = lunes
    const result: Array<{ date: Date; inMonth: boolean }> = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(monthStart);
      d.setDate(d.getDate() - firstDow + i);
      result.push({ date: d, inMonth: d.getMonth() === monthStart.getMonth() });
    }
    return result;
  }, [monthStart]);

  const today = new Date();
  const monthLabel = MONTH_NAMES[cursor.getMonth()];

  const goPrev = useCallback(() => {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  }, []);
  const goNext = useCallback(() => {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  }, []);

  const selectedKey = ymd(selectedDate);
  const selectedShifts = shiftsByDay[selectedKey] ?? [];

  const selectedHeader = useMemo(() => {
    if (sameDay(selectedDate, today)) {
      return `Hoy · ${WEEKDAYS_FULL[selectedDate.getDay()]} ${selectedDate.getDate()}`;
    }
    return `${WEEKDAYS_FULL[selectedDate.getDay()]} ${selectedDate.getDate()}`;
  }, [selectedDate, today]);

  return (
    <div className="space-y-4">
      <AppBar
        title="Mis turnos"
        subtitle={`${monthLabel} ${cursor.getFullYear()}`}
        right={
          <div className="flex gap-2">
            <AppBarAction aria-label="Filtros">
              <Icons.filter size={18} />
            </AppBarAction>
            <AppBarAction aria-label="Buscar">
              <Icons.search size={18} />
            </AppBarAction>
          </div>
        }
      />

      <div className="px-1">
        {/* Navegador mes + segmented */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={goPrev}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-subtle-2 text-text-sec"
              aria-label="Mes anterior"
            >
              <Icons.chevronL size={16} />
            </button>
            <span
              className="tn-h min-w-[96px] text-center text-[18px] font-bold tracking-[-0.015em] text-text"
            >
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={goNext}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-subtle-2 text-text-sec"
              aria-label="Mes siguiente"
            >
              <Icons.chevronR size={16} />
            </button>
          </div>
          <div className="flex rounded-[10px] bg-subtle-2 p-[3px]">
            {['Mes', 'Sem', 'Lista'].map((label, i) => {
              const active = i === 0;
              return (
                <span
                  key={label}
                  className={
                    'rounded-[7px] px-2.5 py-[5px] text-[12px] font-semibold ' +
                    (active
                      ? 'bg-bg text-text shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                      : 'text-muted')
                  }
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Header de días */}
        <div className="mb-1.5 grid grid-cols-7">
          {DAY_LABELS.map((d) => (
            <div key={d} className="pb-1.5 text-center text-[11px] font-semibold text-muted">
              {d}
            </div>
          ))}
        </div>

        {/* Grid de días */}
        {loading ? (
          <Skeleton className="h-72 w-full rounded-xl" />
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {grid.map((cell, i) => {
              const k = ymd(cell.date);
              const dayShifts = shiftsByDay[k] ?? [];
              const isToday = sameDay(cell.date, today);
              const isSelected = sameDay(cell.date, selectedDate);
              const showShift = dayShifts[0] ? normalizeType(dayShifts[0].organization_shift_types) : null;

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedDate(new Date(cell.date))}
                  className="flex aspect-square flex-col items-center gap-1 rounded-[10px] pt-1.5"
                  style={{
                    backgroundColor: isToday
                      ? 'color-mix(in oklab, var(--primary) 12%, transparent)'
                      : isSelected
                        ? 'var(--subtle)'
                        : 'transparent',
                    border: isToday
                      ? '1.5px solid var(--primary)'
                      : isSelected
                        ? '1px solid var(--border-color)'
                        : '1px solid transparent',
                    opacity: cell.inMonth ? 1 : 0.4,
                  }}
                  aria-pressed={isSelected}
                  aria-label={`${cell.date.toLocaleDateString('es-ES')}${dayShifts.length > 0 ? ` · ${dayShifts.length} turno${dayShifts.length === 1 ? '' : 's'}` : ''}`}
                >
                  <span
                    className="text-[13px]"
                    style={{
                      color: isToday ? 'var(--primary)' : 'var(--text)',
                      fontWeight: isToday ? 700 : 500,
                    }}
                  >
                    {cell.date.getDate()}
                  </span>
                  {showShift ? (
                    <span
                      className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-extrabold"
                      style={{
                        backgroundColor: showShift.color,
                        color: getContrastTextColor(showShift.color),
                      }}
                      aria-hidden
                    >
                      {showShift.letter || '?'}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}

        {/* Leyenda de tipos */}
        {monthTypes.length > 0 ? (
          <div className="mt-3.5 flex flex-wrap gap-2">
            {monthTypes.map((t) => (
              <Pill key={t.id} color={t.color} dot>
                {t.name}
              </Pill>
            ))}
          </div>
        ) : null}
      </div>

      {/* Detalle del día seleccionado */}
      <div>
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="tn-h text-[15px] font-bold text-text">{selectedHeader}</h2>
          <span className="text-[12px] text-muted">
            {selectedShifts.length === 0
              ? 'Sin turnos'
              : selectedShifts.length === 1
                ? '1 turno'
                : `${selectedShifts.length} turnos`}
          </span>
        </div>
        {selectedShifts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-5">
            <p className="text-[13px] text-muted">No tienes turnos este día.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedShifts.map((s) => {
              const t = normalizeType(s.organization_shift_types);
              const color = t?.color ?? '#14B8A6';
              const time = `${formatTime(s.start_at)} — ${formatTime(s.end_at)}`;
              const dur = durationHours(s.start_at, s.end_at);
              const typeName = t?.name ?? 'Turno';
              const location = s.location?.trim();
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() =>
                    onSelectShift({
                      ...s,
                      organization_shift_types: t,
                    })
                  }
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-subtle p-3.5 text-left"
                >
                  <ShiftLetter letter={t?.letter ?? '?'} color={color} size={42} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-text">
                      {typeName}
                      {location ? <span className="text-text-sec"> · {location}</span> : null}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] text-muted">
                      {time}
                      {dur > 0 ? ` · ${Math.round(dur)}h` : ''}
                    </p>
                  </div>
                  <Pill tone="primary">Tuyo</Pill>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
