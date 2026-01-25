'use client';

/**
 * Filtros para el calendario de turnos: tipo, usuario, estado.
 * @see project-roadmap.md Módulo 3.1
 */

import { createClient } from '@/lib/supabase/client';
import { isColorLight } from '@/lib/utils';
import { useCallback, useEffect, useState } from 'react';

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

export function ShiftCalendarFilters({ orgId, value, onChange, className = '' }: Props) {
  const [shiftTypes, setShiftTypes] = useState<ShiftTypeOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [typesOpen, setTypesOpen] = useState(false);

  const load = useCallback(() => {
    if (!orgId) return;
    setLoading(true);
    const supabase = createClient();
    Promise.all([
      supabase
        .from('organization_shift_types')
        .select('id, name, letter, color')
        .eq('org_id', orgId)
        .order('sort_order')
        .order('name'),
      supabase.from('memberships').select('user_id').eq('org_id', orgId),
    ]).then(([stRes, mRes]) => {
      setShiftTypes((stRes.data ?? []) as ShiftTypeOption[]);
      const userIds = (mRes.data ?? []).map((r: { user_id: string }) => r.user_id);
      if (userIds.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }
      supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds)
        .then(({ data }) => {
          setMembers(
            (data ?? []).map((p: { id: string; full_name: string | null }) => ({
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

  return (
    <div
      className={`flex flex-wrap items-center gap-3 ${className}`}
      role="group"
      aria-label="Filtros del calendario"
    >
      {/* Tipos de turno */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setTypesOpen((o) => !o)}
          className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-secondary hover:bg-subtle-bg focus:outline-none focus:ring-2 focus:ring-primary-500"
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
      <label className="flex min-h-[40px] items-center gap-2">
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

      {/* Estado */}
      <label className="flex min-h-[40px] items-center gap-2">
        <span className="text-sm font-medium text-text-secondary">Estado:</span>
        <select
          value={value.status}
          onChange={(e) =>
            onChange({ ...value, status: e.target.value as ShiftCalendarFiltersState['status'] })
          }
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
          className="min-h-[40px] rounded-lg px-3 py-2 text-sm text-muted hover:bg-subtle-bg hover:text-text-secondary"
        >
          Limpiar
        </button>
      )}
    </div>
  );
}

export { defaultFilters };
