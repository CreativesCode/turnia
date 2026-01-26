'use client';

/**
 * Calendario de turnos con FullCalendar.
 * Vistas: mes (dayGrid), semana/día (timeGrid), lista.
 * Carga turnos desde Supabase (join organization_shift_types) y colorea por tipo.
 * @see project-roadmap.md Módulo 3.1
 */

import { useCallback, useEffect, useMemo, useState, memo } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/hooks/useIsMobile';

import type { EventClickArg, DatesSetArg } from '@fullcalendar/core';
import type { ShiftCalendarFiltersState } from './ShiftCalendarFilters';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';

const FullCalendar = dynamic(
  () => import('@fullcalendar/react').then((m) => m.default),
  { ssr: false }
);

// Tipos
export type ShiftWithType = {
  id: string;
  org_id: string;
  shift_type_id: string;
  status: string;
  start_at: string;
  end_at: string;
  assigned_user_id: string | null;
  location: string | null;
  organization_shift_types: {
    id: string;
    name: string;
    letter: string;
    color: string;
    start_time: string | null;
    end_time: string | null;
  } | null;
};

type Props = {
  orgId: string;
  canManageShifts: boolean;
  refreshKey?: number;
  filters?: ShiftCalendarFiltersState;
  onEventClick?: (shift: ShiftWithType, assignedName: string | null) => void;
  onDateClick?: (date: Date) => void;
};

function formatEventTitle(letter: string, assignedName: string | null): string {
  if (assignedName?.trim()) return `${letter} – ${assignedName.trim()}`;
  return `${letter} – Sin asignar`;
}

/**
 * Renderizado: la barra usa el color del tipo de turno (backgroundColor de FullCalendar).
 * Círculo blanco con la letra en color del turno + nombre en blanco.
 */
function renderEventContent(arg: { event: { extendedProps?: { shift?: ShiftWithType; assignedName?: string | null }; backgroundColor?: string; title?: string } }) {
  const shift = arg.event.extendedProps?.shift;
  const letter = shift?.organization_shift_types?.letter ?? '?';
  const color = arg.event.backgroundColor ?? '#6B7280';
  const assignedName = arg.event.extendedProps?.assignedName;
  const name = assignedName?.trim() || 'Sin asignar';

  const wrap = document.createElement('div');
  wrap.className = 'fc-event-main-frame';
  wrap.style.cssText = 'display:flex;align-items:center;gap:6px;min-width:0;';
  if (arg.event.title) wrap.setAttribute('title', arg.event.title);

  const circle = document.createElement('span');
  circle.style.cssText = `width:18px;height:18px;min-width:18px;min-height:18px;border-radius:50%;background:#fff;color:${color};display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;line-height:1;`;
  circle.textContent = letter;

  const text = document.createElement('span');
  text.style.cssText = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff;';
  text.textContent = name;

  wrap.appendChild(circle);
  wrap.appendChild(text);
  return { domNodes: [wrap] };
}

function ShiftCalendarInner({
  orgId,
  canManageShifts,
  refreshKey = 0,
  filters,
  onEventClick,
  onDateClick,
}: Props) {
  const isMobile = useIsMobile('768px');
  const [events, setEvents] = useState<ShiftWithType[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);

  const fetchShifts = useCallback(
    async (start: Date, end: Date) => {
      if (!orgId) return;
      setLoading(true);
      setError(null);
      const supabase = createClient();
      const startStr = start.toISOString();
      const endStr = end.toISOString();

      let query = supabase
        .from('shifts')
        .select(
          `
          id, org_id, shift_type_id, status, start_at, end_at, assigned_user_id, location,
          organization_shift_types (id, name, letter, color, start_time, end_time)
        `
        )
        .eq('org_id', orgId)
        .gte('end_at', startStr)
        .lte('start_at', endStr)
        .order('start_at', { ascending: true });

      if (filters) {
        if (filters.shiftTypeIds.length > 0) {
          query = query.in('shift_type_id', filters.shiftTypeIds);
        }
        if (filters.userId) {
          query = query.eq('assigned_user_id', filters.userId);
        }
        if (filters.status !== 'all') {
          query = query.eq('status', filters.status);
        }
      }

      const { data: shiftsData, error: shiftsErr } = await query;

      if (shiftsErr) {
        setError(shiftsErr.message);
        setEvents([]);
        setLoading(false);
        return;
      }

      const raw = (shiftsData ?? []) as {
        id: string;
        org_id: string;
        shift_type_id: string;
        status: string;
        start_at: string;
        end_at: string;
        assigned_user_id: string | null;
        location: string | null;
        organization_shift_types?: ShiftWithType['organization_shift_types'] | ShiftWithType['organization_shift_types'][];
      }[];
      const list: ShiftWithType[] = raw.map((s) => {
        const ot = s.organization_shift_types;
        const single = Array.isArray(ot) ? (ot[0] ?? null) : ot ?? null;
        return { ...s, organization_shift_types: single } as ShiftWithType;
      });
      setEvents(list);

      const userIds = [...new Set(list.map((s) => s.assigned_user_id).filter(Boolean))] as string[];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        const map: Record<string, string> = {};
        for (const p of profiles ?? []) {
          map[p.id] = p.full_name ?? '';
        }
        setProfilesMap(map);
      } else {
        setProfilesMap({});
      }
      setLoading(false);
    },
    [orgId, filters]
  );

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setRange({ start: arg.start, end: arg.end });
  }, []);

  useEffect(() => {
    if (range && orgId) fetchShifts(range.start, range.end);
  }, [orgId, refreshKey, range, fetchShifts]);

  const fcEvents = useMemo(() => {
    return events.map((s) => {
      const t = s.organization_shift_types;
      const letter = t?.letter ?? '?';
      const color = t?.color ?? '#6B7280';
      const name = s.assigned_user_id ? profilesMap[s.assigned_user_id] ?? null : null;
      return {
        id: s.id,
        title: formatEventTitle(letter, name),
        start: s.start_at,
        end: s.end_at,
        backgroundColor: color,
        borderColor: color,
        extendedProps: { shift: s, assignedName: name ?? null },
      };
    });
  }, [events, profilesMap]);

  const handleEventClick = useCallback(
    (arg: EventClickArg) => {
      arg.jsEvent.preventDefault();
      const { shift, assignedName } = arg.event.extendedProps as {
        shift: ShiftWithType;
        assignedName: string | null;
      };
      onEventClick?.(shift, assignedName);
    },
    [onEventClick]
  );

  const handleDateClick = useCallback(
    (arg: { date: Date }) => {
      if (canManageShifts) onDateClick?.(arg.date);
    },
    [canManageShifts, onDateClick]
  );

  const plugins = useMemo(
    () => [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
    []
  );

  const headerToolbar = useMemo(
    () =>
      isMobile
        ? { left: 'prev,next today', center: 'title', right: 'dayGridMonth,listWeek' }
        : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' },
    [isMobile]
  );

  const buttonText = useMemo(
    () => ({
      today: 'Hoy',
      month: 'Mes',
      week: 'Semana',
      day: 'Día',
      list: 'Lista',
    }),
    []
  );

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-background p-6">
        <p className="text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => range && fetchShifts(range.start, range.end)}
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
          eventContent={renderEventContent}
          eventOrder="start"
          datesSet={handleDatesSet}
          eventClick={handleEventClick}
          dateClick={canManageShifts ? handleDateClick : undefined}
          selectable={false}
          selectMirror={false}
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          height="auto"
          nowIndicator
          dayMaxEvents={isMobile ? 2 : 3}
          moreLinkClick="popover"
          eventDisplay="block"
        />
      </div>
    </div>
  );
}

export const ShiftCalendar = memo(ShiftCalendarInner);
