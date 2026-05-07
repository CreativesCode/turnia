'use client';

/**
 * Página "Agenda del día": timeline horizontal con las personas y sus turnos del día.
 * Diseño: ref docs/design/screens/extras.jsx MDailySchedule (línea 180).
 */

import type { ShiftWithType } from '@/components/calendar/ShiftCalendar';
import { DailyShiftsList } from '@/components/daily/DailyShiftsList';
import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { ShiftDetailModal } from '@/components/shifts/ShiftDetailModal';
import { Skeleton } from '@/components/ui/Skeleton';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { useSelectedOrg } from '@/hooks/useSelectedOrg';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function DailySchedulePage() {
  const searchParams = useSearchParams();
  const { selectedOrgId, organizations, isLoading: isLoadingOrgs } = useSelectedOrg();
  const { orgId, userId, canManageShifts, canCreateRequests, isLoading: isLoadingSchedule, error } = useScheduleOrg();
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
        .single();
      if (e || !s) return;
      const ot = Array.isArray((s as { organization_shift_types?: unknown }).organization_shift_types)
        ? (s as { organization_shift_types?: unknown[] }).organization_shift_types?.[0]
        : (s as { organization_shift_types?: unknown }).organization_shift_types;
      const shift: ShiftWithType = { ...s, organization_shift_types: ot ?? null } as ShiftWithType;
      let name: string | null = null;
      if (shift.assigned_user_id) {
        const { data: p } = await supabase.from('profiles').select('full_name').eq('id', shift.assigned_user_id).single();
        name = (p as { full_name?: string } | null)?.full_name ?? null;
      }
      setDetailShift(shift);
      setDetailAssignedName(name);
    })();
  }, [orgId, searchParams]);

  const handleShiftClick = useCallback((shift: ShiftWithType, assignedName: string | null) => {
    setDetailShift(shift);
    setDetailAssignedName(assignedName);
  }, []);

  const selectedOrg = organizations.find((o) => o.id === selectedOrgId);

  if (isLoadingOrgs || isLoadingSchedule) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Agenda del día" subtitle="Timeline diario por persona" />
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
        <DashboardDesktopHeader title="Agenda del día" subtitle="Timeline diario por persona" />
        <div className="rounded-2xl border border-border bg-surface p-6">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!orgId || !selectedOrgId) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Agenda del día" subtitle="Timeline diario por persona" />
        <div className="rounded-2xl border border-border bg-surface p-6">
          <h1 className="text-xl font-semibold text-text">Agenda del día</h1>
          <p className="mt-2 text-sm text-muted">
            {organizations.length === 0
              ? 'No tienes ninguna organización asignada. Contacta a un administrador para unirte a una.'
              : 'Selecciona una organización para ver sus turnos.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DashboardDesktopHeader
        title="Agenda del día"
        subtitle={selectedOrg ? selectedOrg.name : 'Timeline diario por persona'}
      />

      <DailyShiftsList orgId={orgId} currentUserId={userId} onShiftClick={handleShiftClick} />

      <ShiftDetailModal
        open={!!detailShift}
        onClose={() => {
          setDetailShift(null);
          setDetailAssignedName(null);
        }}
        onEdit={() => {
          setDetailShift(null);
          setDetailAssignedName(null);
        }}
        onDeleted={() => {
          setDetailShift(null);
          setDetailAssignedName(null);
        }}
        onRequestCreated={() => {
          setDetailShift(null);
          setDetailAssignedName(null);
        }}
        shift={detailShift}
        assignedName={detailAssignedName}
        canManageShifts={canManageShifts}
        canCreateRequests={canCreateRequests}
        currentUserId={userId}
      />
    </div>
  );
}
