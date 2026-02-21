'use client';

/**
 * Bandeja de solicitudes para Manager: aprobar/rechazar turnos y permisos.
 * @see project-roadmap.md Módulo 4.2
 */

import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { PermissionRequestsInbox } from '@/components/permissions/PermissionRequestsInbox';
import { RequestsInbox } from '@/components/requests/RequestsInbox';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

type Tab = 'shifts' | 'permissions';

export default function ManagerRequestsPage() {
  const searchParams = useSearchParams();
  const { orgId, canApproveRequests, isLoading, error } = useScheduleOrg();
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState<Tab>('shifts');

  useEffect(() => {
    if (searchParams?.get('tab') === 'permissions') {
      setTab('permissions');
    }
  }, [searchParams]);
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
      <DashboardDesktopHeader title="Solicitudes" subtitle="Bandeja de aprobación: turnos y permisos" />

      <div className="flex items-center justify-between gap-3 md:hidden">
        <h1 className="text-lg font-semibold text-text-primary">Bandeja de Solicitudes</h1>
        <Button type="button" variant="secondary" size="sm" onClick={onRefresh}>
          Actualizar
        </Button>
      </div>

      <div className="hidden flex-wrap items-center gap-4 md:flex">
        <Button type="button" variant="secondary" onClick={onRefresh} className="ml-auto">
          Actualizar
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-xl border border-border bg-background p-2">
        <button
          type="button"
          onClick={() => setTab('shifts')}
          className={`min-h-[40px] shrink-0 rounded-lg px-4 text-sm font-medium transition-colors ${
            tab === 'shifts' ? 'bg-primary-50 text-primary-700' : 'text-text-secondary hover:bg-subtle-bg'
          }`}
        >
          Turnos
        </button>
        <button
          type="button"
          onClick={() => setTab('permissions')}
          className={`min-h-[40px] shrink-0 rounded-lg px-4 text-sm font-medium transition-colors ${
            tab === 'permissions' ? 'bg-primary-50 text-primary-700' : 'text-text-secondary hover:bg-subtle-bg'
          }`}
        >
          Permisos
        </button>
      </div>

      {tab === 'shifts' ? (
        <>
          <p className="text-sm text-muted">
            Revisa las solicitudes de dar de baja, intercambio y tomar turnos abiertos.
          </p>
          <RequestsInbox orgId={orgId} canApprove={canApproveRequests} refreshKey={refreshKey} />
        </>
      ) : (
        <>
          <p className="text-sm text-muted">
            Revisa las solicitudes de permiso (vacaciones, licencia, capacitación, etc.).
          </p>
          <PermissionRequestsInbox orgId={orgId} canApprove={canApproveRequests} refreshKey={refreshKey} />
        </>
      )}
    </div>
  );
}
