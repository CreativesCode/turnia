'use client';

/**
 * Vista de disponibilidad para mobile: chips de tipos + year strip de 12 meses +
 * lista de próximos eventos con franja vertical del color del tipo.
 * Diseño: ref docs/design/screens/mobile.jsx MAvailability (línea 666).
 */

import {
  type AvailabilityEvent,
  getTypeColor,
  getTypeLabel,
} from '@/components/availability/AvailabilityEventModal';
import { Icons, type IconName } from '@/components/ui/icons';
import { Skeleton } from '@/components/ui/Skeleton';
import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useMemo, useState } from 'react';

const MONTH_INITIALS = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

type Props = {
  orgId: string | null;
  userId: string | null;
  refreshKey?: number;
  onAdd?: () => void;
  onEventClick?: (ev: AvailabilityEvent) => void;
};

const TYPE_CHIPS: { type: string; iconName: IconName; iconSize?: number }[] = [
  { type: 'vacation', iconName: 'beach', iconSize: 13 },
  { type: 'sick_leave', iconName: 'cross', iconSize: 13 },
  { type: 'training', iconName: 'edu', iconSize: 13 },
  { type: 'unavailable', iconName: 'x', iconSize: 13 },
];

const TYPE_TO_ICON: Record<string, IconName> = {
  vacation: 'beach',
  sick_leave: 'cross',
  training: 'edu',
  unavailable: 'x',
  vacaciones: 'beach',
  licencia_medica: 'cross',
  capacitacion: 'edu',
  no_disponible: 'x',
  administrativo: 'doc',
  descanso_compensatorio: 'moon',
  descanso_reparatorio: 'moon',
  permisos_especiales: 'shield',
};

function iconFor(type: string): IconName {
  return TYPE_TO_ICON[type] ?? 'cal2';
}

function formatLongDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const s = d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function eventDuration(ev: AvailabilityEvent): string {
  const s = new Date(ev.start_at);
  const e = new Date(ev.end_at);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return '';
  if (isSameDay(s, e)) {
    const hours = (e.getTime() - s.getTime()) / 3600000;
    if (hours < 23.5) return `${Math.round(hours * 10) / 10} horas`;
    return 'Todo el día';
  }
  const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000));
  return `${days} día${days === 1 ? '' : 's'}`;
}

function formatRange(ev: AvailabilityEvent): string {
  const s = new Date(ev.start_at);
  const e = new Date(ev.end_at);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return '—';
  if (isSameDay(s, e)) {
    const t1 = formatTime(ev.start_at);
    const t2 = formatTime(ev.end_at);
    const span = e.getTime() - s.getTime();
    if (span >= 23 * 3600000) return `${formatLongDate(ev.start_at)} · todo el día`;
    return `${formatLongDate(ev.start_at)} · ${t1}–${t2}`;
  }
  return `${formatLongDate(ev.start_at)} → ${formatLongDate(ev.end_at)}`;
}

export function MobileAvailabilityView({ orgId, userId, refreshKey = 0, onAdd, onEventClick }: Props) {
  const [events, setEvents] = useState<AvailabilityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const year = useMemo(() => new Date().getFullYear(), []);
  const yearRange = useMemo(() => {
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);
    return { start, end };
  }, [year]);

  const load = useCallback(async () => {
    if (!orgId || !userId) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from('availability_events')
      .select('id, org_id, user_id, type, start_at, end_at, note, created_at, updated_at')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .gte('end_at', yearRange.start.toISOString())
      .lt('start_at', yearRange.end.toISOString())
      .order('start_at', { ascending: true });
    if (err) {
      setError(err.message);
      setEvents([]);
    } else {
      setEvents((data ?? []) as AvailabilityEvent[]);
    }
    setLoading(false);
  }, [orgId, userId, yearRange]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  // Months with events
  const monthsWithEvents = useMemo(() => {
    const set = new Set<number>();
    for (const ev of events) {
      const s = new Date(ev.start_at);
      const e = new Date(ev.end_at);
      let cur = new Date(s.getFullYear(), s.getMonth(), 1);
      const lastMonth = new Date(e.getFullYear(), e.getMonth(), 1);
      while (cur <= lastMonth) {
        if (cur.getFullYear() === year) set.add(cur.getMonth());
        cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      }
    }
    return set;
  }, [events, year]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return events
      .filter((e) => new Date(e.end_at).getTime() >= now)
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }, [events]);

  return (
    <div className="space-y-4">
      {/* Chips horizontales (leyenda visual de tipos) */}
      <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
        {TYPE_CHIPS.map((t) => {
          const color = getTypeColor(t.type);
          const Icon = Icons[t.iconName];
          return (
            <span
              key={t.type}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap"
              style={{ backgroundColor: `${color}1f`, color }}
            >
              <Icon size={t.iconSize ?? 14} /> {getTypeLabel(t.type)}
            </span>
          );
        })}
      </div>

      {/* Year strip */}
      <div className="rounded-2xl border border-border bg-subtle-2/50 p-4">
        <div className="flex items-center justify-between">
          <p className="tn-h text-[14px] font-bold text-text">Año {year}</p>
          <p className="text-[12px] text-muted">
            {events.length} {events.length === 1 ? 'evento' : 'eventos'}
          </p>
        </div>
        {loading ? (
          <Skeleton className="mt-3 h-9 w-full rounded-md" />
        ) : (
          <div className="mt-3 grid grid-cols-12 gap-[3px] pb-5">
            {Array.from({ length: 12 }).map((_, m) => {
              const has = monthsWithEvents.has(m);
              return (
                <div key={m} className="relative h-9 rounded">
                  <div
                    className="h-full w-full rounded"
                    style={{
                      backgroundColor: has ? 'var(--amber)' : 'var(--subtle-2)',
                    }}
                  />
                  <span className="absolute -bottom-4 left-0 right-0 text-center text-[9px] font-bold text-muted">
                    {MONTH_INITIALS[m]}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Próximos eventos */}
      <div>
        <p className="tn-h mb-2.5 text-[14px] font-bold text-text">Próximos eventos</p>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-[12.5px] text-red-700">{error}</p>
        ) : loading ? (
          <div className="space-y-2.5">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        ) : upcoming.length === 0 ? (
          <EmptyState onAdd={onAdd} />
        ) : (
          <div className="space-y-2.5">
            {upcoming.map((ev) => (
              <EventCard key={ev.id} ev={ev} onClick={() => onEventClick?.(ev)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd?: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-5 py-12 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-subtle-2 text-muted">
        <Icons.beach size={20} />
      </div>
      <p className="tn-h text-[15px] font-bold text-text">Sin eventos próximos</p>
      <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted">
        Añade vacaciones, licencias o días no disponibles para que tu manager los tenga en cuenta.
      </p>
      {onAdd ? (
        <button
          type="button"
          onClick={onAdd}
          className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[12.5px] font-semibold text-white transition-transform hover:-translate-y-px"
          style={{ boxShadow: '0 6px 16px -8px var(--primary)' }}
        >
          <Icons.plus size={14} stroke={2.6 as unknown as number} /> Añadir evento
        </button>
      ) : null}
    </div>
  );
}

function EventCard({ ev, onClick }: { ev: AvailabilityEvent; onClick: () => void }) {
  const color = getTypeColor(ev.type);
  const Icon = Icons[iconFor(ev.type)];
  const typeLabel = getTypeLabel(ev.type);
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative w-full overflow-hidden rounded-2xl border border-border bg-surface p-4 text-left transition-colors hover:border-[color-mix(in_oklab,var(--primary)_40%,transparent)]"
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-1 rounded-r"
        style={{ backgroundColor: color }}
      />
      <div className="flex items-center gap-3 pl-1.5">
        <span
          aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`, color }}
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-text">{typeLabel}</p>
          <p className="mt-0.5 truncate text-[12px] text-muted">{formatRange(ev)}</p>
          <p className="mt-1 flex items-center gap-1.5 truncate text-[11.5px] text-text">
            <Icons.clock size={11} className="text-muted" />
            {eventDuration(ev)}
            {ev.note?.trim() ? <span className="text-muted"> · {ev.note.trim()}</span> : null}
          </p>
        </div>
        <Icons.chevronR size={18} className="text-muted" />
      </div>
    </button>
  );
}
