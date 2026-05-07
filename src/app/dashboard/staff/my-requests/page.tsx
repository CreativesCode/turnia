'use client';

/**
 * Mis solicitudes: tabs Todas/Pendientes/Aceptadas/Rechazadas + callout amber para
 * intercambios donde el usuario es target y debe responder.
 * Diseño: ref docs/design/screens/mobile.jsx MMyRequests (línea 584).
 */

import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { MyPermissionRequestsList } from '@/components/permissions/MyPermissionRequestsList';
import { PermissionRequestModal } from '@/components/permissions/PermissionRequestModal';
import { MyRequestsList } from '@/components/requests/MyRequestsList';
import { PendingSwapsForYou } from '@/components/requests/PendingSwapsForYou';
import { Icons } from '@/components/ui/icons';
import { Skeleton } from '@/components/ui/Skeleton';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { useCallback, useState } from 'react';

export default function StaffMyRequestsPage() {
  const { orgId, userId, isLoading, error } = useScheduleOrg();
  const [refreshKey, setRefreshKey] = useState(0);
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);

  const onResolved = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Solicitudes" subtitle="Tu actividad reciente" />
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Solicitudes" subtitle="Tu actividad reciente" />
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
        subtitle="Tu actividad reciente"
        actions={
          <button
            type="button"
            onClick={() => setPermissionModalOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[12.5px] font-semibold text-white transition-transform hover:-translate-y-px"
            style={{ boxShadow: '0 6px 16px -8px var(--primary)' }}
          >
            <Icons.plus size={14} stroke={2.6 as unknown as number} /> Permiso
          </button>
        }
      />

      {/* Action-needed callout: swaps que esperan tu respuesta */}
      <PendingSwapsForYou
        orgId={orgId}
        userId={userId}
        refreshKey={refreshKey}
        onResolved={onResolved}
      />

      {/* Lista de solicitudes propias */}
      <MyRequestsList orgId={orgId} userId={userId} refreshKey={refreshKey} />

      {/* Permisos (extra de la app, no presente en mockup) */}
      <div>
        <p className="tn-h mb-2 text-[12px] font-bold uppercase tracking-[0.06em] text-muted">Permisos</p>
        <MyPermissionRequestsList orgId={orgId} userId={userId} refreshKey={refreshKey} />
      </div>

      {userId && (
        <PermissionRequestModal
          open={permissionModalOpen}
          onClose={() => setPermissionModalOpen(false)}
          onSuccess={onResolved}
          currentUserId={userId}
        />
      )}
    </div>
  );
}
