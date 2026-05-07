'use client';

/**
 * Página Manager: calendario de turnos, crear/editar/eliminar.
 * Soporta ?shift=id para abrir el detalle desde notificaciones (Módulo 5.2).
 * @see project-roadmap.md Módulo 3
 */

import { CalendarRightRail } from '@/components/calendar/CalendarRightRail';
import type { ShiftWithType } from '@/components/calendar/ShiftCalendar';
import { ShiftCalendar } from '@/components/calendar/ShiftCalendar';
import {
  ShiftCalendarFilters,
  defaultFilters,
  type ShiftCalendarFiltersState,
} from '@/components/calendar/ShiftCalendarFilters';
import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { MyUpcomingShiftsWidget } from '@/components/mobile/MyUpcomingShiftsWidget';
import { OnCallNowWidget } from '@/components/mobile/OnCallNowWidget';
import { QuickActions } from '@/components/mobile/QuickActions';
import { CreateShiftModal } from '@/components/shifts/CreateShiftModal';
import { EditShiftModal } from '@/components/shifts/EditShiftModal';
import { ShiftDetailModal } from '@/components/shifts/ShiftDetailModal';
import { Skeleton } from '@/components/ui/Skeleton';
import { Icons } from '@/components/ui/icons';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

function calendarSubtitle(): string {
  const d = new Date();
  const month = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return month.charAt(0).toUpperCase() + month.slice(1);
}

export default function ManagerPage() {
  const searchParams = useSearchParams();
  const { orgId, userId, canManageShifts, canCreateRequests, isLoading, error } = useScheduleOrg();
  const [myName, setMyName] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState<ShiftCalendarFiltersState>(defaultFilters);
  const [detailShift, setDetailShift] = useState<ShiftWithType | null>(null);
  const [detailAssignedName, setDetailAssignedName] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createInitialDate, setCreateInitialDate] = useState<Date | undefined>();
  const [editShift, setEditShift] = useState<ShiftWithType | null>(null);

  // Abrir "Nuevo turno" desde /dashboard?create=1
  useEffect(() => {
    if (!canManageShifts) return;
    const create = searchParams.get('create');
    if (create !== '1') return;
    const t = window.setTimeout(() => {
      setCreateInitialDate(undefined);
      setCreateOpen(true);
    }, 0);
    return () => window.clearTimeout(t);
  }, [canManageShifts, searchParams]);

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
        .single();
      if (e || !s) return;
      const ot = Array.isArray((s as { organization_shift_types?: unknown }).organization_shift_types)
        ? (s as { organization_shift_types?: unknown[] }).organization_shift_types?.[0]
        : (s as { organization_shift_types?: unknown }).organization_shift_types;
      const shift: ShiftWithType = { ...s, organization_shift_types: ot ?? null } as ShiftWithType;
      let name: string | null = null;
      if (shift.assigned_user_id) {
        const { data: p } = await supabase.from('profiles').select('full_name').eq('id', shift.assigned_user_id).single();
        name = (p as { full_name?: string } | null)?.full_name ?? null;
      }
      setDetailShift(shift);
      setDetailAssignedName(name);
    })();
  }, [orgId, searchParams]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const goToday = useCallback(() => {
    // FullCalendar: usamos el botón interno (aunque esté oculto por CSS) para mantener compatibilidad.
    document.querySelector<HTMLButtonElement>('.fc-today-button')?.click();
  }, []);

  const toggleFilters = useCallback(() => {
    document.getElementById('shift-calendar-filters-toggle')?.click();
  }, []);

  const handleEventClick = useCallback((shift: ShiftWithType, assignedName: string | null) => {
    setDetailShift(shift);
    setDetailAssignedName(assignedName);
  }, []);

  const handleDateClick = useCallback((date: Date) => {
    setCreateInitialDate(date);
    setCreateOpen(true);
  }, []);

  const handleDetailEdit = useCallback(() => {
    if (detailShift) {
      setEditShift(detailShift);
      setDetailShift(null);
      setDetailAssignedName(null);
    }
  }, [detailShift]);

  const scrollToId = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const actions = useMemo(() => {
    return [
      {
        id: 'new-shift',
        title: 'Nuevo turno',
        description: 'Crear turno rápidamente.',
        onClick: () => {
          setCreateInitialDate(undefined);
          setCreateOpen(true);
        },
      },
      {
        id: 'my-upcoming',
        title: 'Mis próximos turnos',
        description: 'Ver y abrir detalle.',
        onClick: () => scrollToId('my-upcoming-shifts'),
      },
      {
        id: 'on-call',
        title: 'On-call now',
        description: 'Quién está de turno ahora.',
        onClick: () => scrollToId('on-call-now'),
      },
    ];
  }, [scrollToId]);

  const handleSelectShiftFromRail = useCallback(
    async (shiftId: string) => {
      if (!orgId) return;
      const supabase = createClient();
      const { data: s } = await supabase
        .from('shifts')
        .select(
          `id, org_id, shift_type_id, status, start_at, end_at, assigned_user_id, location,
           organization_shift_types (id, name, letter, color, start_time, end_time)`
        )
        .eq('id', shiftId)
        .eq('org_id', orgId)
        .single();
      if (!s) return;
      const ot = Array.isArray((s as { organization_shift_types?: unknown }).organization_shift_types)
        ? (s as { organization_shift_types?: unknown[] }).organization_shift_types?.[0]
        : (s as { organization_shift_types?: unknown }).organization_shift_types;
      const shift: ShiftWithType = { ...s, organization_shift_types: ot ?? null } as ShiftWithType;
      let name: string | null = null;
      if (shift.assigned_user_id) {
        const { data: p } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', shift.assigned_user_id)
          .single();
        name = (p as { full_name?: string } | null)?.full_name ?? null;
      }
      setDetailShift(shift);
      setDetailAssignedName(name);
    },
    [orgId]
  );

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-background p-6">
        <div className="space-y-3">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-72" />
          <div className="flex gap-3 pt-2">
            <Skeleton className="h-11 w-32 rounded-lg" />
            <Skeleton className="h-11 w-32 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-background p-6">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="rounded-xl border border-border bg-background p-6">
        <h1 className="text-xl font-semibold text-text-primary">Calendario de turnos</h1>
        <p className="mt-2 text-sm text-muted">
          No tienes una organización asignada. Contacta a un administrador para unirte a una.
        </p>
      </div>
    );
  }

  const headerActions = canManageShifts ? (
    <div className="flex items-center gap-2">
      <Link
        href="/dashboard/manager/shifts"
        className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 text-[12.5px] font-medium text-text-sec hover:bg-subtle"
      >
        <Icons.list size={14} /> Lista
      </Link>
      <button
        type="button"
        onClick={() => {
          setCreateInitialDate(undefined);
          setCreateOpen(true);
        }}
        className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-primary px-3.5 text-[13px] font-semibold text-white shadow-[0_6px_16px_-10px_var(--primary)]"
      >
        <Icons.plus size={15} stroke={2.6} /> Nuevo turno
      </button>
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      <DashboardDesktopHeader
        title="Calendario"
        subtitle={calendarSubtitle()}
        actions={headerActions}
      />

      {/* Header mobile compacto */}
      <div className="flex items-center justify-between gap-3 md:hidden">
        <h1 className="tn-h text-[20px] font-bold tracking-[-0.02em] text-text">Calendario</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToday}
            className="inline-flex h-9 items-center rounded-[10px] bg-primary-soft px-3 text-[13px] font-semibold text-primary"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={toggleFilters}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-subtle-2 text-text-sec"
            aria-label="Filtros"
          >
            <Icons.filter size={16} />
          </button>
        </div>
      </div>

      {/* Layout principal: en desktop, calendario izquierda + right rail 320px */}
      <div className="grid gap-4 md:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          {/* Widgets mobile (no aplican en desktop, los oculto) */}
          <div className="space-y-4 md:hidden">
            <QuickActions items={actions} />
            <MyUpcomingShiftsWidget
              orgId={orgId}
              userId={userId}
              title="Mis próximos turnos (14 días)"
              onSelectShift={(s) => {
                setDetailShift(s);
                setDetailAssignedName((myName?.trim() || 'Yo') as string);
              }}
            />
            <OnCallNowWidget
              orgId={orgId}
              onSelectShift={(s, name) => {
                setDetailShift(s);
                setDetailAssignedName(name);
              }}
            />
          </div>

          <ShiftCalendarFilters orgId={orgId} value={filters} onChange={setFilters} />

          <ShiftCalendar
            orgId={orgId}
            canManageShifts={canManageShifts}
            refreshKey={refreshKey}
            filters={filters}
            onEventClick={handleEventClick}
            onDateClick={handleDateClick}
            compactHeader
          />
        </div>

        {/* Right rail (solo desktop) */}
        <div className="hidden md:block">
          <CalendarRightRail
            orgId={orgId}
            refreshKey={refreshKey}
            onSelectShift={handleSelectShiftFromRail}
          />
        </div>
      </div>

      <ShiftDetailModal
        open={!!detailShift}
        onClose={() => {
          setDetailShift(null);
          setDetailAssignedName(null);
        }}
        onEdit={handleDetailEdit}
        onDeleted={handleRefresh}
        onRequestCreated={handleRefresh}
        shift={detailShift}
        assignedName={detailAssignedName}
        canManageShifts={canManageShifts}
        canCreateRequests={canCreateRequests}
        currentUserId={userId}
      />

      <CreateShiftModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={handleRefresh}
        orgId={orgId}
        initialDate={createInitialDate}
      />

      <EditShiftModal
        open={!!editShift}
        onClose={() => setEditShift(null)}
        onSuccess={handleRefresh}
        onDeleted={handleRefresh}
        orgId={orgId}
        shift={editShift}
      />
    </div>
  );
}
