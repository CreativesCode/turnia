'use client';

/**
 * Página para solicitar permisos (días no trabajar, vacaciones, licencia, etc.).
 * Accesible para usuarios con rol que pueda crear solicitudes.
 */

import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { PermissionRequestModal } from '@/components/permissions/PermissionRequestModal';
import { Button } from '@/components/ui/Button';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { useCallback, useState } from 'react';

export default function PermissionsPage() {
  const { userId, isLoading, error } = useScheduleOrg();
  const [modalOpen, setModalOpen] = useState(false);

  const openModal = useCallback(() => setModalOpen(true), []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Solicitar permiso" subtitle="Cargando…" />
        <div className="rounded-xl border border-border bg-background p-6">
          <p className="text-sm text-muted">Cargando…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Solicitar permiso" subtitle="" />
        <div className="rounded-xl border border-border bg-background p-6">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DashboardDesktopHeader
        title="Solicitar permiso"
        subtitle="Solicita días o períodos en que no podrás trabajar (vacaciones, licencia, capacitación, etc.)"
      />

      <div className="rounded-xl border border-primary-100 bg-primary-50 p-4">
        <p className="text-sm font-medium text-primary-700">¿Necesitas solicitar un permiso?</p>
        <p className="mt-1 text-sm text-primary-600">
          Indica el tipo de permiso, las organizaciones, el rango de fechas y el motivo. Un responsable revisará tu solicitud.
        </p>
        <Button type="button" onClick={openModal} className="mt-3">
          Nueva solicitud de permiso
        </Button>
      </div>

      {userId && (
        <PermissionRequestModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={() => setModalOpen(false)}
          currentUserId={userId}
        />
      )}
    </div>
  );
}
