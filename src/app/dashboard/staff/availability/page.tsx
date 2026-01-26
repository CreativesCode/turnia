'use client';

/**
 * Disponibilidad del staff: calendario de eventos (vacaciones, licencia, capacitación, no disponible).
 * Solo el propio usuario ve y gestiona sus eventos.
 * @see project-roadmap.md Módulo 6.1
 */

import Link from 'next/link';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { AvailabilityCalendar } from '@/components/availability/AvailabilityCalendar';
import { AvailabilityEventModal } from '@/components/availability/AvailabilityEventModal';
import type { AvailabilityEvent } from '@/components/availability/AvailabilityEventModal';
import { useCallback, useState } from 'react';

export default function StaffAvailabilityPage() {
  const { orgId, userId, isLoading, error } = useScheduleOrg();
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<AvailabilityEvent | null>(null);
  const [initialStart, setInitialStart] = useState<Date | undefined>(undefined);

  const onRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const onSuccess = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const openAdd = useCallback((date?: Date) => {
    setEditEvent(null);
    setInitialStart(date);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((ev: AvailabilityEvent) => {
    setEditEvent(ev);
    setInitialStart(undefined);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditEvent(null);
    setInitialStart(undefined);
  }, []);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-xl font-semibold text-text-primary">Mi disponibilidad</h1>
        <Link
          href="/dashboard/staff"
          className="text-sm text-primary-600 hover:text-primary-700"
        >
          ← Staff
        </Link>
        <button
          type="button"
          onClick={() => openAdd()}
          className="ml-auto min-h-[44px] rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          Agregar
        </button>
        <button
          type="button"
          onClick={onRefresh}
          className="min-h-[44px] rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-subtle-bg"
        >
          Actualizar
        </button>
      </div>
      <p className="text-sm text-muted">
        Vacaciones, licencia médica, capacitación o no disponible. Haz clic en un día para agregar o en un evento para editar o eliminar.
      </p>

      <AvailabilityCalendar
        orgId={orgId}
        userId={userId}
        refreshKey={refreshKey}
        onAddClick={openAdd}
        onEventClick={openEdit}
      />

      {orgId && userId && (
        <AvailabilityEventModal
          open={modalOpen}
          onClose={closeModal}
          onSuccess={onSuccess}
          orgId={orgId}
          userId={userId}
          editEvent={editEvent}
          initialStart={initialStart}
        />
      )}
    </div>
  );
}
