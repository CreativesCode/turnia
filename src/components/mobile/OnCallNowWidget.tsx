'use client';

import type { ShiftWithType } from '@/components/calendar/ShiftCalendar';
import { createClient } from '@/lib/supabase/client';
import { getCacheEntry, setCache } from '@/lib/cache';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useCallback, useEffect, useMemo, useState } from 'react';

type OnCallCache = {
  shifts: ShiftWithType[];
  profilesMap: Record<string, string>;
};

function normalizeShiftType(ot: unknown): ShiftWithType['organization_shift_types'] {
  if (ot == null) return null;
  const one = Array.isArray(ot) ? (ot[0] ?? null) : ot;
  return one as ShiftWithType['organization_shift_types'];
}

function cacheKey(orgId: string) {
  return `turnia:cache:onCallNow:${orgId}`;
}

function nowIso() {
  return new Date().toISOString();
}

export function OnCallNowWidget({
  orgId,
  title = 'On-call now',
  onSelectShift,
}: {
  orgId: string | null;
  title?: string;
  onSelectShift: (shift: ShiftWithType, assignedName: string | null) => void;
}) {
  const { isOnline } = useOnlineStatus();
  const [rows, setRows] = useState<ShiftWithType[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [usingCache, setUsingCache] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    setUsingCache(false);

    const key = cacheKey(orgId);
    const cached = getCacheEntry<OnCallCache>(key, { maxAgeMs: 1000 * 60 * 60 * 24 * 30 });

    if (!isOnline) {
      if (cached) {
        setRows(cached.data.shifts);
        setProfilesMap(cached.data.profilesMap);
        setUsingCache(true);
        setNotice(`Sin conexión. Mostrando datos guardados (${new Date(cached.savedAt).toLocaleString('es-ES')}).`);
        setLoading(false);
        return;
      }
      setRows([]);
      setProfilesMap({});
      setError('Sin conexión y sin datos guardados.');
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const iso = nowIso();
    const { data, error: err } = await supabase
      .from('shifts')
      .select(
        `id, org_id, shift_type_id, status, start_at, end_at, assigned_user_id, location,
         organization_shift_types (id, name, letter, color, start_time, end_time)`
      )
      .eq('org_id', orgId)
      .eq('status', 'published')
      .lte('start_at', iso)
      .gte('end_at', iso)
      .order('start_at', { ascending: true })
      .limit(10);

    if (err) {
      if (cached) {
        setRows(cached.data.shifts);
        setProfilesMap(cached.data.profilesMap);
        setUsingCache(true);
        setNotice(`No se pudo actualizar. Mostrando datos guardados (${new Date(cached.savedAt).toLocaleString('es-ES')}).`);
        setLoading(false);
        return;
      }
      setRows([]);
      setProfilesMap({});
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

    const userIds = [...new Set(list.map((s) => s.assigned_user_id).filter(Boolean))] as string[];
    let nextProfilesMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: { id: string; full_name: string | null }) => {
        map[p.id] = p.full_name?.trim() ?? '';
      });
      nextProfilesMap = map;
      setProfilesMap(map);
    } else {
      nextProfilesMap = {};
      setProfilesMap({});
    }

    setCache(key, { shifts: list, profilesMap: nextProfilesMap });
    setLoading(false);
  }, [orgId, isOnline]);

  useEffect(() => {
    if (!orgId) return;
    // eslint react-hooks/set-state-in-effect: evitar llamada sync
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [orgId, isOnline, load]);

  const display = useMemo(() => {
    return rows.map((s) => ({
      shift: s,
      assignedName: s.assigned_user_id ? profilesMap[s.assigned_user_id] ?? null : null,
    }));
  }, [rows, profilesMap]);

  return (
    <section className="rounded-xl border border-border bg-background p-4" id="on-call-now">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        <button
          type="button"
          onClick={load}
          className="min-h-[44px] rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-secondary hover:bg-subtle-bg disabled:opacity-50"
          disabled={loading || !orgId}
        >
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
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
        <p className="mt-3 text-sm text-muted">Cargando…</p>
      ) : display.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nadie está de turno ahora.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
          {display.map(({ shift, assignedName }) => {
            const t = shift.organization_shift_types;
            const letter = t?.letter ?? '?';
            const color = t?.color ?? '#6B7280';
            const typeName = t?.name ?? '—';
            const name = assignedName?.trim() || (shift.assigned_user_id ? shift.assigned_user_id : 'Sin asignar');
            return (
              <li key={shift.id}>
                <button
                  type="button"
                  onClick={() => onSelectShift(shift, assignedName)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-subtle-bg"
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: color }} aria-hidden>
                    {letter}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text-primary">{typeName}</span>
                    <span className="mt-0.5 block truncate text-xs text-text-secondary">{name}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

