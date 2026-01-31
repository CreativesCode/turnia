'use client';

/**
 * Bandeja de solicitudes para Manager: aprobar/rechazar.
 * @see project-roadmap.md Módulo 4.2
 */

import Link from 'next/link';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { RequestsInbox } from '@/components/requests/RequestsInbox';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/toast/ToastProvider';

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
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-xl font-semibold text-text-primary">Solicitudes de turnos</h1>
        <Link href="/dashboard/manager" className="text-sm text-primary-600 hover:text-primary-700">
          ← Calendario
        </Link>
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
