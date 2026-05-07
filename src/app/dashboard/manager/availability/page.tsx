'use client';

/**
 * Vista Manager: disponibilidad de todos los miembros (solo lectura).
 * Filtros por usuario y tipo de evento. Clic en evento abre detalle.
 * Diseño: ref docs/design/PLAN-REDISENO.md 6.2.
 */

import { AvailabilityEventDetailModal } from '@/components/availability/AvailabilityEventDetailModal';
import type { AvailabilityEvent } from '@/components/availability/AvailabilityEventModal';
import { ManagerAvailabilityCalendar } from '@/components/availability/ManagerAvailabilityCalendar';
import { ManagerAvailabilityFilters, defaultFilters } from '@/components/availability/ManagerAvailabilityFilters';
import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
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
      <div className="space-y-4">
        <DashboardDesktopHeader title="Disponibilidad del equipo" subtitle="Vista general (solo lectura)" />
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Disponibilidad del equipo" subtitle="Vista general (solo lectura)" />
        <div className="rounded-2xl border border-border bg-surface p-6">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Disponibilidad del equipo" subtitle="Vista general (solo lectura)" />
        <div className="rounded-2xl border border-border bg-surface p-6">
          <p className="text-sm text-muted">
            No tienes una organización asignada. Contacta a un administrador para unirte a una.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DashboardDesktopHeader
        title="Disponibilidad del equipo"
        subtitle="Vacaciones, licencias y ausencias de todos los miembros"
      />

      <ManagerAvailabilityFilters orgId={orgId} value={filters} onChange={setFilters} />

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <ManagerAvailabilityCalendar
          orgId={orgId}
          userIdFilter={filters.userId}
          typeFilter={filters.types}
          onEventClick={handleEventClick}
        />
      </div>

      <AvailabilityEventDetailModal
        open={!!detailEvent}
        onClose={closeDetail}
        event={detailEvent}
        userName={detailUserName}
      />
    </div>
  );
}
