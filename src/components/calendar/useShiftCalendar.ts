'use client';

import { useDebounce } from '@/hooks/useDebounce';
import { getCacheEntry, setCache } from '@/lib/cache';
import { createClient } from '@/lib/supabase/client';
import { fetchProfilesMap } from '@/lib/supabase/queries';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';

import type { DatesSetArg } from '@fullcalendar/core';
import type { ShiftCalendarFiltersState } from './ShiftCalendarFilters';
import type { ShiftCalendarCache, ShiftCalendarRange, ShiftWithType } from './shiftCalendarTypes';

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

function calendarMaxAgeMs(_start: Date, end: Date): number {
  const now = Date.now();
  const isPastRange = end.getTime() < now;
  return isPastRange ? 1000 * 60 * 60 * 24 : 1000 * 60 * 5; // 24h pasado, 5min futuro
}

function formatEventTitle(letter: string, assignedName: string | null): string {
  if (assignedName?.trim()) return `${letter} – ${assignedName.trim()}`;
  return `${letter} – Sin asignar`;
}

export type UseShiftCalendarResult = {
  loading: boolean;
  error: string | null;
  notice: string | null;
  usingCache: boolean;
  range: ShiftCalendarRange;
  fcEvents: Array<{
    id: string;
    title: string;
    start: string;
    end: string;
    backgroundColor: string;
    borderColor: string;
    extendedProps: { shift: ShiftWithType; assignedName: string | null };
  }>;
  fetchShifts: (start: Date, end: Date) => Promise<void>;
  handleDatesSet: (arg: DatesSetArg) => void;
};

type CalendarSWRKey = readonly ['calendarShifts', string, string, string, string];

export function useShiftCalendar(args: {
  orgId: string;
  refreshKey?: number;
  filters?: ShiftCalendarFiltersState;
  isOnline: boolean;
  onToolbarRendered?: () => void;
}): UseShiftCalendarResult {
  const { orgId, refreshKey = 0, filters, isOnline, onToolbarRendered } = args;

  const [range, setRange] = useState<ShiftCalendarRange>(null);
  const debouncedRange = useDebounce(range, 300);
  const realtimeDebounceRef = useRef<number | null>(null);

  const swrKey = useMemo(() => {
    if (!orgId || !debouncedRange) return null;
    return [
      'calendarShifts',
      orgId,
      debouncedRange.start.toISOString(),
      debouncedRange.end.toISOString(),
      filtersKey(filters),
    ] as CalendarSWRKey;
  }, [orgId, debouncedRange, filters]);

  const cachedEntry = useMemo(() => {
    if (!orgId || !debouncedRange) return null;
    const cacheKey = calendarCacheKey(orgId, debouncedRange.start, debouncedRange.end, filters);
    return getCacheEntry<ShiftCalendarCache>(cacheKey, {
      maxAgeMs: calendarMaxAgeMs(debouncedRange.start, debouncedRange.end),
    });
  }, [orgId, debouncedRange, filters]);

  const cachedFallback = cachedEntry?.data;

  const fetcher = useCallback(
    async (key: CalendarSWRKey): Promise<ShiftCalendarCache> => {
      const [, orgIdKey, startIso, endIso] = key;
      const start = new Date(startIso);
      const end = new Date(endIso);
      const cacheKey = calendarCacheKey(orgIdKey, start, end, filters);
      const cached = getCacheEntry<ShiftCalendarCache>(cacheKey, { maxAgeMs: calendarMaxAgeMs(start, end) });

      if (!isOnline) {
        if (cached) return cached.data;
        throw new Error('Sin conexión y sin datos guardados para este rango.');
      }

      const supabase = createClient();

      let query = supabase
        .from('shifts')
        .select(
          `
          id, org_id, shift_type_id, status, start_at, end_at, assigned_user_id, location,
          organization_shift_types (id, name, letter, color, start_time, end_time)
        `
        )
        .eq('org_id', orgIdKey)
        .gte('end_at', startIso)
        .lte('start_at', endIso)
        .order('start_at', { ascending: true });

      if (filters) {
        if (filters.shiftTypeIds.length > 0) query = query.in('shift_type_id', filters.shiftTypeIds);
        if (filters.userId) query = query.eq('assigned_user_id', filters.userId);
        if (filters.status !== 'all') query = query.eq('status', filters.status);
      }

      const { data: shiftsData, error: shiftsErr } = await query;
      if (shiftsErr) {
        if (cached) return cached.data;
        throw new Error(shiftsErr.message);
      }

      const raw = (shiftsData ?? []) as Array<
        ShiftWithType & {
          organization_shift_types?: ShiftWithType['organization_shift_types'] | ShiftWithType['organization_shift_types'][];
        }
      >;
      const shifts: ShiftWithType[] = raw.map((s) => {
        const ot = s.organization_shift_types;
        const single = Array.isArray(ot) ? (ot[0] ?? null) : ot ?? null;
        return { ...s, organization_shift_types: single } as ShiftWithType;
      });

      const userIds = [...new Set(shifts.map((s) => s.assigned_user_id).filter(Boolean))] as string[];
      const profilesMap = userIds.length > 0 ? await fetchProfilesMap(supabase, userIds) : {};

      const payload: ShiftCalendarCache = { shifts, profilesMap };
      setCache(cacheKey, payload);
      return payload;
    },
    [filters, isOnline]
  );

  const {
    data: swrData,
    error: swrError,
    isLoading,
    isValidating,
    mutate,
  } = useSWR<ShiftCalendarCache, Error, CalendarSWRKey | null>(swrKey, fetcher, {
    fallbackData: cachedFallback,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
  });

  const cacheUi = useMemo((): { usingCache: boolean; notice: string | null } => {
    if (!orgId || !debouncedRange) return { usingCache: false, notice: null };
    if (!cachedEntry) {
      if (!isOnline) return { usingCache: false, notice: null };
      return { usingCache: false, notice: null };
    }

    const ts = new Date(cachedEntry.savedAt).toLocaleString('es-ES');
    if (!isOnline) {
      return { usingCache: true, notice: `Sin conexión. Mostrando datos guardados (${ts}).` };
    }
    if (isValidating) {
      return { usingCache: true, notice: `Mostrando datos guardados (${ts}) mientras se actualiza…` };
    }
    return { usingCache: false, notice: null };
  }, [orgId, debouncedRange, cachedEntry, isOnline, isValidating]);

  useEffect(() => {
    if (!orgId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`turnia:realtime:shifts:${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shifts',
          filter: `org_id=eq.${orgId}`,
        },
        () => {
          // Evitar ráfagas de mutate en bulk updates: debounce corto.
          if (realtimeDebounceRef.current != null) window.clearTimeout(realtimeDebounceRef.current);
          realtimeDebounceRef.current = window.setTimeout(() => {
            void mutate();
          }, 300);
        }
      )
      .subscribe();

    return () => {
      if (realtimeDebounceRef.current != null) {
        window.clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [orgId, mutate]);

  useEffect(() => {
    // Forzar refresh manual externo (refreshKey) sin cambiar el key.
    if (!swrKey) return;
    void mutate();
  }, [refreshKey, mutate, swrKey]);

  const fetchShifts = useCallback(
    async (start: Date, end: Date) => {
      setRange({ start, end });
      // SWR se disparará por cambio de range (debounced). Forzamos refresh inmediato.
      if (swrKey) await mutate();
    },
    [mutate, swrKey]
  );

  const handleDatesSet = useCallback(
    (arg: DatesSetArg) => {
      setRange({ start: arg.start, end: arg.end });
      window.setTimeout(() => onToolbarRendered?.(), 0);
    },
    [onToolbarRendered]
  );

  const fcEvents = useMemo(() => {
    const events = swrData?.shifts ?? [];
    const profilesMap = swrData?.profilesMap ?? {};
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
  }, [swrData]);

  const error = swrError ? String((swrError as Error).message ?? swrError) : null;
  const loading = isLoading || (isValidating && !cachedFallback);

  return {
    loading,
    error,
    notice: cacheUi.notice,
    usingCache: cacheUi.usingCache,
    range,
    fcEvents,
    fetchShifts,
    handleDatesSet,
  };
}

