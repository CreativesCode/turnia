'use client';

/**
 * Calendario de turnos con FullCalendar.
 * Vistas: mes (dayGrid), semana/día (timeGrid), lista.
 * Carga turnos desde Supabase (join organization_shift_types) y colorea por tipo.
 * @see project-roadmap.md Módulo 3.1
 */

import { useIsMobile } from '@/hooks/useIsMobile';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import dynamic from 'next/dynamic';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { CalendarEventContent } from './CalendarEventContent';
import { useCalendarTouch } from './useCalendarTouch';
import { useShiftCalendar } from './useShiftCalendar';

import type { EventClickArg, EventContentArg } from '@fullcalendar/core';
import esLocale from '@fullcalendar/core/locales/es';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import timeGridPlugin from '@fullcalendar/timegrid';
import type { ShiftCalendarFiltersState } from './ShiftCalendarFilters';
import type { ShiftWithType } from './shiftCalendarTypes';

const FullCalendar = dynamic(
  () => import('@fullcalendar/react').then((m) => m.default),
  { ssr: false }
) as any;

export type { ShiftWithType } from './shiftCalendarTypes';

type Props = {
  orgId: string;
  canManageShifts: boolean;
  refreshKey?: number;
  filters?: ShiftCalendarFiltersState;
  onEventClick?: (shift: ShiftWithType, assignedName: string | null) => void;
  onDateClick?: (date: Date) => void;
  /**
   * Variante visual para mobile: el header del calendario queda más limpio
   * para acompañarlo con acciones externas (p. ej. botón "Hoy" + filtros).
   */
  compactHeader?: boolean;
  /**
   * Vista inicial del calendario. Por defecto usa 'dayGridMonth'.
   */
  initialView?: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek';
};

function ShiftCalendarInner({
  orgId,
  canManageShifts,
  refreshKey = 0,
  filters,
  onEventClick,
  onDateClick,
  compactHeader = false,
  initialView = 'dayGridMonth',
}: Props) {
  const isMobile = useIsMobile('768px');
  const { isOnline } = useOnlineStatus();
  const calendarRef = useRef<any>(null);
  const calendarContainerRef = useRef<HTMLDivElement>(null);
  const { lastSwipeAtRef, onTouchCancel, onTouchEnd, onTouchStart } = useCalendarTouch({ isMobile, calendarRef });

  const applyButtonHintsToDom = useCallback(() => {
    const root = calendarContainerRef.current;
    if (!root) return;

    const hints: Record<string, string> = {
      '.fc-prev-button': 'Período anterior',
      '.fc-next-button': 'Período siguiente',
      '.fc-today-button': 'Ir a hoy',
      '.fc-dayGridMonth-button': 'Vista mensual',
      '.fc-timeGridWeek-button': 'Vista semanal',
      '.fc-timeGridDay-button': 'Vista diaria',
      '.fc-listWeek-button': 'Vista lista',
    };

    for (const [selector, hint] of Object.entries(hints)) {
      const el = root.querySelector<HTMLButtonElement>(selector);
      if (!el) continue;
      el.setAttribute('title', hint);
      // FullCalendar ya genera aria-label, pero lo reforzamos para consistencia.
      el.setAttribute('aria-label', hint);
    }
  }, []);

  const { loading, error, notice, usingCache, range, fcEvents, fetchShifts, handleDatesSet } = useShiftCalendar({
    orgId,
    refreshKey,
    filters,
    isOnline,
    onToolbarRendered: applyButtonHintsToDom,
  });

  const handleEventDidMount = useCallback(
    (info: any) => {
      try {
        const title = info?.event?.title as string | undefined;
        const el = info?.el as HTMLElement | undefined;
        if (el && title) el.setAttribute('aria-label', title);
        if (!el) return;
        // Asegurar activación por teclado (Enter/Espacio) sin acumular listeners.
        (el as HTMLElement).onkeydown = (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            (el as HTMLElement).click?.();
          }
        };
      } catch {
        // ignore
      }
    },
    []
  );

  const handleEventClick = useCallback(
    (arg: EventClickArg) => {
      if (Date.now() - lastSwipeAtRef.current < 350) return;
      arg.jsEvent.preventDefault();
      const props = arg.event.extendedProps as {
        shift?: ShiftWithType;
        assignedName?: string | null;
        isAvailability?: boolean;
      };
      if (props.isAvailability) return;
      onEventClick?.(props.shift!, props.assignedName ?? null);
    },
    [onEventClick]
  );

  const handleDateClick = useCallback(
    (arg: { date: Date }) => {
      if (Date.now() - lastSwipeAtRef.current < 350) return;
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
        ? compactHeader
          ? { left: 'prev,next today', center: 'title', right: '' }
          : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,listWeek' }
        : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' },
    [isMobile, compactHeader]
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

  const buttonHints = useMemo(
    () => ({
      today: 'Ir a hoy',
      prev: 'Período anterior',
      next: 'Período siguiente',
      dayGridMonth: 'Vista mensual',
      timeGridWeek: 'Vista semanal',
      timeGridDay: 'Vista diaria',
      listWeek: 'Vista lista',
    }),
    []
  );

  const renderEventContent = useCallback((arg: EventContentArg) => {
    const props = (arg.event.extendedProps ?? {}) as {
      shift?: ShiftWithType;
      assignedName?: string | null;
      isAvailability?: boolean;
      userName?: string | null;
    };
    const color = arg.event.backgroundColor ?? '#6B7280';
    if (props.isAvailability) {
      const name = props.userName?.trim() || arg.event.title;
      return <CalendarEventContent title={arg.event.title} letter="∅" color={color} name={name} />;
    }
    const letter = props.shift?.organization_shift_types?.letter ?? '?';
    const name = props.assignedName?.trim() || 'Sin asignar';
    return <CalendarEventContent title={arg.event.title} letter={letter} color={color} name={name} />;
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => applyButtonHintsToDom(), 0);
    return () => window.clearTimeout(t);
  }, [applyButtonHintsToDom, isMobile, canManageShifts]);

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
    <div className="space-y-3">
      {notice && (
        <div
          className={`rounded-lg border p-3 text-sm ${usingCache
            ? 'border-amber-200 bg-amber-50 text-amber-800'
            : 'border-border bg-background text-text-secondary'
            }`}
          role="status"
          aria-live="polite"
        >
          {notice}
        </div>
      )}

      <div className="relative">
        {loading && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center rounded-xl border border-border bg-background/80"
            role="status"
            aria-live="polite"
          >
            <span className="text-sm text-muted">Cargando…</span>
          </div>
        )}
        {isMobile && (
          <p id="shift-calendar-swipe-hint" className="sr-only">
            Podés deslizar hacia la izquierda o derecha para cambiar el período del calendario.
          </p>
        )}
        <div
          className={[
            'min-h-[400px] overflow-hidden rounded-xl border border-border bg-background',
            // Cuando usamos acciones externas en mobile, ocultamos el botón "Hoy" del toolbar para evitar duplicado.
            compactHeader && isMobile ? '[&_.fc-today-button]:hidden' : '',
          ].join(' ')}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchCancel}
          role="region"
          aria-label="Calendario de turnos"
          aria-describedby={isMobile ? 'shift-calendar-swipe-hint' : undefined}
          aria-busy={loading || undefined}
          ref={calendarContainerRef}
        >
          <FullCalendar
            ref={calendarRef}
            plugins={plugins}
            initialView={initialView}
            headerToolbar={headerToolbar}
            buttonText={buttonText}
            buttonHints={buttonHints as any}
            locale={esLocale}
            events={fcEvents}
            eventContent={renderEventContent}
            eventOrder="start"
            datesSet={handleDatesSet}
            eventClick={handleEventClick}
            eventDidMount={handleEventDidMount}
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
    </div>
  );
}

export const ShiftCalendar = memo(ShiftCalendarInner);
