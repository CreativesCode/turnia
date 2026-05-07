'use client';

/**
 * Lista de turnos activos en todas las organizaciones del usuario.
 * Muestra los turnos que están en curso ahora (start_at <= now <= end_at).
 * Diseño: ref docs/design/screens/extras.jsx MActiveNow (línea 142).
 */

import type { ShiftWithType } from '@/components/calendar/ShiftCalendar';
import { Icons } from '@/components/ui/icons';
import { LiveDot } from '@/components/ui/LiveDot';
import { Pill } from '@/components/ui/Pill';
import { Skeleton } from '@/components/ui/Skeleton';
import { createClient } from '@/lib/supabase/client';
import { fetchMembershipStaffPositionsMap } from '@/lib/supabase/queries';
import { useEffect, useMemo, useState } from 'react';
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

const PALETTE = ['#0EA5E9', '#8B5CF6', '#14B8A6', '#F97316', '#F59E0B', '#A78BFA', '#EC4899', '#22C55E'];

function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
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

function formatTimeShort(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

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

  if (shiftsErr) throw new Error(shiftsErr.message);

  const raw = (shiftsData ?? []) as Array<
    ShiftWithType & {
      organization_shift_types?: ShiftWithType['organization_shift_types'] | ShiftWithType['organization_shift_types'][];
      organizations?: { name: string } | { name: string }[];
    }
  >;

  const shifts: ShiftWithOrg[] = raw.map((s) => {
    const ot = s.organization_shift_types;
    const singleOt = Array.isArray(ot) ? ot[0] ?? null : ot ?? null;
    const orgs = s.organizations;
    const orgName = Array.isArray(orgs) ? orgs[0]?.name ?? '' : orgs?.name ?? '';
    return { ...s, organization_shift_types: singleOt, organizationName: orgName } as ShiftWithOrg;
  });

  const userIds = [...new Set(shifts.map((s) => s.assigned_user_id).filter(Boolean))] as string[];
  const profilesMap: Record<string, { full_name: string | null }> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
    if (profiles) for (const p of profiles) profilesMap[p.id] = { full_name: p.full_name };
  }

  const staffPositionsMap: Record<string, string> = {};
  for (const orgId of orgIds) {
    const map = await fetchMembershipStaffPositionsMap(supabase, orgId);
    for (const [uid, pos] of Object.entries(map)) {
      if (!staffPositionsMap[uid]) staffPositionsMap[uid] = pos;
    }
  }

  const peopleMap = new Map<string, PersonWithShifts>();
  const unassignedShifts: ShiftWithOrg[] = [];

  for (const shift of shifts) {
    if (!shift.assigned_user_id) {
      unassignedShifts.push(shift);
      continue;
    }
    if (!peopleMap.has(shift.assigned_user_id)) {
      const profile = profilesMap[shift.assigned_user_id];
      peopleMap.set(shift.assigned_user_id, {
        userId: shift.assigned_user_id,
        fullName: profile?.full_name?.trim() || 'Sin nombre',
        staffPosition: staffPositionsMap[shift.assigned_user_id] || null,
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
    { revalidateOnFocus: true, revalidateOnReconnect: true, refreshInterval: 60 * 1000 }
  );

  // Reloj para barras de progreso y header en tiempo real
  const [nowTs, setNowTs] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Realtime updates
  useEffect(() => {
    if (orgIds.length === 0) return;
    const supabase = createClient();
    const channelRefs: ReturnType<ReturnType<typeof createClient>['channel']>[] = [];
    for (const orgId of orgIds) {
      const ch = supabase
        .channel(`active-shifts:${orgId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'shifts', filter: `org_id=eq.${orgId}` },
          () => setTimeout(() => void mutate(), 500)
        )
        .subscribe();
      channelRefs.push(ch);
    }
    return () => {
      channelRefs.forEach((ch) => void supabase.removeChannel(ch));
    };
  }, [orgIds, mutate]);

  const nowLabel = useMemo(() => {
    const d = new Date(nowTs);
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }, [nowTs]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
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
  const totalActiveShifts =
    people.reduce((sum, p) => sum + p.shifts.length, 0) + unassignedShifts.length;

  return (
    <div className="space-y-3">
      {/* Strip live: hora actual + conteo */}
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <LiveDot size={9} />
        <p className="flex-1 text-[12.5px] text-text-sec">
          <span className="font-semibold text-text">{nowLabel}</span>
          <span className="ml-1 text-muted">
            · {people.length} {people.length === 1 ? 'persona activa' : 'personas activas'}
            {unassignedShifts.length > 0 ? ` · ${unassignedShifts.length} sin asignar` : ''}
          </span>
        </p>
      </div>

      {totalActiveShifts === 0 ? (
        <div className="rounded-2xl border border-border bg-surface px-5 py-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-subtle-2 text-muted">
            <Icons.clock size={20} />
          </div>
          <p className="tn-h text-[15px] font-bold text-text">No hay turnos en curso</p>
          <p className="mt-1 text-[12.5px] text-muted">Cuando haya alguien de guardia aparecerá aquí.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {people.flatMap((person) =>
            person.shifts.map((shift) => (
              <ActivePersonCard
                key={`${person.userId}:${shift.id}`}
                person={person}
                shift={shift}
                nowTs={nowTs}
                onClick={() => onShiftClick?.(shift, person.fullName)}
              />
            ))
          )}
          {unassignedShifts.map((shift) => (
            <ActivePersonCard
              key={`__unassigned:${shift.id}`}
              person={null}
              shift={shift}
              nowTs={nowTs}
              onClick={() => onShiftClick?.(shift, null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivePersonCard({
  person,
  shift,
  nowTs,
  onClick,
}: {
  person: PersonWithShifts | null;
  shift: ShiftWithOrg;
  nowTs: number;
  onClick: () => void;
}) {
  const type = shift.organization_shift_types;
  const userColor = person ? colorForUser(person.userId) : '#F59E0B';
  const color = type?.color ?? userColor;
  const start = new Date(shift.start_at).getTime();
  const end = new Date(shift.end_at).getTime();
  const span = Math.max(1, end - start);
  const pct = Math.max(0, Math.min(100, ((nowTs - start) / span) * 100));

  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded-2xl border border-border bg-surface p-4 text-left transition-colors hover:border-[color-mix(in_oklab,var(--primary)_40%,transparent)]"
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold"
          style={{ backgroundColor: userColor + '22', color: userColor }}
        >
          {person ? getInitials(person.fullName) : <Icons.alert size={16} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-text">
            {person ? person.fullName : 'Turno sin asignar'}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-muted">
            {person?.staffPosition ? (
              <span className="inline-flex items-center gap-1">
                <Icons.stethoscope size={11} />
                {person.staffPosition}
              </span>
            ) : null}
            {shift.organizationName ? (
              <span className="inline-flex items-center gap-1">
                <Icons.hospital size={11} />
                {shift.organizationName}
              </span>
            ) : null}
            {shift.location?.trim() ? (
              <span className="inline-flex items-center gap-1">
                <Icons.pin size={11} />
                {shift.location.trim()}
              </span>
            ) : null}
          </p>
        </div>
        <Pill tone="green" dot>
          En curso
        </Pill>
      </div>

      {/* Progress bar */}
      <div className="mt-3 flex items-center gap-2.5">
        <span className="shrink-0 text-[11px] font-semibold text-muted">{formatTimeShort(shift.start_at)}</span>
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-subtle-2">
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, color-mix(in oklab, ${color} 55%, transparent), ${color})`,
            }}
          />
        </div>
        <span className="shrink-0 text-[11px] font-semibold text-muted">{formatTimeShort(shift.end_at)}</span>
      </div>
    </button>
  );
}
