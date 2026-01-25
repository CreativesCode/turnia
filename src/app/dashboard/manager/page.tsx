'use client';

/**
 * Página Manager: calendario de turnos, crear/editar/eliminar.
 * @see project-roadmap.md Módulo 3
 */

import { useCallback, useState } from 'react';
import { ShiftCalendar } from '@/components/calendar/ShiftCalendar';
import {
  ShiftCalendarFilters,
  defaultFilters,
  type ShiftCalendarFiltersState,
} from '@/components/calendar/ShiftCalendarFilters';
import { CreateShiftModal } from '@/components/shifts/CreateShiftModal';
import { EditShiftModal } from '@/components/shifts/EditShiftModal';
import { ShiftDetailModal } from '@/components/shifts/ShiftDetailModal';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import type { ShiftWithType } from '@/components/calendar/ShiftCalendar';

export default function ManagerPage() {
  const { orgId, userId, canManageShifts, canCreateRequests, isLoading, error } = useScheduleOrg();
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState<ShiftCalendarFiltersState>(defaultFilters);
  const [detailShift, setDetailShift] = useState<ShiftWithType | null>(null);
  const [detailAssignedName, setDetailAssignedName] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createInitialDate, setCreateInitialDate] = useState<Date | undefined>();
  const [editShift, setEditShift] = useState<ShiftWithType | null>(null);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
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

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-background p-6">
        <p className="text-sm text-muted">Cargando…</p>
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-text-primary">Calendario de turnos</h1>
        {canManageShifts && (
          <button
            type="button"
            onClick={() => {
              setCreateInitialDate(undefined);
              setCreateOpen(true);
            }}
            className="min-h-[44px] rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
          >
            Nuevo turno
          </button>
        )}
      </div>

      <ShiftCalendarFilters orgId={orgId} value={filters} onChange={setFilters} className="mb-3" />

      <ShiftCalendar
        orgId={orgId}
        canManageShifts={canManageShifts}
        refreshKey={refreshKey}
        filters={filters}
        onEventClick={handleEventClick}
        onDateClick={handleDateClick}
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
