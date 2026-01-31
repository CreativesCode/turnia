'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { QuickActions } from '@/components/mobile/QuickActions';
import { MyUpcomingShiftsWidget } from '@/components/mobile/MyUpcomingShiftsWidget';
import { OnCallNowWidget } from '@/components/mobile/OnCallNowWidget';
import { ShiftDetailModal } from '@/components/shifts/ShiftDetailModal';
import type { ShiftWithType } from '@/components/calendar/ShiftCalendar';
import { LinkButton } from '@/components/ui/LinkButton';
import { Skeleton } from '@/components/ui/Skeleton';

export default function StaffPage() {
  const { orgId, userId, canManageShifts, canCreateRequests, isLoading, error } = useScheduleOrg();
  const [myName, setMyName] = useState<string | null>(null);
  const [detailShift, setDetailShift] = useState<ShiftWithType | null>(null);
  const [detailAssignedName, setDetailAssignedName] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const t = window.setTimeout(() => {
      void supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single()
        .then(({ data }) => setMyName((data as { full_name?: string | null } | null)?.full_name ?? null));
    }, 0);
    return () => window.clearTimeout(t);
  }, [userId]);

  const openShift = useCallback((shift: ShiftWithType, assignedName: string | null) => {
    setDetailShift(shift);
    setDetailAssignedName(assignedName);
  }, []);

  const scrollToId = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const actions = useMemo(() => {
    return [
      {
        id: 'my-upcoming',
        title: 'Mis próximos turnos',
        description: 'Ver y abrir detalle.',
        onClick: () => scrollToId('my-upcoming-shifts'),
      },
      {
        id: 'quick-request',
        title: 'Solicitar cambio rápido',
        description: 'Elige un turno y solicita baja/swap.',
        onClick: () => scrollToId('my-upcoming-shifts'),
      },
      {
        id: 'on-call',
        title: 'On-call now',
        description: 'Quién está de turno ahora.',
        onClick: () => scrollToId('on-call-now'),
      },
    ];
  }, [scrollToId]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-background p-6">
        <div className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-80" />
          <div className="flex flex-wrap gap-3 pt-2">
            <Skeleton className="h-11 w-40 rounded-lg" />
            <Skeleton className="h-11 w-40 rounded-lg" />
            <Skeleton className="h-11 w-40 rounded-lg" />
          </div>
        </div>
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
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-text-primary">Staff</h1>
        <p className="text-text-secondary">Mis turnos, solicitudes (dar turno, swap, tomar abierto) y disponibilidad.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <LinkButton href="/dashboard/staff/my-requests" variant="primary">
          Mis solicitudes
        </LinkButton>
        <LinkButton href="/dashboard/staff/availability" variant="secondary">
          Mi disponibilidad
        </LinkButton>
        <LinkButton href="/dashboard/manager" variant="secondary">
          Ver calendario
        </LinkButton>
      </div>

      <QuickActions items={actions} />

      <MyUpcomingShiftsWidget
        orgId={orgId}
        userId={userId}
        onSelectShift={(s) => openShift(s, (myName?.trim() || 'Yo') as string)}
      />

      <OnCallNowWidget orgId={orgId} onSelectShift={(s, name) => openShift(s, name)} />

      <ShiftDetailModal
        open={!!detailShift}
        onClose={() => {
          setDetailShift(null);
          setDetailAssignedName(null);
        }}
        onEdit={() => {}}
        onDeleted={() => {}}
        onRequestCreated={() => {}}
        shift={detailShift}
        assignedName={detailAssignedName}
        canManageShifts={canManageShifts}
        canCreateRequests={canCreateRequests}
        currentUserId={userId}
      />
    </div>
  );
}
