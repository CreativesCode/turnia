'use client';

/**
 * Página Manager: lista de turnos con filtros, paginación y acciones.
 * @see project-roadmap.md Módulo 3.4
 */

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { ShiftList } from '@/components/shifts/ShiftList';
import { ShiftDetailModal } from '@/components/shifts/ShiftDetailModal';
import { EditShiftModal } from '@/components/shifts/EditShiftModal';
import { CreateShiftModal } from '@/components/shifts/CreateShiftModal';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import type { ShiftWithType } from '@/components/calendar/ShiftCalendar';

export default function ManagerShiftsListPage() {
  const { orgId, userId, canManageShifts, canCreateRequests, isLoading, error } = useScheduleOrg();
  const [refreshKey, setRefreshKey] = useState(0);
  const [detailShift, setDetailShift] = useState<ShiftWithType | null>(null);
  const [detailAssignedName, setDetailAssignedName] = useState<string | null>(null);
  const [editShift, setEditShift] = useState<ShiftWithType | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const handleRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const handleRowClick = useCallback((shift: ShiftWithType, assignedName: string | null) => {
    setDetailShift(shift);
    setDetailAssignedName(assignedName);
  }, []);

  const handleEditClick = useCallback((shift: ShiftWithType) => {
    setEditShift(shift);
    setDetailShift(null);
    setDetailAssignedName(null);
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
        <h1 className="text-xl font-semibold text-text-primary">Lista de turnos</h1>
        <p className="mt-2 text-sm text-muted">
          No tienes una organización asignada. Contacta a un administrador para unirte a una.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-text-primary">Lista de turnos</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/manager"
            className="min-h-[44px] rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-subtle-bg"
          >
            Calendario
          </Link>
          {canManageShifts && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="min-h-[44px] rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
            >
              Nuevo turno
            </button>
          )}
        </div>
      </div>

      <ShiftList
        orgId={orgId}
        canManageShifts={canManageShifts}
        refreshKey={refreshKey}
        onRowClick={handleRowClick}
        onEditClick={handleEditClick}
        onRefresh={handleRefresh}
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

      <EditShiftModal
        open={!!editShift}
        onClose={() => setEditShift(null)}
        onSuccess={handleRefresh}
        onDeleted={handleRefresh}
        orgId={orgId}
        shift={editShift}
      />

      <CreateShiftModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={handleRefresh}
        orgId={orgId}
      />
    </div>
  );
}
