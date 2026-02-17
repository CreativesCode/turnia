'use client';

/**
 * Lista de turnos activos en todas las organizaciones del usuario.
 * Muestra los turnos que están en curso ahora (start_at <= now <= end_at).
 * Reutiliza ShiftCard con organizationName para mantener estilo único.
 */

import type { ShiftWithType } from '@/components/calendar/ShiftCalendar';
import { ShiftCard } from '@/components/daily/ShiftCard';
import { createClient } from '@/lib/supabase/client';
import { fetchMembershipStaffPositionsMap } from '@/lib/supabase/queries';
import { useEffect } from 'react';
import useSWR from 'swr';

type ShiftWithOrg = ShiftWithType & { organizationName: string };

type PersonWithShifts = {
  userId: string;
  fullName: string;
  staffPosition: string | null;
  shifts: ShiftWithOrg[];
};

type ActiveShiftsData = {
  people: PersonWithShifts[];
  unassignedShifts: ShiftWithOrg[];
};

async function fetchActiveShifts(orgIds: string[]): Promise<ActiveShiftsData> {
  if (orgIds.length === 0) return { people: [], unassignedShifts: [] };

  const supabase = createClient();
  const now = new Date().toISOString();

  const { data: shiftsData, error: shiftsErr } = await supabase
    .from('shifts')
    .select(
      `
      id, org_id, shift_type_id, status, start_at, end_at, assigned_user_id, location,
      organization_shift_types (id, name, letter, color, start_time, end_time),
      organizations (name)
    `
    )
    .in('org_id', orgIds)
    .eq('status', 'published')
    .lte('start_at', now)
    .gte('end_at', now)
    .order('start_at', { ascending: true });

  if (shiftsErr) {
    throw new Error(shiftsErr.message);
  }

  const raw = (shiftsData ?? []) as Array<
    ShiftWithType & {
      organization_shift_types?: ShiftWithType['organization_shift_types'] | ShiftWithType['organization_shift_types'][];
      organizations?: { name: string } | { name: string }[];
    }
  >;

  const shifts: ShiftWithOrg[] = raw.map((s) => {
    const ot = s.organization_shift_types;
    const singleOt = Array.isArray(ot) ? (ot[0] ?? null) : ot ?? null;
    const orgs = s.organizations;
    const orgName = Array.isArray(orgs) ? (orgs[0]?.name ?? '') : (orgs?.name ?? '');
    return {
      ...s,
      organization_shift_types: singleOt,
      organizationName: orgName,
    } as ShiftWithOrg;
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

  // Obtener puestos de personal (un org por usuario, tomamos el primero donde aparecen)
  const staffPositionsMap: Record<string, string> = {};
  for (const orgId of orgIds) {
    const map = await fetchMembershipStaffPositionsMap(supabase, orgId);
    for (const [uid, pos] of Object.entries(map)) {
      if (!staffPositionsMap[uid]) staffPositionsMap[uid] = pos;
    }
  }

  // Agrupar por persona
  const peopleMap = new Map<string, PersonWithShifts>();
  const unassignedShifts: ShiftWithOrg[] = [];

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
  orgIds: string[];
  onShiftClick?: (shift: ShiftWithType, assignedName: string | null) => void;
};

export function ActiveShiftsList({ orgIds, onShiftClick }: Props) {
  const swrKey = orgIds.length > 0 ? ['activeShifts', ...orgIds.sort()] : null;
  const { data, error, isLoading, mutate } = useSWR<ActiveShiftsData>(
    swrKey,
    () => fetchActiveShifts(orgIds),
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: 60 * 1000, // refrescar cada minuto para mantener actualizados los turnos activos
    }
  );

  // Suscripción a cambios en shifts de las orgs
  useEffect(() => {
    if (orgIds.length === 0) return;
    const supabase = createClient();
    const channelRefs: ReturnType<ReturnType<typeof createClient>['channel']>[] = [];
    for (const orgId of orgIds) {
      const ch = supabase
        .channel(`active-shifts:${orgId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'shifts',
            filter: `org_id=eq.${orgId}`,
          },
          () => setTimeout(() => void mutate(), 500)
        )
        .subscribe();
      channelRefs.push(ch);
    }
    return () => {
      channelRefs.forEach((ch) => void supabase.removeChannel(ch));
    };
  }, [orgIds, mutate]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-background p-6">
        <p className="text-muted">Cargando turnos activos...</p>
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
      {/* Resumen */}
      <div className="rounded-xl border border-border bg-background p-4">
        <p className="text-sm text-text-secondary">
          {totalShifts === 0 ? (
            'No hay turnos activos ahora'
          ) : (
            <>
              {totalShifts} {totalShifts === 1 ? 'turno activo' : 'turnos activos'}
              {people.length > 0 && (
                <> • {people.length} {people.length === 1 ? 'persona' : 'personas'}</>
              )}
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
                      {person.shifts.length} {person.shifts.length === 1 ? 'turno activo' : 'turnos activos'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {person.shifts.map((shift) => (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    organizationName={shift.organizationName}
                    onClick={() => onShiftClick?.(shift, person.fullName)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Turnos sin asignar */}
      {unassignedShifts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-secondary">Turnos sin asignar</h3>
          {unassignedShifts.map((shift) => (
            <ShiftCard
              key={shift.id}
              shift={shift}
              organizationName={shift.organizationName}
              onClick={() => onShiftClick?.(shift, null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
