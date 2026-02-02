'use client';

/**
 * Mis solicitudes: listar y cancelar (si draft/submitted/accepted).
 * Intercambios pendientes de tu aceptación (User B): aceptar/rechazar.
 * @see project-roadmap.md Módulo 4.1, 4.4
 */

import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { MyRequestsList } from '@/components/requests/MyRequestsList';
import { PendingSwapsForYou } from '@/components/requests/PendingSwapsForYou';
import { Button } from '@/components/ui/Button';
import { LinkButton } from '@/components/ui/LinkButton';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { useCallback, useState } from 'react';

export default function StaffMyRequestsPage() {
  const { orgId, userId, isLoading, error } = useScheduleOrg();
  const [refreshKey, setRefreshKey] = useState(0);
  const { toast } = useToast();

  const onRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    toast({ variant: 'info', title: 'Actualizando', message: 'Actualizando solicitudes…' });
  }, [toast]);

  const onResolved = useCallback(() => {
    setRefreshKey((k) => k + 1);
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
      <DashboardDesktopHeader title="Mis Solicitudes" subtitle="Gestiona tus solicitudes y swaps" />

      {/* Header (móvil inspirado en "Solicitudes - Mobile") */}
      <div className="flex items-center justify-between gap-3 md:hidden">
        <h1 className="text-lg font-semibold text-text-primary">Mis Solicitudes</h1>
        <div className="flex items-center gap-2">
          <LinkButton href="/dashboard/manager" variant="primary" size="sm">
            Nueva
          </LinkButton>
          <Button type="button" variant="secondary" size="sm" onClick={onRefresh}>
            Actualizar
          </Button>
        </div>
      </div>

      {/* Acciones desktop */}
      <div className="hidden flex-wrap items-center gap-3 md:flex">
        <Button type="button" variant="secondary" onClick={onRefresh} className="ml-auto">
          Actualizar
        </Button>
      </div>

      <p className="text-sm text-muted">
        Dar de baja, intercambiar o tomar turnos abiertos. Para crear una nueva, abre el calendario, selecciona un turno y elige “Solicitar cambio”.
      </p>
      <PendingSwapsForYou
        orgId={orgId}
        userId={userId}
        refreshKey={refreshKey}
        onResolved={onResolved}
      />
      <MyRequestsList orgId={orgId} userId={userId} refreshKey={refreshKey} />
    </div>
  );
}
