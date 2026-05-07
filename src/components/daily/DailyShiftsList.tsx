'use client';

/**
 * Vista de "Agenda del día": timeline horizontal con eje horario y una fila
 * por persona, mostrando sus turnos como barras posicionadas por hora.
 * Diseño: ref docs/design/screens/extras.jsx MDailySchedule (línea 180).
 */

import type { ShiftWithType } from '@/components/calendar/ShiftCalendar';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { createClient } from '@/lib/supabase/client';
import { fetchMembershipStaffPositionsMap } from '@/lib/supabase/queries';
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';

type PersonWithShifts = {
  userId: string;
  fullName: string;
  staffPosition: string | null;
  shifts: ShiftWithType[];
};

type DailyShiftsData = {
  people: PersonWithShifts[];
  unassignedShifts: ShiftWithType[];
};

const SHORT_WEEKDAY = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const SHORT_MONTH = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatLongDateCap(date: Date): string {
  const s = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function shortDayPillLabel(date: Date, today: Date): string {
  if (isSameDay(date, today)) return 'Hoy';
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (isSameDay(date, tomorrow)) return 'Mañana';
  const wd = SHORT_WEEKDAY[date.getDay()];
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${date.getDate()}`;
}

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase() || 'U'
  );
}

function colorForUser(userId: string): string {
  const palette = ['#0EA5E9', '#8B5CF6', '#14B8A6', '#F97316', '#F59E0B', '#A78BFA', '#EC4899', '#22C55E'];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

async function fetchDailyShifts(orgId: string, date: Date): Promise<DailyShiftsData> {
  const supabase = createClient();

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const { data: shiftsData, error: shiftsErr } = await supabase
    .from('shifts')
    .select(
      `
      id, org_id, shift_type_id, status, start_at, end_at, assigned_user_id, location,
      organization_shift_types (id, name, letter, color, start_time, end_time)
    `
    )
    .eq('org_id', orgId)
    .gte('start_at', startOfDay.toISOString())
    .lte('start_at', endOfDay.toISOString())
    .order('start_at', { ascending: true });

  if (shiftsErr) throw new Error(shiftsErr.message);

  const raw = (shiftsData ?? []) as Array<
    ShiftWithType & {
      organization_shift_types?: ShiftWithType['organization_shift_types'] | ShiftWithType['organization_shift_types'][];
    }
  >;

  const shifts: ShiftWithType[] = raw.map((s) => {
    const ot = s.organization_shift_types;
    const single = Array.isArray(ot) ? ot[0] ?? null : ot ?? null;
    return { ...s, organization_shift_types: single } as ShiftWithType;
  });

  const userIds = [...new Set(shifts.map((s) => s.assigned_user_id).filter(Boolean))] as string[];
  const profilesMap: Record<string, { full_name: string | null }> = {};

  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
    if (profiles) {
      for (const profile of profiles) profilesMap[profile.id] = { full_name: profile.full_name };
    }
  }

  const staffPositionsMap = await fetchMembershipStaffPositionsMap(supabase, orgId);

  const peopleMap = new Map<string, PersonWithShifts>();
  const unassignedShifts: ShiftWithType[] = [];

  for (const shift of shifts) {
    if (!shift.assigned_user_id) {
      unassignedShifts.push(shift);
      continue;
    }
    if (!peopleMap.has(shift.assigned_user_id)) {
      const profile = profilesMap[shift.assigned_user_id];
      const staffPosition = staffPositionsMap[shift.assigned_user_id] || null;
      peopleMap.set(shift.assigned_user_id, {
        userId: shift.assigned_user_id,
        fullName: profile?.full_name?.trim() || 'Sin nombre',
        staffPosition,
        shifts: [],
      });
    }
    peopleMap.get(shift.assigned_user_id)!.shifts.push(shift);
  }

  const people = Array.from(peopleMap.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
  return { people, unassignedShifts };
}

type Props = {
  orgId: string;
  date?: Date;
  currentUserId?: string | null;
  onShiftClick?: (shift: ShiftWithType, assignedName: string | null) => void;
};

export function DailyShiftsList({ orgId, date = new Date(), currentUserId, onShiftClick }: Props) {
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const dateKey = useMemo(() => {
    const d = selectedDate;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [selectedDate]);

  const swrKey = orgId ? ['dailyShifts', orgId, dateKey] : null;
  const { data, error, isLoading, mutate } = useSWR<DailyShiftsData>(
    swrKey,
    () => fetchDailyShifts(orgId, selectedDate),
    { revalidateOnFocus: true, revalidateOnReconnect: true }
  );

  // Realtime updates de turnos
  useEffect(() => {
    if (!orgId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`daily-shifts:${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shifts', filter: `org_id=eq.${orgId}` },
        () => {
          setTimeout(() => void mutate(), 500);
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId, mutate]);

  // Reloj para la línea "ahora"
  const [nowTs, setNowTs] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const dayPills = useMemo(() => {
    return [0, 1, 2].map((offset) => {
      const d = new Date(today);
      d.setDate(today.getDate() + offset);
      return d;
    });
  }, [today]);

  const handlePickDay = useCallback((d: Date) => {
    const next = new Date(d);
    next.setHours(0, 0, 0, 0);
    setSelectedDate(next);
  }, []);

  const isSelectedToday = isSameDay(selectedDate, today);

  // Calcular ventana horaria del eje
  const allShifts = useMemo(() => {
    if (!data) return [] as ShiftWithType[];
    return [...data.people.flatMap((p) => p.shifts), ...data.unassignedShifts];
  }, [data]);

  const axis = useMemo(() => {
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(23, 59, 59, 999);

    let minH = 8;
    let maxH = 22;

    if (allShifts.length > 0) {
      let min = Infinity;
      let max = -Infinity;
      for (const s of allShifts) {
        const st = new Date(s.start_at);
        const en = new Date(s.end_at);
        const startH = clamp(st < dayStart ? 0 : st.getHours() + st.getMinutes() / 60, 0, 24);
        const endH = clamp(en > dayEnd ? 24 : en.getHours() + en.getMinutes() / 60, 0, 24);
        if (startH < min) min = startH;
        if (endH > max) max = endH;
      }
      minH = Math.max(0, Math.floor(min));
      maxH = Math.min(24, Math.ceil(max));
      if (maxH - minH < 8) {
        const pad = Math.ceil((8 - (maxH - minH)) / 2);
        minH = Math.max(0, minH - pad);
        maxH = Math.min(24, maxH + pad);
      }
    }

    const span = Math.max(1, maxH - minH);
    const ticks: number[] = [];
    const step = span <= 8 ? 1 : 2;
    for (let h = minH; h <= maxH; h += step) ticks.push(h);
    if (ticks[ticks.length - 1] !== maxH) ticks.push(maxH);
    return { minH, maxH, span, ticks };
  }, [allShifts, selectedDate]);

  const nowPercent = useMemo(() => {
    if (!isSelectedToday) return null;
    const now = new Date(nowTs);
    const h = now.getHours() + now.getMinutes() / 60;
    if (h < axis.minH || h > axis.maxH) return null;
    return ((h - axis.minH) / axis.span) * 100;
  }, [isSelectedToday, nowTs, axis]);

  const nowTimeLabel = useMemo(() => {
    const d = new Date(nowTs);
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }, [nowTs]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6">
        <p className="text-[13px] text-muted">Cargando agenda del día…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6">
        <p className="text-[13px] text-red-600">Error al cargar turnos: {error.message}</p>
        <button
          type="button"
          onClick={() => void mutate()}
          className="mt-2 text-[12.5px] font-semibold text-primary hover:underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { people, unassignedShifts } = data;
  const totalShifts = people.reduce((sum, p) => sum + p.shifts.length, 0) + unassignedShifts.length;

  return (
    <div className="space-y-3">
      {/* Selector de día */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-1.5">
          {dayPills.map((d) => {
            const active = isSameDay(d, selectedDate);
            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => handlePickDay(d)}
                aria-pressed={active}
                className={cn(
                  'inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors',
                  active ? 'bg-text text-bg' : 'bg-subtle-2 text-text-sec hover:text-text'
                )}
              >
                {shortDayPillLabel(d, today)}
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        <p className="text-[12.5px] text-text-sec">
          <span className="font-semibold text-text">{formatLongDateCap(selectedDate)}</span>
          <span className="ml-2 text-muted">
            · {totalShifts} {totalShifts === 1 ? 'turno' : 'turnos'} · {people.length} {people.length === 1 ? 'persona' : 'personas'}
            {unassignedShifts.length > 0 ? ` · ${unassignedShifts.length} sin asignar` : ''}
          </span>
        </p>
      </div>

      {/* Timeline */}
      {totalShifts === 0 ? (
        <div className="rounded-2xl border border-border bg-surface px-5 py-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-subtle-2 text-muted">
            <Icons.calendar size={20} />
          </div>
          <p className="tn-h text-[15px] font-bold text-text">Sin turnos para este día</p>
          <p className="mt-1 text-[12.5px] text-muted">Cambia de día con los pills de arriba.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          {/* Eje horario */}
          <div className="flex items-center border-b border-border bg-subtle-2/40 px-3 py-2 md:px-4">
            <div className="w-[152px] shrink-0 md:w-[200px]" />
            <div className="flex flex-1 justify-between text-[10px] font-bold uppercase tracking-[0.06em] text-muted">
              {axis.ticks.map((h) => (
                <span key={h}>{String(h).padStart(2, '0')}</span>
              ))}
            </div>
          </div>

          {/* Filas: personas asignadas */}
          {people.map((person, idx) => (
            <PersonRow
              key={person.userId}
              person={person}
              minH={axis.minH}
              span={axis.span}
              ticks={axis.ticks}
              nowPercent={nowPercent}
              isLast={idx === people.length - 1 && unassignedShifts.length === 0}
              isMineUserId={currentUserId ?? null}
              onShiftClick={onShiftClick}
            />
          ))}

          {/* Filas: turnos sin asignar */}
          {unassignedShifts.length > 0 ? (
            <UnassignedRow
              shifts={unassignedShifts}
              minH={axis.minH}
              span={axis.span}
              ticks={axis.ticks}
              nowPercent={nowPercent}
              onShiftClick={onShiftClick}
            />
          ) : null}
        </div>
      )}

      {/* Footer: ahora */}
      {isSelectedToday ? (
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-subtle-2/60 px-4 py-2.5 text-[12px] text-muted">
          <span className="h-2 w-2 rounded-full bg-red" />
          <span className="font-semibold text-text">{nowTimeLabel}</span>
          <span>· ahora</span>
        </div>
      ) : null}
    </div>
  );
}

function PersonRow({
  person,
  minH,
  span,
  ticks,
  nowPercent,
  isLast,
  isMineUserId,
  onShiftClick,
}: {
  person: PersonWithShifts;
  minH: number;
  span: number;
  ticks: number[];
  nowPercent: number | null;
  isLast: boolean;
  isMineUserId: string | null;
  onShiftClick?: (shift: ShiftWithType, assignedName: string | null) => void;
}) {
  const isMine = isMineUserId === person.userId;
  const fallbackColor = colorForUser(person.userId);
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 md:px-4',
        !isLast ? 'border-b border-border' : ''
      )}
    >
      <div className="flex w-[152px] min-w-0 shrink-0 items-center gap-2.5 md:w-[200px]">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11.5px] font-bold"
          style={{ backgroundColor: fallbackColor + '22', color: fallbackColor }}
        >
          {getInitials(person.fullName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-semibold text-text">
            {person.fullName}
            {isMine ? <span className="ml-1 text-muted">(tú)</span> : null}
          </p>
          {person.staffPosition ? (
            <p className="truncate text-[10.5px] text-muted">{person.staffPosition}</p>
          ) : null}
        </div>
      </div>
      <Track
        shifts={person.shifts}
        minH={minH}
        span={span}
        ticks={ticks}
        nowPercent={nowPercent}
        userColor={fallbackColor}
        forceMine={isMine}
        onShiftClick={(s) => onShiftClick?.(s, person.fullName)}
      />
    </div>
  );
}

function UnassignedRow({
  shifts,
  minH,
  span,
  ticks,
  nowPercent,
  onShiftClick,
}: {
  shifts: ShiftWithType[];
  minH: number;
  span: number;
  ticks: number[];
  nowPercent: number | null;
  onShiftClick?: (shift: ShiftWithType, assignedName: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-border bg-subtle-2/30 px-3 py-2.5 md:px-4">
      <div className="flex w-[152px] min-w-0 shrink-0 items-center gap-2.5 md:w-[200px]">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-amber"
          style={{ backgroundColor: 'color-mix(in oklab, var(--amber) 16%, transparent)' }}
        >
          <Icons.alert size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-semibold text-text">Sin asignar</p>
          <p className="truncate text-[10.5px] text-muted">{shifts.length} turno{shifts.length === 1 ? '' : 's'}</p>
        </div>
      </div>
      <Track
        shifts={shifts}
        minH={minH}
        span={span}
        ticks={ticks}
        nowPercent={nowPercent}
        userColor="#F59E0B"
        forceMine={false}
        onShiftClick={(s) => onShiftClick?.(s, null)}
      />
    </div>
  );
}

function Track({
  shifts,
  minH,
  span,
  ticks,
  nowPercent,
  userColor,
  forceMine,
  onShiftClick,
}: {
  shifts: ShiftWithType[];
  minH: number;
  span: number;
  ticks: number[];
  nowPercent: number | null;
  userColor: string;
  forceMine: boolean;
  onShiftClick?: (shift: ShiftWithType) => void;
}) {
  return (
    <div className="relative h-9 flex-1 overflow-hidden rounded-md">
      {/* Líneas verticales por tick */}
      {ticks.map((_, j) => (
        <span
          key={j}
          aria-hidden
          className="pointer-events-none absolute top-0 bottom-0 w-px bg-border opacity-50"
          style={{ left: `${(j / (ticks.length - 1)) * 100}%` }}
        />
      ))}

      {/* Barras de turno */}
      {shifts.map((s) => {
        const startDate = new Date(s.start_at);
        const endDate = new Date(s.end_at);
        const sameDay = isSameDay(startDate, endDate);
        const dayStart = new Date(startDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(startDate);
        dayEnd.setHours(23, 59, 59, 999);
        const startH = clamp(startDate < dayStart ? 0 : startDate.getHours() + startDate.getMinutes() / 60, 0, 24);
        const endH = clamp(!sameDay || endDate > dayEnd ? 24 : endDate.getHours() + endDate.getMinutes() / 60, 0, 24);
        const left = ((Math.max(startH, minH) - minH) / span) * 100;
        const right = ((Math.min(endH, minH + span) - minH) / span) * 100;
        const width = Math.max(0, right - left);
        if (width <= 0) return null;
        const type = s.organization_shift_types;
        const color = type?.color ?? userColor;
        const label = type?.letter ? `${type.letter} · ${formatTimeShort(s.start_at)}` : formatTimeShort(s.start_at);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onShiftClick?.(s)}
            className={cn(
              'absolute top-1 bottom-1 inline-flex items-center overflow-hidden rounded-md px-2 text-[10.5px] font-bold transition-transform hover:scale-[1.02]',
              forceMine ? 'text-white' : ''
            )}
            style={{
              left: `${left}%`,
              width: `${width}%`,
              backgroundColor: forceMine ? color : `color-mix(in oklab, ${color} 24%, transparent)`,
              color: forceMine ? '#fff' : color,
              border: forceMine ? 'none' : `1px solid color-mix(in oklab, ${color} 55%, transparent)`,
            }}
            title={`${type?.name ?? 'Turno'} · ${formatTimeShort(s.start_at)}–${formatTimeShort(s.end_at)}`}
          >
            <span className="truncate">{label}</span>
          </button>
        );
      })}

      {/* Línea ahora */}
      {nowPercent !== null ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-1 -bottom-1 w-[1.5px] bg-red"
          style={{ left: `${nowPercent}%` }}
        />
      ) : null}
    </div>
  );
}

function formatTimeShort(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}
