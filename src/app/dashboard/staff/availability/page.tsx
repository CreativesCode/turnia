'use client';

/**
 * Disponibilidad del staff: calendario de eventos (vacaciones, licencia, capacitación, no disponible).
 * Solo el propio usuario ve y gestiona sus eventos.
 * @see project-roadmap.md Módulo 6.1
 */

import { AvailabilityCalendar } from '@/components/availability/AvailabilityCalendar';
import type { AvailabilityEvent } from '@/components/availability/AvailabilityEventModal';
import { AvailabilityEventModal } from '@/components/availability/AvailabilityEventModal';
import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { Button } from '@/components/ui/Button';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import Link from 'next/link';
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
      <DashboardDesktopHeader title="Mi disponibilidad" subtitle="Agrega eventos para que el manager planifique mejor" />

      {/* Header (móvil inspirado en "Disponibilidad - Mobile") */}
      <div className="flex items-center justify-between gap-3 md:hidden">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/staff"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-text-secondary hover:bg-subtle-bg"
            aria-label="Volver"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-text-primary">Mi Disponibilidad</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onRefresh}>
            Actualizar
          </Button>
          <Button type="button" size="sm" onClick={() => openAdd()}>
            Agregar
          </Button>
        </div>
      </div>

      {/* Acciones (desktop) */}
      <div className="hidden flex-wrap items-center justify-end gap-3 md:flex">
        <Button type="button" onClick={() => openAdd()}>
          Agregar
        </Button>
        <Button type="button" variant="secondary" onClick={onRefresh}>
          Actualizar
        </Button>
      </div>

      <div className="rounded-xl border border-primary-100 bg-primary-50 p-4">
        <p className="text-sm font-medium text-primary-700">Configura tu disponibilidad</p>
        <p className="mt-1 text-sm text-primary-600">
          Los managers usarán esta información para asignar turnos. Haz clic en un día para agregar o en un evento para editar o eliminar.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-background md:rounded-xl">
        <AvailabilityCalendar
          orgId={orgId}
          userId={userId}
          refreshKey={refreshKey}
          onAddClick={openAdd}
          onEventClick={openEdit}
        />
      </div>

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
