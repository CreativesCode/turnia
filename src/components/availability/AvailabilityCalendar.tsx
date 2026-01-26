'use client';

/**
 * Calendario de disponibilidad del usuario (vacaciones, licencia, etc.).
 * Solo muestra los propios eventos. Clic en evento: editar/eliminar. Botón Agregar y clic en día: nuevo.
 * @see project-roadmap.md Módulo 6.1
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
  userId: string | null;
  refreshKey?: number;
  onAddClick?: (initialStart?: Date) => void;
  onEventClick?: (event: AvailabilityEvent) => void;
};

function AvailabilityCalendarInner({ orgId, userId, refreshKey = 0, onAddClick, onEventClick }: Props) {
  const [events, setEvents] = useState<AvailabilityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);

  const fetchEvents = useCallback(
    async (start: Date, end: Date) => {
      if (!orgId || !userId) return;
      setLoading(true);
      setError(null);
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from('availability_events')
        .select('id, org_id, user_id, type, start_at, end_at, note, created_at, updated_at')
        .eq('org_id', orgId)
        .eq('user_id', userId)
        .gte('end_at', start.toISOString())
        .lte('start_at', end.toISOString())
        .order('start_at', { ascending: true });

      if (err) {
        setError(err.message);
        setEvents([]);
      } else {
        setEvents((data ?? []) as AvailabilityEvent[]);
      }
      setLoading(false);
    },
    [orgId, userId]
  );

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setRange({ start: arg.start, end: arg.end });
  }, []);

  useEffect(() => {
    if (range && orgId && userId) fetchEvents(range.start, range.end);
  }, [orgId, userId, refreshKey, range, fetchEvents]);

  const fcEvents = useMemo(() => {
    return events.map((e) => {
      const label = getTypeLabel(e.type);
      const title = e.note?.trim() ? `${label}: ${e.note.trim()}` : label;
      const color = getTypeColor(e.type);
      return {
        id: e.id,
        title,
        start: e.start_at,
        end: e.end_at,
        backgroundColor: color,
        borderColor: color,
        extendedProps: { availabilityEvent: e },
      };
    });
  }, [events]);

  const handleEventClick = useCallback(
    (arg: EventClickArg) => {
      arg.jsEvent.preventDefault();
      const ev = arg.event.extendedProps?.availabilityEvent as AvailabilityEvent | undefined;
      if (ev) onEventClick?.(ev);
    },
    [onEventClick]
  );

  const handleDateClick = useCallback(
    (arg: { date: Date }) => {
      onAddClick?.(arg.date);
    },
    [onAddClick]
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
    () => ({
      today: 'Hoy',
      month: 'Mes',
      list: 'Lista',
    }),
    []
  );

  if (!orgId || !userId) {
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
          dateClick={handleDateClick}
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

export const AvailabilityCalendar = memo(AvailabilityCalendarInner);
