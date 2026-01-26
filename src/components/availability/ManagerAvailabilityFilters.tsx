'use client';

/**
 * Filtros para la vista de disponibilidad del manager: usuario y tipo de evento.
 * @see project-roadmap.md Módulo 6.2
 */

import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useState } from 'react';
import {
  AVAILABILITY_TYPE_OPTIONS,
  getTypeColor,
  type AvailabilityEventType,
} from './AvailabilityEventModal';

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

export type ManagerAvailabilityFiltersState = {
  userId: string | null;
  types: AvailabilityEventType[];
};

const defaultFilters: ManagerAvailabilityFiltersState = {
  userId: null,
  types: [],
};

type MemberOption = { user_id: string; full_name: string | null };

type Props = {
  orgId: string;
  value: ManagerAvailabilityFiltersState;
  onChange: (f: ManagerAvailabilityFiltersState) => void;
  className?: string;
};

export function ManagerAvailabilityFilters({
  orgId,
  value,
  onChange,
  className = '',
}: Props) {
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [typesOpen, setTypesOpen] = useState(false);

  const load = useCallback(() => {
    if (!orgId) return;
    setLoading(true);
    const supabase = createClient();
    supabase
      .from('memberships')
      .select('user_id')
      .eq('org_id', orgId)
      .then(({ data: mData }) => {
        const userIds = (mData ?? []).map((r: { user_id: string }) => r.user_id);
        if (userIds.length === 0) {
          setMembers([]);
          setLoading(false);
          return;
        }
        supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds)
          .then(({ data: pData }) => {
            setMembers(
              ((pData ?? []) as { id: string; full_name: string | null }[]).map((p) => ({
                user_id: p.id,
                full_name: p.full_name,
              }))
            );
            setLoading(false);
          });
      });
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleType = useCallback(
    (t: AvailabilityEventType) => {
      const next = value.types.includes(t)
        ? value.types.filter((x) => x !== t)
        : [...value.types, t];
      onChange({ ...value, types: next });
    },
    [value, onChange]
  );

  const selectAllTypes = useCallback(() => {
    onChange({ ...value, types: [] });
    setTypesOpen(false);
  }, [value, onChange]);

  if (loading) {
    return (
      <div className={`flex flex-wrap items-center gap-2 text-sm text-muted ${className}`}>
        Cargando filtros…
      </div>
    );
  }

  const allTypesSelected = value.types.length === 0;
  const hasActive = !!(value.userId || value.types.length > 0);
  const activeCount = [!!value.userId, value.types.length > 0].filter(Boolean).length;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setFiltersVisible((v) => !v)}
        className="flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-text-secondary hover:bg-subtle-bg focus:outline-none focus:ring-2 focus:ring-primary-500"
        aria-expanded={filtersVisible}
        aria-controls="manager-availability-filters-panel"
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
          id="manager-availability-filters-panel"
          className="mt-3 flex flex-wrap items-center gap-3"
          role="group"
          aria-label="Filtros de disponibilidad"
        >
      {/* Usuario */}
      <label className="flex min-h-[44px] items-center gap-2">
        <span className="text-sm font-medium text-text-secondary">Usuario:</span>
        <select
          value={value.userId ?? ''}
          onChange={(e) => onChange({ ...value, userId: e.target.value || null })}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">Todos</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.full_name?.trim() || m.user_id}
            </option>
          ))}
        </select>
      </label>

      {/* Tipo de evento */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setTypesOpen((o) => !o)}
          className="flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-secondary hover:bg-subtle-bg focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-haspopup="listbox"
          aria-expanded={typesOpen}
        >
          <span className="font-medium text-text-primary">Tipo:</span>
          <span>
            {allTypesSelected ? 'Todos' : `${value.types.length} seleccionados`}
          </span>
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
                {AVAILABILITY_TYPE_OPTIONS.map((o) => {
                  const checked = allTypesSelected || value.types.includes(o.value);
                  const color = getTypeColor(o.value);
                  return (
                    <label
                      key={o.value}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-subtle-bg"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleType(o.value)}
                        className="h-4 w-4 rounded border-border"
                      />
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-sm text-text-primary">{o.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {(value.userId || value.types.length > 0) && (
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
