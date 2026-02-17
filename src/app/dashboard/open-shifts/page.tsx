'use client';

/**
 * Página "Turnos vacantes": turnos sin asignación donde los usuarios pueden postularse.
 * Muestra solo los turnos que no tienen assigned_user_id y permite solicitar tomarlos.
 */

import type { ShiftWithType } from '@/components/calendar/ShiftCalendar';
import { ShiftCalendar } from '@/components/calendar/ShiftCalendar';
import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { ShiftDetailModal } from '@/components/shifts/ShiftDetailModal';
import { Skeleton } from '@/components/ui/Skeleton';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function OpenShiftsPage() {
  const searchParams = useSearchParams();
  const { orgId, userId, canManageShifts, canCreateRequests, isLoading, error } = useScheduleOrg();
  const [refreshKey, setRefreshKey] = useState(0);
  const [detailShift, setDetailShift] = useState<ShiftWithType | null>(null);
  const [detailAssignedName, setDetailAssignedName] = useState<string | null>(null);

  // Abrir detalle de turno desde ?shift=id (p. ej. desde notificaciones)
  useEffect(() => {
    const shiftId = searchParams.get('shift');
    if (!shiftId || !orgId) return;
    const supabase = createClient();
    (async () => {
      const { data: s, error: e } = await supabase
        .from('shifts')
        .select(
          `id, org_id, shift_type_id, status, start_at, end_at, assigned_user_id, location,
           organization_shift_types (id, name, letter, color, start_time, end_time)`
        )
        .eq('id', shiftId)
        .eq('org_id', orgId)
        .is('assigned_user_id', null)
        .single();
      if (e || !s) return;
      const ot = Array.isArray((s as { organization_shift_types?: unknown }).organization_shift_types)
        ? (s as { organization_shift_types?: unknown[] }).organization_shift_types?.[0]
        : (s as { organization_shift_types?: unknown }).organization_shift_types;
      const shift: ShiftWithType = { ...s, organization_shift_types: ot ?? null } as ShiftWithType;
      setDetailShift(shift);
      setDetailAssignedName(null); // Turnos vacantes no tienen asignado
    })();
  }, [orgId, searchParams]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleEventClick = useCallback((shift: ShiftWithType, assignedName: string | null) => {
    setDetailShift(shift);
    setDetailAssignedName(null); // Siempre null para turnos vacantes
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Turnos vacantes" subtitle="Turnos disponibles para postularse" />
        <div className="rounded-xl border border-border bg-background p-6">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="mt-2 h-4 w-48" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Turnos vacantes" subtitle="Turnos disponibles para postularse" />
        <div className="rounded-xl border border-border bg-background p-6">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Turnos vacantes" subtitle="Turnos disponibles para postularse" />
        <div className="rounded-xl border border-border bg-background p-6">
          <h1 className="text-xl font-semibold text-text-primary">Turnos vacantes</h1>
          <p className="mt-2 text-sm text-muted">
            No tienes una organización asignada. Contacta a un administrador para unirte a una.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DashboardDesktopHeader title="Turnos vacantes" subtitle="Turnos disponibles para postularse" />

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-medium">💡 Información</p>
        <p className="mt-1">
          Estos son los turnos que aún no tienen asignación. Haz clic en cualquier turno para ver los detalles y postularte para ocuparlo.
        </p>
      </div>

      <ShiftCalendar
        orgId={orgId}
        canManageShifts={false}
        refreshKey={refreshKey}
        filters={{ shiftTypeIds: [], userId: '__unassigned__', status: 'published' }}
        onEventClick={handleEventClick}
        compactHeader
      />

      <ShiftDetailModal
        open={!!detailShift}
        onClose={() => {
          setDetailShift(null);
          setDetailAssignedName(null);
        }}
        onDeleted={handleRefresh}
        onRequestCreated={handleRefresh}
        shift={detailShift}
        assignedName={null}
        canManageShifts={canManageShifts}
        canCreateRequests={canCreateRequests}
        currentUserId={userId}
      />
    </div>
  );
}
