'use client';

import type { ShiftWithType } from '@/components/calendar/ShiftCalendar';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { createClient } from '@/lib/supabase/client';
import { getCacheEntry, setCache } from '@/lib/cache';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useCallback, useEffect, useMemo, useState } from 'react';

type UpcomingCache = {
  shifts: ShiftWithType[];
};

function normalizeShiftType(ot: unknown): ShiftWithType['organization_shift_types'] {
  if (ot == null) return null;
  const one = Array.isArray(ot) ? (ot[0] ?? null) : ot;
  return one as ShiftWithType['organization_shift_types'];
}

function cacheKey(orgId: string, userId: string) {
  return `turnia:cache:myUpcomingShifts:${orgId}:${userId}`;
}

function formatTimeRange(startAt: string, endAt: string): string {
  const s = new Date(startAt);
  const e = new Date(endAt);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return '—';
  const day = s.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
  const st = s.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const et = e.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${st}–${et}`;
}

export function MyUpcomingShiftsWidget({
  orgId,
  userId,
  title = 'Mis próximos turnos',
  onSelectShift,
}: {
  orgId: string | null;
  userId: string | null;
  title?: string;
  onSelectShift: (shift: ShiftWithType) => void;
}) {
  const { isOnline } = useOnlineStatus();
  const [rows, setRows] = useState<ShiftWithType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [usingCache, setUsingCache] = useState(false);

  const load = useCallback(async () => {
    if (!orgId || !userId) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    setUsingCache(false);

    const key = cacheKey(orgId, userId);
    const cached = getCacheEntry<UpcomingCache>(key, { maxAgeMs: 1000 * 60 * 60 * 24 * 30 });

    if (!isOnline) {
      if (cached) {
        setRows(cached.data.shifts);
        setUsingCache(true);
        setNotice(`Sin conexión. Mostrando datos guardados (${new Date(cached.savedAt).toLocaleString('es-ES')}).`);
        setLoading(false);
        return;
      }
      setRows([]);
      setError('Sin conexión y sin datos guardados.');
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const now = new Date();
    const to = new Date(now);
    to.setDate(now.getDate() + 14);

    const { data, error: err } = await supabase
      .from('shifts')
      .select(
        `id, org_id, shift_type_id, status, start_at, end_at, assigned_user_id, location,
         organization_shift_types (id, name, letter, color, start_time, end_time)`
      )
      .eq('org_id', orgId)
      .eq('assigned_user_id', userId)
      .gte('end_at', now.toISOString())
      .lte('start_at', to.toISOString())
      .order('start_at', { ascending: true })
      .limit(20);

    if (err) {
      if (cached) {
        setRows(cached.data.shifts);
        setUsingCache(true);
        setNotice(`No se pudo actualizar. Mostrando datos guardados (${new Date(cached.savedAt).toLocaleString('es-ES')}).`);
        setLoading(false);
        return;
      }
      setRows([]);
      setError(err.message);
      setLoading(false);
      return;
    }

    const raw = (data ?? []) as unknown[];
    const list: ShiftWithType[] = raw.map((s) => ({
      ...(s as ShiftWithType),
      organization_shift_types: normalizeShiftType((s as Record<string, unknown>).organization_shift_types),
    }));
    setRows(list);
    setCache(key, { shifts: list });
    setLoading(false);
  }, [orgId, userId, isOnline]);

  useEffect(() => {
    if (!orgId || !userId) return;
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [orgId, userId, isOnline, load]);

  const items = useMemo(() => {
    return rows.map((s) => {
      const t = s.organization_shift_types;
      return {
        shift: s,
        letter: t?.letter ?? '?',
        color: t?.color ?? '#6B7280',
        typeName: t?.name ?? '—',
        when: formatTimeRange(s.start_at, s.end_at),
      };
    });
  }, [rows]);

  return (
    <section className="rounded-xl border border-border bg-background p-4" id="my-upcoming-shifts">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        <Button
          variant="secondary"
          size="sm"
          onClick={load}
          loading={loading}
          disabled={!orgId || !userId}
          aria-label={loading ? 'Actualizando' : 'Actualizar'}
        >
          Actualizar
        </Button>
      </div>

      {notice && (
        <div className={`mt-3 rounded-lg border p-3 text-sm ${usingCache ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-border bg-background text-text-secondary'}`} role="status" aria-live="polite">
          {notice}
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
          <button type="button" onClick={load} className="ml-2 text-primary-600 hover:underline">
            Reintentar
          </button>
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-52" />
            </div>
          </div>
        </div>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No tienes turnos en los próximos 14 días.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
          {items.map((it) => (
            <li key={it.shift.id}>
              <button
                type="button"
                onClick={() => onSelectShift(it.shift)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-subtle-bg"
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: it.color }} aria-hidden>
                  {it.letter}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-text-primary">{it.typeName}</span>
                  <span className="mt-0.5 block truncate text-xs text-text-secondary">{it.when}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

