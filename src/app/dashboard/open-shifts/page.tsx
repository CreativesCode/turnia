'use client';

/**
 * Página "Turnos abiertos": turnos sin asignación donde los usuarios pueden postularse.
 * Muestra una promo teal con el conteo y una grilla de cards con borde teal por turno disponible.
 */

import type { ShiftWithType } from '@/components/calendar/ShiftCalendar';
import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { ShiftDetailModal } from '@/components/shifts/ShiftDetailModal';
import { Icons } from '@/components/ui/icons';
import { Pill } from '@/components/ui/Pill';
import { ShiftLetter } from '@/components/ui/ShiftLetter';
import { Skeleton } from '@/components/ui/Skeleton';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

const SHORT_MONTH = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const SHORT_WEEKDAY = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

function formatTimeRange(startAt: string, endAt: string): string {
  const s = new Date(startAt);
  const e = new Date(endAt);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return '—';
  const st = s.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const et = e.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `${st} - ${et}`;
}

function formatHeroDate(iso: string): { weekday: string; day: number; month: string } {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { weekday: '—', day: 0, month: '—' };
  return {
    weekday: SHORT_WEEKDAY[d.getDay()].toUpperCase(),
    day: d.getDate(),
    month: SHORT_MONTH[d.getMonth()],
  };
}

function shiftDurationHours(startAt: string, endAt: string): number {
  const s = new Date(startAt).getTime();
  const e = new Date(endAt).getTime();
  if (!isFinite(s) || !isFinite(e) || e <= s) return 0;
  return (e - s) / (1000 * 60 * 60);
}

function formatHours(hours: number): string {
  if (!isFinite(hours) || hours <= 0) return '0h';
  if (hours < 10) return `${Math.round(hours * 10) / 10}h`;
  return `${Math.round(hours)}h`;
}

export default function OpenShiftsPage() {
  const searchParams = useSearchParams();
  const { orgId, userId, canManageShifts, canCreateRequests, isLoading, error } = useScheduleOrg();
  const [refreshKey, setRefreshKey] = useState(0);
  const [detailShift, setDetailShift] = useState<ShiftWithType | null>(null);
  const [shifts, setShifts] = useState<ShiftWithType[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);

  // Cargar turnos abiertos (sin asignar) en una ventana de los próximos 90 días
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setShiftsLoading(true);
    const supabase = createClient();
    (async () => {
      const now = new Date();
      const to = new Date(now);
      to.setDate(to.getDate() + 90);
      const { data, error: err } = await supabase
        .from('shifts')
        .select(
          `id, org_id, shift_type_id, status, start_at, end_at, assigned_user_id, location,
           organization_shift_types (id, name, letter, color, start_time, end_time)`
        )
        .eq('org_id', orgId)
        .is('assigned_user_id', null)
        .gte('end_at', now.toISOString())
        .lte('start_at', to.toISOString())
        .order('start_at', { ascending: true })
        .limit(120);
      if (cancelled) return;
      if (err) {
        setShifts([]);
        setShiftsLoading(false);
        return;
      }
      const normalized = (data ?? []).map((s) => {
        const raw = s as { organization_shift_types?: unknown };
        const ot = Array.isArray(raw.organization_shift_types)
          ? (raw.organization_shift_types as unknown[])[0]
          : raw.organization_shift_types;
        return { ...s, organization_shift_types: ot ?? null } as ShiftWithType;
      });
      setShifts(normalized);
      setShiftsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, refreshKey]);

  // Abrir detalle de turno desde ?shift=id
  useEffect(() => {
    const shiftId = searchParams.get('shift');
    if (!shiftId || !orgId) return;
    const supabase = createClient();
    (async () => {
      const { data: s, error: e } = await supabase
        .from('shifts')
        .select(
          `id, org_id, shift_type_id, status, start_at, end_at, assigned_user_id, location,
           organization_shift_types (id, name, letter, color, start_time, end_time)`
        )
        .eq('id', shiftId)
        .eq('org_id', orgId)
        .is('assigned_user_id', null)
        .single();
      if (e || !s) return;
      const ot = Array.isArray((s as { organization_shift_types?: unknown }).organization_shift_types)
        ? (s as { organization_shift_types?: unknown[] }).organization_shift_types?.[0]
        : (s as { organization_shift_types?: unknown }).organization_shift_types;
      const shift: ShiftWithType = { ...s, organization_shift_types: ot ?? null } as ShiftWithType;
      setDetailShift(shift);
    })();
  }, [orgId, searchParams]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const grouped = useMemo(() => {
    const groups: { key: string; label: string; items: ShiftWithType[] }[] = [];
    for (const s of shifts) {
      const d = new Date(s.start_at);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      const label = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.items.push(s);
      else groups.push({ key, label, items: [s] });
    }
    return groups;
  }, [shifts]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Turnos abiertos" subtitle="Turnos disponibles para postularse" />
        <div className="rounded-xl border border-border bg-background p-6">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="mt-2 h-4 w-48" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Turnos abiertos" subtitle="Turnos disponibles para postularse" />
        <div className="rounded-xl border border-border bg-background p-6">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Turnos abiertos" subtitle="Turnos disponibles para postularse" />
        <div className="rounded-xl border border-border bg-background p-6">
          <h1 className="text-xl font-semibold text-text-primary">Turnos abiertos</h1>
          <p className="mt-2 text-sm text-muted">
            No tienes una organización asignada. Contacta a un administrador para unirte a una.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DashboardDesktopHeader
        title="Turnos abiertos"
        subtitle="Turnos disponibles para postularse"
      />

      <OpenShiftsPromo count={shifts.length} loading={shiftsLoading} />

      {shiftsLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      ) : shifts.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-5">
          {grouped.map((g) => (
            <div key={g.key}>
              <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{g.label}</p>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {g.items.map((s) => (
                  <OpenShiftCard key={s.id} shift={s} onClick={() => setDetailShift(s)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <ShiftDetailModal
        open={!!detailShift}
        onClose={() => setDetailShift(null)}
        onDeleted={handleRefresh}
        onRequestCreated={handleRefresh}
        shift={detailShift}
        assignedName={null}
        canManageShifts={canManageShifts}
        canCreateRequests={canCreateRequests}
        currentUserId={userId}
      />
    </div>
  );
}

function OpenShiftsPromo({ count, loading }: { count: number; loading: boolean }) {
  return (
    <div
      className="rounded-2xl border p-4 md:p-5"
      style={{
        borderColor: 'color-mix(in oklab, var(--primary) 30%, transparent)',
        background:
          'linear-gradient(135deg, color-mix(in oklab, var(--primary) 10%, transparent), color-mix(in oklab, var(--primary) 4%, transparent))',
      }}
    >
      <div className="flex flex-wrap items-start gap-4 md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-primary">
            <Icons.takeOpen size={13} /> Turnos abiertos
          </div>
          <p className="tn-h mt-1.5 text-[22px] font-extrabold tracking-[-0.02em] text-text md:text-[26px]">
            {loading ? '…' : count === 0 ? 'Nada disponible' : `${count} disponible${count === 1 ? '' : 's'}`}
          </p>
          <p className="mt-1 max-w-prose text-[12.5px] leading-[1.5] text-text-sec">
            Estos son los turnos que aún no tienen asignación. Selecciona uno para postularte.
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-border bg-surface px-5 py-12 text-center">
      <div
        className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: 'color-mix(in oklab, var(--primary) 14%, transparent)', color: 'var(--primary)' }}
      >
        <Icons.takeOpen size={22} />
      </div>
      <p className="tn-h text-[16px] font-bold text-text">No hay turnos abiertos</p>
      <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted">
        En este momento no hay turnos sin asignar. Vuelve a revisar más tarde o consulta a tu coordinador.
      </p>
    </div>
  );
}

function OpenShiftCard({ shift, onClick }: { shift: ShiftWithType; onClick: () => void }) {
  const type = shift.organization_shift_types;
  const color = type?.color ?? '#14B8A6';
  const date = formatHeroDate(shift.start_at);
  const hours = shiftDurationHours(shift.start_at, shift.end_at);
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border bg-surface p-4 text-left transition-all hover:-translate-y-0.5"
      style={{
        borderColor: `color-mix(in oklab, ${color} 32%, transparent)`,
        boxShadow: 'none',
      }}
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: color }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-bl-[100%]"
        style={{ background: `color-mix(in oklab, ${color} 9%, transparent)` }}
      />

      <div className="flex items-start gap-3">
        <div className="flex h-[58px] w-[58px] shrink-0 flex-col items-center justify-center rounded-xl border border-border bg-bg">
          <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted">{date.weekday}</span>
          <span className="tn-h text-[24px] font-extrabold leading-none text-text">{date.day}</span>
          <span className="text-[10px] uppercase text-muted">{date.month}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <ShiftLetter letter={type?.letter ?? '?'} color={color} size={28} />
            <p className="truncate text-[13.5px] font-semibold text-text">{type?.name ?? 'Turno'}</p>
          </div>
          <p className="mt-1.5 truncate text-[12px] text-text-sec">
            {formatTimeRange(shift.start_at, shift.end_at)}
            {hours > 0 ? ` · ${formatHours(hours)}` : ''}
          </p>
          {shift.location?.trim() ? (
            <p className="mt-0.5 flex items-center gap-1 truncate text-[11.5px] text-muted">
              <Icons.pin size={11} />
              {shift.location.trim()}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <Pill tone="amber" dot>
          Abierto
        </Pill>
        <span
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-primary transition-colors group-hover:bg-primary group-hover:text-white"
          style={{ backgroundColor: 'color-mix(in oklab, var(--primary) 12%, transparent)' }}
        >
          Solicitar <Icons.arrowR size={13} />
        </span>
      </div>
    </button>
  );
}
