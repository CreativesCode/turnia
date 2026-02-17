'use client';

/**
 * Página "De turno ahora": turnos activos en todas las organizaciones.
 * Muestra los turnos que están en curso en este momento.
 */

import type { ShiftWithType } from '@/components/calendar/ShiftCalendar';
import { ActiveShiftsList } from '@/components/daily/ActiveShiftsList';
import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { ShiftDetailModal } from '@/components/shifts/ShiftDetailModal';
import { useSelectedOrg } from '@/hooks/useSelectedOrg';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { useCallback, useState } from 'react';

export default function ActiveNowPage() {
  const { organizations, isLoading: isLoadingOrgs } = useSelectedOrg();
  const { orgId, userId, canManageShifts, canCreateRequests, isLoading: isLoadingSchedule, error } = useScheduleOrg();
  const [detailShift, setDetailShift] = useState<ShiftWithType | null>(null);
  const [detailAssignedName, setDetailAssignedName] = useState<string | null>(null);

  const orgIds = organizations.map((o) => o.id);

  const handleShiftClick = useCallback((shift: ShiftWithType, assignedName: string | null) => {
    setDetailShift(shift);
    setDetailAssignedName(assignedName);
  }, []);

  if (isLoadingOrgs || isLoadingSchedule) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="De turno ahora" subtitle="Turnos activos en todas las organizaciones" />
        <div className="rounded-xl border border-border bg-background p-6">
          <p className="text-muted">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="De turno ahora" subtitle="Turnos activos en todas las organizaciones" />
        <div className="rounded-xl border border-border bg-background p-6">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!orgId || organizations.length === 0) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="De turno ahora" subtitle="Turnos activos en todas las organizaciones" />
        <div className="rounded-xl border border-border bg-background p-6">
          <h1 className="text-xl font-semibold text-text-primary">De turno ahora</h1>
          <p className="mt-2 text-sm text-muted">
            No tienes ninguna organización asignada. Contacta a un administrador para unirte a una.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DashboardDesktopHeader
        title="De turno ahora"
        subtitle="Turnos activos en todas las organizaciones"
      />

      <ActiveShiftsList orgIds={orgIds} onShiftClick={handleShiftClick} />

      <ShiftDetailModal
        open={!!detailShift}
        onClose={() => {
          setDetailShift(null);
          setDetailAssignedName(null);
        }}
        onEdit={() => {
          setDetailShift(null);
          setDetailAssignedName(null);
        }}
        onDeleted={() => {
          setDetailShift(null);
          setDetailAssignedName(null);
        }}
        onRequestCreated={() => {
          setDetailShift(null);
          setDetailAssignedName(null);
        }}
        shift={detailShift}
        assignedName={detailAssignedName}
        canManageShifts={canManageShifts}
        canCreateRequests={canCreateRequests}
        currentUserId={userId}
      />
    </div>
  );
}
