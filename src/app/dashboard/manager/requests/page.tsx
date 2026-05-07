'use client';

/**
 * Bandeja de solicitudes para Manager: aprobar/rechazar turnos y permisos.
 * Diseño: ref docs/design/screens/desktop.jsx DRequests (línea 440).
 */

import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { PermissionRequestsInbox } from '@/components/permissions/PermissionRequestsInbox';
import { RequestsInbox } from '@/components/requests/RequestsInbox';
import { Icons } from '@/components/ui/icons';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type Tab = 'shifts' | 'permissions';

export default function ManagerRequestsPage() {
  const searchParams = useSearchParams();
  const { orgId, canApproveRequests, isLoading, error } = useScheduleOrg();
  const [tab, setTab] = useState<Tab>('shifts');

  useEffect(() => {
    if (searchParams?.get('tab') === 'permissions') {
      setTab('permissions');
    }
  }, [searchParams]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Solicitudes" subtitle="Bandeja de aprobación" />
        <div className="rounded-2xl border border-border bg-surface p-6">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="mt-2 h-4 w-48" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Solicitudes" subtitle="Bandeja de aprobación" />
        <div className="rounded-2xl border border-border bg-surface p-6">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DashboardDesktopHeader
        title="Solicitudes"
        subtitle="Bandeja de aprobación"
      />

      {/* Switch entre Turnos y Permisos (extra de la app, no presente en mockup) */}
      <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-subtle-2 p-1">
        <button
          type="button"
          onClick={() => setTab('shifts')}
          aria-pressed={tab === 'shifts'}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
            tab === 'shifts'
              ? 'bg-bg text-text shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
              : 'text-text-sec hover:text-text'
          )}
        >
          <Icons.swap size={14} /> Turnos
        </button>
        <button
          type="button"
          onClick={() => setTab('permissions')}
          aria-pressed={tab === 'permissions'}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
            tab === 'permissions'
              ? 'bg-bg text-text shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
              : 'text-text-sec hover:text-text'
          )}
        >
          <Icons.beach size={14} /> Permisos
        </button>
      </div>

      {tab === 'shifts' ? (
        <RequestsInbox orgId={orgId} canApprove={canApproveRequests} />
      ) : (
        <PermissionRequestsInbox orgId={orgId} canApprove={canApproveRequests} />
      )}
    </div>
  );
}
