'use client';

/**
 * Página "Mis turnos": calendario personal del usuario.
 * Muestra solo los turnos asignados al usuario actual.
 */

import { MobileMyShiftsCalendar } from '@/components/calendar/MobileMyShiftsCalendar';
import type { ShiftWithType } from '@/components/calendar/ShiftCalendar';
import { ShiftCalendar } from '@/components/calendar/ShiftCalendar';
import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { ShiftDetailModal } from '@/components/shifts/ShiftDetailModal';
import { Icons } from '@/components/ui/icons';
import { Pill } from '@/components/ui/Pill';
import { ShiftLetter } from '@/components/ui/ShiftLetter';
import { Skeleton } from '@/components/ui/Skeleton';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { cn } from '@/lib/cn';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ListFilter = 'proximos' | 'pasados' | 'todos';
type ViewMode = 'lista' | 'calendario';

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

function timeUntilLabel(startAt: string, endAt: string): string {
  const now = Date.now();
  const s = new Date(startAt).getTime();
  const e = new Date(endAt).getTime();
  if (!isFinite(s)) return '';
  if (now >= s && now <= e) return 'En curso';
  if (now > e) return '';
  const diffMs = s - now;
  const totalMin = Math.floor(diffMs / 60000);
  if (totalMin < 60) return `En ${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h < 24) return `En ${h}h ${m}m`;
  const d = Math.floor(h / 24);
  return `En ${d}d`;
}

export default function MyShiftsPage() {
  const searchParams = useSearchParams();
  const { orgId, userId, canManageShifts, canCreateRequests, isLoading, error } = useScheduleOrg();
  const [refreshKey, setRefreshKey] = useState(0);
  const [detailShift, setDetailShift] = useState<ShiftWithType | null>(null);
  const [detailAssignedName, setDetailAssignedName] = useState<string | null>(null);
  const [myName, setMyName] = useState<string | null>(null);

  const [view, setView] = useState<ViewMode>('lista');
  const [listFilter, setListFilter] = useState<ListFilter>('proximos');
  const [listShifts, setListShifts] = useState<ShiftWithType[]>([]);
  const [listLoading, setListLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const t = window.setTimeout(() => {
      void supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single()
        .then(({ data }) => setMyName((data as { full_name?: string | null } | null)?.full_name ?? null));
    }, 0);
    return () => window.clearTimeout(t);
  }, [userId]);

  // Abrir detalle de turno desde ?shift=id (p. ej. desde notificaciones)
  useEffect(() => {
    const shiftId = searchParams.get('shift');
    if (!shiftId || !orgId || !userId) return;
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
        .eq('assigned_user_id', userId)
        .single();
      if (e || !s) return;
      const ot = Array.isArray((s as { organization_shift_types?: unknown }).organization_shift_types)
        ? (s as { organization_shift_types?: unknown[] }).organization_shift_types?.[0]
        : (s as { organization_shift_types?: unknown }).organization_shift_types;
      const shift: ShiftWithType = { ...s, organization_shift_types: ot ?? null } as ShiftWithType;
      setDetailShift(shift);
      setDetailAssignedName(myName);
    })();
  }, [orgId, userId, searchParams, myName]);

  // Cargar lista de turnos según el filtro activo
  useEffect(() => {
    if (!orgId || !userId || view !== 'lista') return;

    let cancelled = false;
    setListLoading(true);
    const supabase = createClient();

    (async () => {
      const now = new Date();
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const sixMonthsForward = new Date(now);
      sixMonthsForward.setMonth(sixMonthsForward.getMonth() + 6);

      let q = supabase
        .from('shifts')
        .select(
          `id, org_id, shift_type_id, status, start_at, end_at, assigned_user_id, location,
           organization_shift_types (id, name, letter, color, start_time, end_time)`
        )
        .eq('org_id', orgId)
        .eq('assigned_user_id', userId)
        .limit(200);

      if (listFilter === 'proximos') {
        q = q
          .gte('end_at', now.toISOString())
          .lte('start_at', sixMonthsForward.toISOString())
          .order('start_at', { ascending: true });
      } else if (listFilter === 'pasados') {
        q = q
          .lt('end_at', now.toISOString())
          .gte('start_at', sixMonthsAgo.toISOString())
          .order('start_at', { ascending: false });
      } else {
        q = q
          .gte('start_at', sixMonthsAgo.toISOString())
          .lte('start_at', sixMonthsForward.toISOString())
          .order('start_at', { ascending: false });
      }

      const { data, error: err } = await q;
      if (cancelled) return;
      if (err) {
        setListShifts([]);
        setListLoading(false);
        return;
      }
      const normalized = (data ?? []).map((s) => {
        const raw = s as { organization_shift_types?: unknown };
        const ot = Array.isArray(raw.organization_shift_types)
          ? (raw.organization_shift_types as unknown[])[0]
          : raw.organization_shift_types;
        return { ...s, organization_shift_types: ot ?? null } as ShiftWithType;
      });
      setListShifts(normalized);
      setListLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [orgId, userId, view, listFilter, refreshKey]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleEventClick = useCallback((shift: ShiftWithType, assignedName: string | null) => {
    setDetailShift(shift);
    setDetailAssignedName(assignedName);
  }, []);

  const openShiftDetail = useCallback(
    (s: ShiftWithType) => {
      setDetailShift(s);
      setDetailAssignedName(myName);
    },
    [myName]
  );

  // Agrupar lista por mes (cabeceras)
  const groupedList = useMemo(() => {
    const groups: { key: string; label: string; items: ShiftWithType[] }[] = [];
    for (const s of listShifts) {
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
  }, [listShifts]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Mis turnos" subtitle="Calendario personal de tus turnos asignados" />
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
        <DashboardDesktopHeader title="Mis turnos" subtitle="Calendario personal de tus turnos asignados" />
        <div className="rounded-xl border border-border bg-background p-6">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!orgId || !userId) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Mis turnos" subtitle="Calendario personal de tus turnos asignados" />
        <div className="rounded-xl border border-border bg-background p-6">
          <h1 className="text-xl font-semibold text-text-primary">Mis turnos</h1>
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
        title="Mis turnos"
        subtitle="Calendario personal de tus turnos asignados"
      />

      {/* Toggle Lista / Calendario */}
      <div className="flex items-center justify-between gap-3">
        <ViewToggle view={view} onChange={setView} />
        {view === 'lista' ? (
          <FilterSegmented value={listFilter} onChange={setListFilter} />
        ) : null}
      </div>

      {view === 'lista' ? (
        <ListView
          loading={listLoading}
          groups={groupedList}
          filter={listFilter}
          onSelect={openShiftDetail}
        />
      ) : (
        <>
          {/* Desktop: FullCalendar de siempre */}
          <div className="hidden md:block">
            <ShiftCalendar
              orgId={orgId}
              canManageShifts={false}
              refreshKey={refreshKey}
              filters={{ shiftTypeIds: [], userId, status: 'all' }}
              onEventClick={handleEventClick}
              compactHeader
            />
          </div>

          {/* Mobile: calendario rediseñado del mockup MCalendar */}
          <div className="md:hidden">
            <MobileMyShiftsCalendar
              orgId={orgId}
              userId={userId}
              onSelectShift={(s) => openShiftDetail(s as ShiftWithType)}
            />
          </div>
        </>
      )}

      <ShiftDetailModal
        open={!!detailShift}
        onClose={() => {
          setDetailShift(null);
          setDetailAssignedName(null);
        }}
        onDeleted={handleRefresh}
        onRequestCreated={handleRefresh}
        shift={detailShift}
        assignedName={detailAssignedName}
        canManageShifts={canManageShifts}
        canCreateRequests={canCreateRequests}
        currentUserId={userId}
      />
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const items: { key: ViewMode; label: string; icon: React.ReactNode }[] = [
    { key: 'lista', label: 'Lista', icon: <Icons.list size={14} /> },
    { key: 'calendario', label: 'Calendario', icon: <Icons.calendar size={14} /> },
  ];
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-subtle-2 p-1">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={() => onChange(it.key)}
          aria-pressed={view === it.key}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
            view === it.key
              ? 'bg-bg text-text shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
              : 'text-text-sec hover:text-text'
          )}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  );
}

function FilterSegmented({
  value,
  onChange,
}: {
  value: ListFilter;
  onChange: (v: ListFilter) => void;
}) {
  const items: { key: ListFilter; label: string }[] = [
    { key: 'proximos', label: 'Próximos' },
    { key: 'pasados', label: 'Pasados' },
    { key: 'todos', label: 'Todos' },
  ];
  return (
    <div className="inline-flex items-center gap-1.5">
      {items.map((it) => {
        const active = value === it.key;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            aria-pressed={active}
            className={cn(
              'inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold transition-colors',
              active
                ? 'bg-primary text-white shadow-[0_4px_12px_-4px_var(--primary)]'
                : 'border border-border bg-bg text-text-sec hover:text-text'
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function ListView({
  loading,
  groups,
  filter,
  onSelect,
}: {
  loading: boolean;
  groups: { key: string; label: string; items: ShiftWithType[] }[];
  filter: ListFilter;
  onSelect: (s: ShiftWithType) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2 rounded-2xl border border-border bg-surface p-4">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }
  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface px-5 py-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-subtle-2 text-muted">
          <Icons.calendar size={20} />
        </div>
        <p className="tn-h text-[15px] font-bold text-text">
          {filter === 'proximos'
            ? 'No tienes turnos próximos'
            : filter === 'pasados'
              ? 'Sin turnos pasados'
              : 'Sin turnos'}
        </p>
        <p className="mt-1 text-[12.5px] text-muted">
          {filter === 'proximos'
            ? 'Cuando tengas turnos asignados aparecerán aquí.'
            : 'Aquí verás tu historial de turnos cuando lo tengas.'}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.key}>
          <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{g.label}</p>
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            {g.items.map((s, i) => (
              <ShiftListRow
                key={s.id}
                shift={s}
                onClick={() => onSelect(s)}
                isLast={i === g.items.length - 1}
                showUntil={filter !== 'pasados'}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ShiftListRow({
  shift,
  onClick,
  isLast,
  showUntil,
}: {
  shift: ShiftWithType;
  onClick: () => void;
  isLast: boolean;
  showUntil: boolean;
}) {
  const type = shift.organization_shift_types;
  const color = type?.color ?? '#14B8A6';
  const date = formatHeroDate(shift.start_at);
  const hours = shiftDurationHours(shift.start_at, shift.end_at);
  const until = showUntil ? timeUntilLabel(shift.start_at, shift.end_at) : '';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-subtle md:px-5',
        !isLast ? 'border-b border-border' : ''
      )}
    >
      <span
        aria-hidden
        className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
        style={{ backgroundColor: color }}
      />
      <div className="w-[52px] shrink-0 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted">{date.weekday}</p>
        <p className="tn-h mt-0.5 text-[22px] font-extrabold leading-none text-text">{date.day}</p>
        <p className="mt-0.5 text-[10px] uppercase text-muted">{date.month}</p>
      </div>
      <ShiftLetter letter={type?.letter ?? '?'} color={color} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold text-text">{type?.name ?? 'Turno'}</p>
        <p className="mt-0.5 truncate text-[11.5px] text-muted">
          {formatTimeRange(shift.start_at, shift.end_at)}
          {hours > 0 ? ` · ${formatHours(hours)}` : ''}
          {shift.location?.trim() ? ` · ${shift.location.trim()}` : ''}
        </p>
      </div>
      {until ? (
        <Pill tone={until === 'En curso' ? 'green' : 'primary'} dot>
          {until}
        </Pill>
      ) : null}
      <Icons.chevronR size={16} className="text-muted" />
    </button>
  );
}
