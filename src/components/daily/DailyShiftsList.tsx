'use client';

/**
 * Lista de personas con sus turnos del día actual.
 * Agrupa los turnos por persona y muestra una lista limpia.
 */

import type { ShiftWithType } from '@/components/calendar/ShiftCalendar';
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

function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

async function fetchDailyShifts(orgId: string, date: Date): Promise<DailyShiftsData> {
  const supabase = createClient();
  
  // Obtener inicio y fin del día en UTC
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

  if (shiftsErr) {
    throw new Error(shiftsErr.message);
  }

  const raw = (shiftsData ?? []) as Array<
    ShiftWithType & {
      organization_shift_types?: ShiftWithType['organization_shift_types'] | ShiftWithType['organization_shift_types'][];
    }
  >;

  const shifts: ShiftWithType[] = raw.map((s) => {
    const ot = s.organization_shift_types;
    const single = Array.isArray(ot) ? (ot[0] ?? null) : ot ?? null;
    return { ...s, organization_shift_types: single } as ShiftWithType;
  });

  // Obtener perfiles de usuarios asignados
  const userIds = [...new Set(shifts.map((s) => s.assigned_user_id).filter(Boolean))] as string[];
  const profilesMap: Record<string, { full_name: string | null }> = {};

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);

    if (profiles) {
      for (const profile of profiles) {
        profilesMap[profile.id] = { full_name: profile.full_name };
      }
    }
  }

  // Obtener puestos de personal
  const staffPositionsMap = await fetchMembershipStaffPositionsMap(supabase, orgId);

  // Agrupar por persona
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

  // Ordenar personas por nombre
  const people = Array.from(peopleMap.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));

  return { people, unassignedShifts };
}

type Props = {
  orgId: string;
  date?: Date;
  onShiftClick?: (shift: ShiftWithType, assignedName: string | null) => void;
};

export function DailyShiftsList({ orgId, date = new Date(), onShiftClick }: Props) {
  const [selectedDate, setSelectedDate] = useState(date);

  const dateKey = useMemo(() => {
    const d = selectedDate;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [selectedDate]);

  const swrKey = orgId ? ['dailyShifts', orgId, dateKey] : null;
  const { data, error, isLoading, mutate } = useSWR<DailyShiftsData>(swrKey, () => fetchDailyShifts(orgId, selectedDate), {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });

  const goToToday = useCallback(() => {
    setSelectedDate(new Date());
  }, []);

  const goToPreviousDay = useCallback(() => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  }, [selectedDate]);

  const goToNextDay = useCallback(() => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  }, [selectedDate]);

  const isToday = useMemo(() => {
    const today = new Date();
    return (
      selectedDate.getDate() === today.getDate() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getFullYear() === today.getFullYear()
    );
  }, [selectedDate]);

  useEffect(() => {
    if (!orgId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`daily-shifts:${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shifts',
          filter: `org_id=eq.${orgId}`,
        },
        () => {
          setTimeout(() => void mutate(), 500);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId, mutate]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-background p-6">
        <p className="text-muted">Cargando turnos del día...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-background p-6">
        <p className="text-sm text-red-600">Error al cargar turnos: {error.message}</p>
        <button
          type="button"
          onClick={() => void mutate()}
          className="mt-2 text-sm text-primary-600 hover:underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { people, unassignedShifts } = data;
  const totalShifts = people.reduce((sum, p) => sum + p.shifts.length, 0) + unassignedShifts.length;

  return (
    <div className="space-y-4">
      {/* Controles de fecha */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background p-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToPreviousDay}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-text-secondary hover:bg-subtle-bg hover:text-text-primary"
            aria-label="Día anterior"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-sm font-semibold text-text-primary">{formatDate(selectedDate)}</p>
            {!isToday && (
              <button
                type="button"
                onClick={goToToday}
                className="mt-1 text-xs text-primary-600 hover:underline"
              >
                Ir a hoy
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={goToNextDay}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-text-secondary hover:bg-subtle-bg hover:text-text-primary"
            aria-label="Día siguiente"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Resumen */}
      <div className="rounded-xl border border-border bg-background p-4">
        <p className="text-sm text-text-secondary">
          {totalShifts === 0 ? (
            'No hay turnos programados para este día'
          ) : (
            <>
              {totalShifts} {totalShifts === 1 ? 'turno' : 'turnos'} • {people.length} {people.length === 1 ? 'persona' : 'personas'}
              {unassignedShifts.length > 0 && ` • ${unassignedShifts.length} sin asignar`}
            </>
          )}
        </p>
      </div>

      {/* Lista de personas */}
      {people.length > 0 && (
        <div className="space-y-3">
          {people.map((person) => (
            <div
              key={person.userId}
              className="rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary-200"
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                  {person.fullName
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase() || 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-text-primary">{person.fullName}</p>
                  <div className="flex items-center gap-2">
                    {person.staffPosition && (
                      <span className="text-xs font-medium text-primary-600">{person.staffPosition}</span>
                    )}
                    <span className="text-xs text-muted">
                      {person.shifts.length} {person.shifts.length === 1 ? 'turno' : 'turnos'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {person.shifts.map((shift) => {
                  const startDate = new Date(shift.start_at);
                  const endDate = new Date(shift.end_at);
                  const shiftType = shift.organization_shift_types;
                  const color = shiftType?.color || '#6B7280';
                  const letter = shiftType?.letter || '?';
                  const typeName = shiftType?.name || 'Sin tipo';

                  return (
                    <button
                      key={shift.id}
                      type="button"
                      onClick={() => onShiftClick?.(shift, person.fullName)}
                      className="flex w-full items-center gap-3 rounded-lg border border-border bg-subtle-bg p-3 text-left transition-colors hover:border-primary-300 hover:bg-primary-50"
                    >
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                        style={{ backgroundColor: color }}
                      >
                        {letter}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-text-primary">{typeName}</p>
                        <p className="text-sm text-text-secondary">
                          {formatTime(startDate)} - {formatTime(endDate)}
                        </p>
                        {shift.location && (
                          <p className="mt-1 text-xs text-muted">📍 {shift.location}</p>
                        )}
                      </div>
                      <div className="shrink-0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Turnos sin asignar */}
      {unassignedShifts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-secondary">Turnos sin asignar</h3>
          {unassignedShifts.map((shift) => {
            const startDate = new Date(shift.start_at);
            const endDate = new Date(shift.end_at);
            const shiftType = shift.organization_shift_types;
            const color = shiftType?.color || '#6B7280';
            const letter = shiftType?.letter || '?';
            const typeName = shiftType?.name || 'Sin tipo';

            return (
              <button
                key={shift.id}
                type="button"
                onClick={() => onShiftClick?.(shift, null)}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-subtle-bg p-3 text-left transition-colors hover:border-primary-300 hover:bg-primary-50"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                  style={{ backgroundColor: color }}
                >
                  {letter}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-text-primary">{typeName}</p>
                  <p className="text-sm text-text-secondary">
                    {formatTime(startDate)} - {formatTime(endDate)}
                  </p>
                  {shift.location && (
                    <p className="mt-1 text-xs text-muted">📍 {shift.location}</p>
                  )}
                </div>
                <div className="shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
