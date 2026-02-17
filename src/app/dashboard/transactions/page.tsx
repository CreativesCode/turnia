'use client';

/**
 * Transacciones: gestión de cambios de turnos del usuario actual.
 * Accesible para todos los usuarios (staff, manager, admin). Cada cual gestiona sus propias transacciones.
 * Incluye solicitudes (dar de baja, swap, tomar turno) e intercambios pendientes de aceptación.
 */

import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { MyRequestsList } from '@/components/requests/MyRequestsList';
import { PendingSwapsForYou } from '@/components/requests/PendingSwapsForYou';
import { Button } from '@/components/ui/Button';
import { LinkButton } from '@/components/ui/LinkButton';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { useCallback, useState } from 'react';

export default function TransactionsPage() {
  const { orgId, userId, canManageShifts, isLoading, error } = useScheduleOrg();
  const [refreshKey, setRefreshKey] = useState(0);
  const { toast } = useToast();

  const onRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    toast({ variant: 'info', title: 'Actualizando', message: 'Actualizando transacciones…' });
  }, [toast]);

  const onResolved = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const calendarHref = canManageShifts ? '/dashboard/manager' : '/dashboard/staff';

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
      <DashboardDesktopHeader
        title="Transacciones"
        subtitle="Gestiona tus cambios de turnos: solicitudes, intercambios y swaps"
      />

      <div className="flex items-center justify-between gap-3 md:hidden">
        <h1 className="text-lg font-semibold text-text-primary">Transacciones</h1>
        <div className="flex items-center gap-2">
          <LinkButton href={calendarHref} variant="primary" size="sm">
            Nueva solicitud
          </LinkButton>
          <Button type="button" variant="secondary" size="sm" onClick={onRefresh}>
            Actualizar
          </Button>
        </div>
      </div>

      <div className="hidden flex-wrap items-center gap-3 md:flex">
        <Button type="button" variant="secondary" onClick={onRefresh} className="ml-auto">
          Actualizar
        </Button>
      </div>

      <p className="text-sm text-muted">
        Historial de solicitudes de cambio: dar de baja, intercambiar o tomar turnos abiertos. Para crear una nueva,
        abre el calendario, selecciona un turno y elige &quot;Solicitar cambio&quot;.
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
