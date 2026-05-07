'use client';

/**
 * Disponibilidad del staff: chips + year strip + lista de próximos eventos en mobile,
 * FullCalendar en desktop. Solo el propio usuario ve y gestiona sus eventos.
 * Diseño: ref docs/design/screens/mobile.jsx MAvailability (línea 666).
 */

import { AvailabilityCalendar } from '@/components/availability/AvailabilityCalendar';
import type { AvailabilityEvent } from '@/components/availability/AvailabilityEventModal';
import { AvailabilityEventModal } from '@/components/availability/AvailabilityEventModal';
import { MobileAvailabilityView } from '@/components/availability/MobileAvailabilityView';
import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { PermissionRequestModal } from '@/components/permissions/PermissionRequestModal';
import { Icons } from '@/components/ui/icons';
import { Skeleton } from '@/components/ui/Skeleton';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { useCallback, useState } from 'react';

export default function StaffAvailabilityPage() {
  const { orgId, userId, isLoading, error } = useScheduleOrg();
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<AvailabilityEvent | null>(null);
  const [initialStart, setInitialStart] = useState<Date | undefined>(undefined);
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);

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
      <div className="space-y-4">
        <DashboardDesktopHeader title="Disponibilidad" subtitle="Tus eventos y ausencias" />
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Disponibilidad" subtitle="Tus eventos y ausencias" />
        <div className="rounded-2xl border border-border bg-surface p-6">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DashboardDesktopHeader
        title="Disponibilidad"
        subtitle="Tus eventos y ausencias"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPermissionModalOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-bg px-3 text-[12.5px] font-semibold text-text-sec transition-colors hover:text-text"
            >
              <Icons.doc size={14} /> Permiso
            </button>
            <button
              type="button"
              onClick={() => openAdd()}
              aria-label="Añadir evento"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white transition-transform hover:-translate-y-px"
              style={{ boxShadow: '0 8px 18px -10px var(--primary)' }}
            >
              <Icons.plus size={16} stroke={2.6 as unknown as number} />
            </button>
          </div>
        }
      />

      {/* Mobile: chips + year strip + lista */}
      <div className="md:hidden">
        <MobileAvailabilityView
          orgId={orgId}
          userId={userId}
          refreshKey={refreshKey}
          onAdd={() => openAdd()}
          onEventClick={openEdit}
        />
      </div>

      {/* Desktop: FullCalendar (sin cambio) */}
      <div className="hidden md:block">
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <AvailabilityCalendar
            orgId={orgId}
            userId={userId}
            refreshKey={refreshKey}
            onAddClick={openAdd}
            onEventClick={openEdit}
          />
        </div>
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
      {userId && (
        <PermissionRequestModal
          open={permissionModalOpen}
          onClose={() => setPermissionModalOpen(false)}
          onSuccess={onSuccess}
          currentUserId={userId}
        />
      )}
    </div>
  );
}
