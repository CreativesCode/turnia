'use client';

/**
 * Mis solicitudes: listar y cancelar (si draft/submitted/accepted).
 * Intercambios pendientes de tu aceptación (User B): aceptar/rechazar.
 * @see project-roadmap.md Módulo 4.1, 4.4
 */

import Link from 'next/link';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { MyRequestsList } from '@/components/requests/MyRequestsList';
import { PendingSwapsForYou } from '@/components/requests/PendingSwapsForYou';
import { useCallback, useState } from 'react';

export default function StaffMyRequestsPage() {
  const { orgId, userId, isLoading, error } = useScheduleOrg();
  const [refreshKey, setRefreshKey] = useState(0);

  const onRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

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
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-xl font-semibold text-text-primary">Mis solicitudes</h1>
        <Link
          href="/dashboard/staff"
          className="text-sm text-primary-600 hover:text-primary-700"
        >
          ← Staff
        </Link>
        <button
          type="button"
          onClick={onRefresh}
          className="ml-auto min-h-[44px] rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-subtle-bg"
        >
          Actualizar
        </button>
      </div>
      <p className="text-sm text-muted">
        Dar de baja, intercambiar o tomar turnos abiertos. Puedes cancelar solicitudes pendientes.
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
