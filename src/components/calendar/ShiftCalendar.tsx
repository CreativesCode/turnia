'use client';

/**
 * Calendario de turnos con FullCalendar.
 * Vistas: mes (dayGrid), semana/día (timeGrid), lista.
 * Carga turnos desde Supabase (join organization_shift_types) y colorea por tipo.
 * @see project-roadmap.md Módulo 3.1
 */

import { useCallback, useEffect, useMemo, useRef, useState, memo, type TouchEvent as ReactTouchEvent } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getCacheEntry, setCache } from '@/lib/cache';

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
) as any;

type ShiftCalendarCache = {
  shifts: ShiftWithType[];
  profilesMap: Record<string, string>;
};

function ymd(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function filtersKey(filters?: ShiftCalendarFiltersState): string {
  if (!filters) return 'filters:none';
  const types = (filters.shiftTypeIds ?? []).slice().sort().join(',');
  const user = filters.userId ?? '';
  const status = filters.status ?? 'all';
  return `filters:types=${types}|user=${user}|status=${status}`;
}

function calendarCacheKey(orgId: string, start: Date, end: Date, filters?: ShiftCalendarFiltersState) {
  return `turnia:cache:calendarShifts:${orgId}:${ymd(start)}:${ymd(end)}:${filtersKey(filters)}`;
}

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
  /**
   * Variante visual para mobile: el header del calendario queda más limpio
   * para acompañarlo con acciones externas (p. ej. botón "Hoy" + filtros).
   */
  compactHeader?: boolean;
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
  compactHeader = false,
}: Props) {
  const isMobile = useIsMobile('768px');
  const { isOnline } = useOnlineStatus();
  const calendarRef = useRef<any>(null);
  const calendarContainerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number; at: number } | null>(null);
  const lastSwipeAtRef = useRef(0);
  const [events, setEvents] = useState<ShiftWithType[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [usingCache, setUsingCache] = useState(false);
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);

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

  const fetchShifts = useCallback(
    async (start: Date, end: Date) => {
      if (!orgId) return;
      setLoading(true);
      setError(null);
      setNotice(null);
      setUsingCache(false);

      const key = calendarCacheKey(orgId, start, end, filters);
      const cached = getCacheEntry<ShiftCalendarCache>(key, {
        maxAgeMs: 1000 * 60 * 60 * 24 * 45, // 45 días
      });

      // Offline-first (fase 2): si no hay conexión, usar cache si existe.
      if (!isOnline) {
        if (cached) {
          setEvents(cached.data.shifts);
          setProfilesMap(cached.data.profilesMap);
          setUsingCache(true);
          setNotice(
            `Sin conexión. Mostrando datos guardados (${new Date(cached.savedAt).toLocaleString('es-ES')}).`
          );
          setLoading(false);
          return;
        }
        setEvents([]);
        setProfilesMap({});
        setError('Sin conexión y sin datos guardados para este rango.');
        setLoading(false);
        return;
      }

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
        if (cached) {
          setEvents(cached.data.shifts);
          setProfilesMap(cached.data.profilesMap);
          setUsingCache(true);
          setNotice(
            `No se pudo actualizar. Mostrando datos guardados (${new Date(cached.savedAt).toLocaleString('es-ES')}).`
          );
          setLoading(false);
          return;
        }
        setError(shiftsErr.message);
        setEvents([]);
        setProfilesMap({});
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
      let nextProfilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        const map: Record<string, string> = {};
        for (const p of profiles ?? []) {
          map[p.id] = p.full_name ?? '';
        }
        nextProfilesMap = map;
        setProfilesMap(map);
      } else {
        nextProfilesMap = {};
        setProfilesMap({});
      }

      setCache(key, { shifts: list, profilesMap: nextProfilesMap });
      setLoading(false);
    },
    [orgId, filters, isOnline]
  );

  const handleDatesSet = useCallback(
    (arg: DatesSetArg) => {
      setRange({ start: arg.start, end: arg.end });
      // Asegurar hints/labels en botones tras el render del toolbar.
      window.setTimeout(() => applyButtonHintsToDom(), 0);
    },
    [applyButtonHintsToDom]
  );

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

  useEffect(() => {
    // Evitar setState sincrónico en el cuerpo del effect (eslint react-hooks/set-state-in-effect)
    const t = window.setTimeout(() => {
      if (range && orgId) void fetchShifts(range.start, range.end);
    }, 0);
    return () => window.clearTimeout(t);
  }, [orgId, refreshKey, range, fetchShifts, isOnline]);

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
      // Evitar que un swipe abra el detalle por error (tap fantasma post-swipe).
      if (Date.now() - lastSwipeAtRef.current < 350) return;
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

  useEffect(() => {
    const t = window.setTimeout(() => applyButtonHintsToDom(), 0);
    return () => window.clearTimeout(t);
  }, [applyButtonHintsToDom, isMobile, canManageShifts]);

  const handleTouchStart = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      if (!isMobile) return;
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      touchStartRef.current = { x: t.clientX, y: t.clientY, at: Date.now() };
    },
    [isMobile]
  );

  const handleTouchEnd = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      if (!isMobile) return;

      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (!start) return;

      const t = e.changedTouches?.[0];
      if (!t) return;

      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const dt = Date.now() - start.at;

      // Gestos "intencionales": rápidos, horizontales y con umbral suficiente.
      // Evita interferir con scroll vertical y taps.
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (dt > 700) return;
      if (absX < 60) return;
      if (absX < absY * 1.2) return;

      // Evitar conflicto con el gesto del sistema (back) en los bordes.
      if (typeof window !== 'undefined') {
        const edge = 20;
        if (start.x < edge || start.x > window.innerWidth - edge) return;
      }

      const api = calendarRef.current?.getApi?.();
      if (!api) return;
      lastSwipeAtRef.current = Date.now();
      if (dx < 0) api.next();
      else api.prev();
    },
    [isMobile]
  );

  const handleTouchCancel = useCallback(() => {
    touchStartRef.current = null;
  }, []);

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
          className={`rounded-lg border p-3 text-sm ${
            usingCache
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
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
          role="region"
          aria-label="Calendario de turnos"
          aria-describedby={isMobile ? 'shift-calendar-swipe-hint' : undefined}
          aria-busy={loading || undefined}
          ref={calendarContainerRef}
        >
          <FullCalendar
            ref={calendarRef}
            plugins={plugins}
            initialView="dayGridMonth"
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
