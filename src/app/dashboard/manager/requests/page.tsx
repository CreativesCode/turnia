'use client';

/**
 * Bandeja de solicitudes para Manager: aprobar/rechazar.
 * @see project-roadmap.md Módulo 4.2
 */

import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { RequestsInbox } from '@/components/requests/RequestsInbox';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { useCallback, useState } from 'react';

export default function ManagerRequestsPage() {
  const { orgId, canApproveRequests, isLoading, error } = useScheduleOrg();
  const [refreshKey, setRefreshKey] = useState(0);
  const { toast } = useToast();

  const onRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    toast({ variant: 'info', title: 'Actualizando', message: 'Actualizando solicitudes…' });
  }, [toast]);

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
      <DashboardDesktopHeader title="Solicitudes de turnos" subtitle="Bandeja de aprobación y seguimiento" />

      {/* Header (móvil inspirado en "Bandeja Solicitudes - Mobile") */}
      <div className="flex items-center justify-between gap-3 md:hidden">
        <h1 className="text-lg font-semibold text-text-primary">Bandeja de Solicitudes</h1>
        <Button type="button" variant="secondary" size="sm" onClick={onRefresh}>
          Actualizar
        </Button>
      </div>

      {/* Acciones desktop */}
      <div className="hidden flex-wrap items-center gap-4 md:flex">
        <Button type="button" variant="secondary" onClick={onRefresh} className="ml-auto">
          Actualizar
        </Button>
      </div>
      <p className="text-sm text-muted">
        Revisa las solicitudes de dar de baja, intercambio y tomar turnos abiertos. Aprobar o rechazar según corresponda.
      </p>
      <RequestsInbox orgId={orgId} canApprove={canApproveRequests} refreshKey={refreshKey} />
    </div>
  );
}
