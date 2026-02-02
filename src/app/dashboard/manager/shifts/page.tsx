'use client';

/**
 * Página Manager: lista de turnos con filtros, paginación y acciones.
 * @see project-roadmap.md Módulo 3.4
 */

import type { ShiftWithType } from '@/components/calendar/ShiftCalendar';
import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { BulkOperationsPanel } from '@/components/shifts/BulkOperationsPanel';
import { CopyShiftsModal } from '@/components/shifts/CopyShiftsModal';
import { CreateShiftModal } from '@/components/shifts/CreateShiftModal';
import { EditShiftModal } from '@/components/shifts/EditShiftModal';
import { ShiftDetailModal } from '@/components/shifts/ShiftDetailModal';
import { ShiftList } from '@/components/shifts/ShiftList';
import { ShiftTemplateForm } from '@/components/shifts/ShiftTemplateForm';
import { Button } from '@/components/ui/Button';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import Link from 'next/link';
import { useCallback, useState } from 'react';

export default function ManagerShiftsListPage() {
  const { orgId, userId, canManageShifts, canCreateRequests, isLoading, error } = useScheduleOrg();
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailShift, setDetailShift] = useState<ShiftWithType | null>(null);
  const [detailAssignedName, setDetailAssignedName] = useState<string | null>(null);
  const [editShift, setEditShift] = useState<ShiftWithType | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

  const handleRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const handleBulkSuccess = useCallback(() => {
    setSelectedIds([]);
    handleRefresh();
  }, [handleRefresh]);

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
      <DashboardDesktopHeader title="Lista de turnos" subtitle="Filtros, plantillas y operaciones masivas" />

      {/* Header (móvil inspirado en "Lista Turnos - Mobile") */}
      <div className="flex items-center justify-between gap-3 md:hidden">
        <h1 className="text-lg font-semibold text-text-primary">Turnos</h1>
        {canManageShifts ? (
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            Nuevo
          </Button>
        ) : null}
      </div>

      {/* Acciones (desktop) */}
      <div className="hidden flex-wrap items-center justify-end gap-4 md:flex">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/manager"
            className="min-h-[44px] rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-subtle-bg"
          >
            Calendario
          </Link>
          {canManageShifts && (
            <>
              <button
                type="button"
                onClick={() => setCopyOpen(true)}
                className="min-h-[44px] rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-subtle-bg"
              >
                Copiar período
              </button>
              <button
                type="button"
                onClick={() => setTemplateOpen(true)}
                className="min-h-[44px] rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-subtle-bg"
              >
                Generar desde patrón
              </button>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="min-h-[44px] rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
              >
                Nuevo turno
              </button>
            </>
          )}
        </div>
      </div>

      {canManageShifts && (
        <BulkOperationsPanel
          orgId={orgId}
          selectedIds={selectedIds}
          onSuccess={handleBulkSuccess}
          onClearSelection={() => setSelectedIds([])}
        />
      )}

      <ShiftList
        orgId={orgId}
        canManageShifts={canManageShifts}
        refreshKey={refreshKey}
        onRowClick={handleRowClick}
        onEditClick={handleEditClick}
        onRefresh={handleRefresh}
        selectedIds={selectedIds}
        onSelectionChange={canManageShifts ? setSelectedIds : undefined}
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

      <CopyShiftsModal
        open={copyOpen}
        onClose={() => setCopyOpen(false)}
        onSuccess={handleRefresh}
        orgId={orgId}
      />

      <ShiftTemplateForm
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        onSuccess={handleRefresh}
        orgId={orgId}
      />
    </div>
  );
}
