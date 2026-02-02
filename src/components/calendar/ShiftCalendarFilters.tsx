'use client';

/**
 * Filtros para el calendario de turnos: tipo, usuario, estado.
 * @see project-roadmap.md Módulo 3.1
 */

import { createClient } from '@/lib/supabase/client';
import { fetchOrgMemberIds, fetchProfilesMap, fetchShiftTypes } from '@/lib/supabase/queries';
import { isColorLight } from '@/lib/utils';
import { memo, useCallback, useEffect, useState } from 'react';

function ChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
function ChevronUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
      <path d="M18 15l-6-6-6 6" />
    </svg>
  );
}

export type ShiftCalendarFiltersState = {
  shiftTypeIds: string[];
  userId: string | null;
  status: 'all' | 'draft' | 'published';
};

const defaultFilters: ShiftCalendarFiltersState = {
  shiftTypeIds: [],
  userId: null,
  status: 'all',
};

type ShiftTypeOption = { id: string; name: string; letter: string; color: string };
type MemberOption = { user_id: string; full_name: string | null };

type Props = {
  orgId: string;
  value: ShiftCalendarFiltersState;
  onChange: (f: ShiftCalendarFiltersState) => void;
  className?: string;
};

function ShiftCalendarFiltersInner({ orgId, value, onChange, className = '' }: Props) {
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [shiftTypes, setShiftTypes] = useState<ShiftTypeOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [typesOpen, setTypesOpen] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const supabase = createClient();

    const [{ data: stData }, memberIds] = await Promise.all([
      fetchShiftTypes(supabase, orgId),
      fetchOrgMemberIds(supabase, orgId),
    ]);

    setShiftTypes(((stData ?? []) as unknown) as ShiftTypeOption[]);

    const userIds = Array.from(new Set((memberIds ?? []).filter(Boolean)));
    if (userIds.length === 0) {
      setMembers([]);
      setLoading(false);
      return;
    }

    const map = await fetchProfilesMap(supabase, userIds);
    setMembers(
      userIds.map((id) => ({
        user_id: id,
        full_name: map[id] || null,
      }))
    );
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleType = useCallback(
    (id: string) => {
      let next: string[];
      if (value.shiftTypeIds.length === 0) {
        // "Todos" activo: desmarcar = excluir solo este tipo (mostrar el resto)
        next = shiftTypes.filter((t) => t.id !== id).map((t) => t.id);
      } else if (value.shiftTypeIds.includes(id)) {
        next = value.shiftTypeIds.filter((x) => x !== id);
      } else {
        next = [...value.shiftTypeIds, id];
      }
      onChange({ ...value, shiftTypeIds: next });
    },
    [value, onChange, shiftTypes]
  );

  const selectAllTypes = useCallback(() => {
    onChange({ ...value, shiftTypeIds: [] });
    setTypesOpen(false);
  }, [value, onChange]);

  if (loading) {
    return (
      <div className={`flex flex-wrap items-center gap-2 text-sm text-muted ${className}`}>
        Cargando filtros…
      </div>
    );
  }

  const allTypesSelected = value.shiftTypeIds.length === 0;
  const hasActive = !!(value.userId || value.status !== 'all' || value.shiftTypeIds.length > 0);
  const activeCount = [value.userId, value.status !== 'all', value.shiftTypeIds.length > 0].filter(Boolean).length;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setFiltersVisible((v) => !v)}
        className="flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-text-secondary hover:bg-subtle-bg focus:outline-none focus:ring-2 focus:ring-primary-500"
        aria-expanded={filtersVisible}
        aria-controls="shift-calendar-filters-panel"
        id="shift-calendar-filters-toggle"
      >
        {filtersVisible ? 'Ocultar filtros' : 'Filtros'}
        {!filtersVisible && hasActive && (
          <span className="rounded-full bg-primary-100 px-1.5 py-0.5 text-xs font-semibold text-primary-700">
            {activeCount}
          </span>
        )}
        <span className="ml-1">{filtersVisible ? <ChevronUp /> : <ChevronDown />}</span>
      </button>
      {filtersVisible && (
        <div
          id="shift-calendar-filters-panel"
          className="mt-3 flex flex-wrap items-center gap-3"
          role="group"
          aria-label="Filtros del calendario"
        >
          {/* Tipos de turno */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setTypesOpen((o) => !o)}
              className="flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-secondary hover:bg-subtle-bg focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-haspopup="listbox"
              aria-expanded={typesOpen}
            >
              <span className="font-medium text-text-primary">Tipo:</span>
              <span>{allTypesSelected ? 'Todos' : `${value.shiftTypeIds.length} seleccionados`}</span>
            </button>
            {typesOpen && (
              <>
                <button
                  type="button"
                  aria-label="Cerrar"
                  className="fixed inset-0 z-10"
                  onClick={() => setTypesOpen(false)}
                />
                <div className="absolute left-0 top-full z-20 mt-1 max-h-64 min-w-[200px] overflow-y-auto rounded-lg border border-border bg-background py-2 shadow-lg">
                  <div className="border-b border-border px-3 pb-2">
                    <button
                      type="button"
                      onClick={selectAllTypes}
                      className="text-xs text-primary-600 hover:underline"
                    >
                      Ver todos los tipos
                    </button>
                  </div>
                  <div className="mt-2 flex flex-col gap-0.5 px-2" role="listbox">
                    {shiftTypes.map((t) => {
                      const checked = allTypesSelected || value.shiftTypeIds.includes(t.id);
                      const txt = isColorLight(t.color) ? '#111' : '#fff';
                      return (
                        <label
                          key={t.id}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-subtle-bg"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleType(t.id)}
                            className="h-4 w-4 rounded border-border"
                          />
                          <span
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                            style={{ backgroundColor: t.color, color: txt }}
                          >
                            {t.letter}
                          </span>
                          <span className="text-sm text-text-primary">{t.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Usuario */}
          <label className="flex min-h-[44px] items-center gap-2">
            <span className="text-sm font-medium text-text-secondary">Usuario:</span>
            <select
              value={value.userId ?? ''}
              onChange={(e) => onChange({ ...value, userId: e.target.value || null })}
              className="min-h-[44px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">Todos</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.full_name?.trim() || m.user_id}
                </option>
              ))}
            </select>
          </label>

          {/* Estado */}
          <label className="flex min-h-[44px] items-center gap-2">
            <span className="text-sm font-medium text-text-secondary">Estado:</span>
            <select
              value={value.status}
              onChange={(e) =>
                onChange({ ...value, status: e.target.value as ShiftCalendarFiltersState['status'] })
              }
              className="min-h-[44px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="all">Todos</option>
              <option value="draft">Borrador</option>
              <option value="published">Publicado</option>
            </select>
          </label>

          {/* Limpiar filtros (si hay alguno activo) */}
          {(value.userId || value.status !== 'all' || value.shiftTypeIds.length > 0) && (
            <button
              type="button"
              onClick={() => onChange(defaultFilters)}
              className="min-h-[44px] min-w-[44px] rounded-lg px-3 py-2 text-sm text-muted hover:bg-subtle-bg hover:text-text-secondary"
            >
              Limpiar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export { defaultFilters };

export const ShiftCalendarFilters = memo(
  ShiftCalendarFiltersInner,
  (prev, next) =>
    prev.orgId === next.orgId &&
    prev.value === next.value &&
    prev.onChange === next.onChange &&
    prev.className === next.className
);
