'use client';

/**
 * Vista Manager: disponibilidad de todos los miembros (solo lectura).
 * Filtros por usuario y tipo de evento. Clic en evento abre detalle.
 * @see project-roadmap.md Módulo 6.2
 */

import Link from 'next/link';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { ManagerAvailabilityFilters, defaultFilters } from '@/components/availability/ManagerAvailabilityFilters';
import { ManagerAvailabilityCalendar } from '@/components/availability/ManagerAvailabilityCalendar';
import { AvailabilityEventDetailModal } from '@/components/availability/AvailabilityEventDetailModal';
import type { AvailabilityEvent } from '@/components/availability/AvailabilityEventModal';
import { useCallback, useState } from 'react';

export default function ManagerAvailabilityPage() {
  const { orgId, isLoading, error } = useScheduleOrg();
  const [filters, setFilters] = useState(defaultFilters);
  const [detailEvent, setDetailEvent] = useState<AvailabilityEvent | null>(null);
  const [detailUserName, setDetailUserName] = useState<string | null>(null);

  const handleEventClick = useCallback((ev: AvailabilityEvent, userName: string | null) => {
    setDetailEvent(ev);
    setDetailUserName(userName);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailEvent(null);
    setDetailUserName(null);
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

  if (!orgId) {
    return (
      <div className="rounded-xl border border-border bg-background p-6">
        <h1 className="text-xl font-semibold text-text-primary">Disponibilidad del equipo</h1>
        <p className="mt-2 text-sm text-muted">
          No tienes una organización asignada. Contacta a un administrador para unirte a una.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-xl font-semibold text-text-primary">Disponibilidad del equipo</h1>
        <Link
          href="/dashboard/manager"
          className="text-sm text-primary-600 hover:text-primary-700"
        >
          ← Calendario
        </Link>
        <Link
          href="/dashboard/manager/shifts"
          className="text-sm text-text-secondary hover:text-primary-600"
        >
          Lista de turnos
        </Link>
        <Link
          href="/dashboard/manager/requests"
          className="text-sm text-text-secondary hover:text-primary-600"
        >
          Solicitudes
        </Link>
      </div>
      <p className="text-sm text-muted">
        Vacaciones, licencia, capacitación y no disponible de todos los miembros. Haz clic en un evento para ver el detalle. Solo los miembros editan su propia disponibilidad en Staff → Disponibilidad.
      </p>

      <ManagerAvailabilityFilters orgId={orgId} value={filters} onChange={setFilters} className="mb-3" />

      <ManagerAvailabilityCalendar
        orgId={orgId}
        userIdFilter={filters.userId}
        typeFilter={filters.types}
        onEventClick={handleEventClick}
      />

      <AvailabilityEventDetailModal
        open={!!detailEvent}
        onClose={closeDetail}
        event={detailEvent}
        userName={detailUserName}
      />
    </div>
  );
}
