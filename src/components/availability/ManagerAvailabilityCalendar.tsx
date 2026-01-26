'use client';

/**
 * Calendario de disponibilidad de todos los miembros (vista manager).
 * Solo lectura: clic en evento abre detalle. Sin agregar/editar.
 * @see project-roadmap.md Módulo 6.2
 */

import { useCallback, useEffect, useMemo, useState, memo } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import type { EventClickArg, DatesSetArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import { getTypeLabel, getTypeColor, type AvailabilityEvent } from './AvailabilityEventModal';

const FullCalendar = dynamic(
  () => import('@fullcalendar/react').then((m) => m.default),
  { ssr: false }
);

type Props = {
  orgId: string | null;
  userIdFilter: string | null;
  typeFilter: string[];
  onEventClick?: (event: AvailabilityEvent, userName: string | null) => void;
};

function ManagerAvailabilityCalendarInner({
  orgId,
  userIdFilter,
  typeFilter,
  onEventClick,
}: Props) {
  const [events, setEvents] = useState<AvailabilityEvent[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);

  const fetchMembers = useCallback(
    async (supabase: ReturnType<typeof createClient>) => {
      const { data: mData } = await supabase
        .from('memberships')
        .select('user_id')
        .eq('org_id', orgId!);
      const userIds = [...new Set((mData ?? []).map((r: { user_id: string }) => r.user_id))];
      if (userIds.length === 0) return {};
      const { data: pData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      return Object.fromEntries(
        ((pData ?? []) as { id: string; full_name: string | null }[]).map((p) => [
          p.id,
          p.full_name?.trim() || p.id,
        ])
      );
    },
    [orgId]
  );

  const fetchEvents = useCallback(
    async (start: Date, end: Date) => {
      if (!orgId) return;
      setLoading(true);
      setError(null);
      const supabase = createClient();

      let q = supabase
        .from('availability_events')
        .select('id, org_id, user_id, type, start_at, end_at, note, created_at, updated_at')
        .eq('org_id', orgId)
        .gte('end_at', start.toISOString())
        .lte('start_at', end.toISOString())
        .order('start_at', { ascending: true });

      if (userIdFilter) q = q.eq('user_id', userIdFilter);
      if (typeFilter.length > 0) q = q.in('type', typeFilter);

      const [evRes, names] = await Promise.all([q, fetchMembers(supabase)]);

      if (evRes.error) {
        setError(evRes.error.message);
        setEvents([]);
      } else {
        setEvents((evRes.data ?? []) as AvailabilityEvent[]);
      }
      setUserNames(names);
      setLoading(false);
    },
    [orgId, userIdFilter, typeFilter, fetchMembers]
  );

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setRange({ start: arg.start, end: arg.end });
  }, []);

  useEffect(() => {
    if (range && orgId) fetchEvents(range.start, range.end);
  }, [orgId, userIdFilter, typeFilter, range, fetchEvents]);

  const fcEvents = useMemo(() => {
    return events.map((e) => {
      const label = getTypeLabel(e.type);
      const name = userNames[e.user_id] ?? e.user_id;
      const title = e.note?.trim() ? `${name}: ${label} — ${e.note.trim()}` : `${name}: ${label}`;
      const color = getTypeColor(e.type);
      return {
        id: e.id,
        title,
        start: e.start_at,
        end: e.end_at,
        backgroundColor: color,
        borderColor: color,
        extendedProps: { availabilityEvent: e, userName: userNames[e.user_id] ?? null },
      };
    });
  }, [events, userNames]);

  const handleEventClick = useCallback(
    (arg: EventClickArg) => {
      arg.jsEvent.preventDefault();
      const ev = arg.event.extendedProps?.availabilityEvent as AvailabilityEvent | undefined;
      const u = (arg.event.extendedProps?.userName as string | null) ?? null;
      if (ev) onEventClick?.(ev, u);
    },
    [onEventClick]
  );

  const plugins = useMemo(() => [dayGridPlugin, listPlugin, interactionPlugin], []);
  const headerToolbar = useMemo(
    () => ({
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,listMonth',
    }),
    []
  );
  const buttonText = useMemo(
    () => ({ today: 'Hoy', month: 'Mes', list: 'Lista' }),
    []
  );

  if (!orgId) {
    return (
      <div className="rounded-xl border border-border bg-background p-6">
        <p className="text-sm text-muted">Cargando organización…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-background p-6">
        <p className="text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => range && fetchEvents(range.start, range.end)}
          className="mt-2 text-sm text-primary-600 hover:underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl border border-border bg-background/80">
          <span className="text-sm text-muted">Cargando…</span>
        </div>
      )}
      <div className="min-h-[400px] overflow-hidden rounded-xl border border-border bg-background">
        <FullCalendar
          plugins={plugins}
          initialView="dayGridMonth"
          headerToolbar={headerToolbar}
          buttonText={buttonText}
          locale={esLocale}
          events={fcEvents}
          eventOrder="start"
          datesSet={handleDatesSet}
          eventClick={handleEventClick}
          selectable={false}
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          height="auto"
          nowIndicator
          dayMaxEvents={4}
          moreLinkClick="popover"
          eventDisplay="block"
        />
      </div>
    </div>
  );
}

export const ManagerAvailabilityCalendar = memo(ManagerAvailabilityCalendarInner);
