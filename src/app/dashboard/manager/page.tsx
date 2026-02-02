'use client';

/**
 * Página Manager: calendario de turnos, crear/editar/eliminar.
 * Soporta ?shift=id para abrir el detalle desde notificaciones (Módulo 5.2).
 * @see project-roadmap.md Módulo 3
 */

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
import { Button } from '@/components/ui/Button';
import { LinkButton } from '@/components/ui/LinkButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

function SlidersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
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

  return (
    <div className="space-y-4">
      <DashboardDesktopHeader title="Calendario de turnos" subtitle="Vista general y gestión del calendario" />

      {/* Header (móvil inspirado en el frame "Calendario - Mobile") */}
      <div className="flex items-center justify-between gap-3 md:hidden">
        <h1 className="text-lg font-semibold text-text-primary">Calendario</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToday}
            className="min-h-[36px] rounded-lg bg-primary-50 px-3 text-sm font-semibold text-primary-700 hover:bg-primary-100"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={toggleFilters}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-text-secondary hover:bg-subtle-bg"
            aria-label="Filtros"
          >
            <SlidersIcon />
          </button>
        </div>
      </div>

      {/* Acciones (desktop) */}
      <div className="hidden flex-wrap items-center justify-end gap-4 md:flex">
        <div className="flex flex-wrap items-center gap-3">
          <LinkButton href="/dashboard/manager/shifts" variant="secondary">
            Lista de turnos
          </LinkButton>
          {canManageShifts && (
            <Button
              onClick={() => {
                setCreateInitialDate(undefined);
                setCreateOpen(true);
              }}
            >
              Nuevo turno
            </Button>
          )}
        </div>
      </div>

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

      <ShiftCalendarFilters orgId={orgId} value={filters} onChange={setFilters} className="mb-3" />

      <ShiftCalendar
        orgId={orgId}
        canManageShifts={canManageShifts}
        refreshKey={refreshKey}
        filters={filters}
        onEventClick={handleEventClick}
        onDateClick={handleDateClick}
        compactHeader
      />

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
