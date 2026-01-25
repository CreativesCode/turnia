'use client';

/**
 * Lista de turnos con filtros, paginación, ordenación y acciones rápidas.
 * Tabla: fecha, horario, tipo, usuario, estado. Acciones: editar, eliminar.
 * @see project-roadmap.md Módulo 3.4
 */

import { useCallback, useEffect, useState, memo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isColorLight } from '@/lib/utils';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import type { ShiftWithType } from '@/components/calendar/ShiftCalendar';

const PAGE_SIZE = 25;

export type ShiftListFilters = {
  shiftTypeIds: string[];
  userId: string | null;
  status: 'all' | 'draft' | 'published';
  dateFrom: string;
  dateTo: string;
};

const defaultListFilters: ShiftListFilters = {
  shiftTypeIds: [],
  userId: null,
  status: 'all',
  dateFrom: '',
  dateTo: '',
};

type ShiftTypeOption = { id: string; name: string; letter: string; color: string };
type MemberOption = { user_id: string; full_name: string | null };

type Props = {
  orgId: string | null;
  canManageShifts: boolean;
  refreshKey?: number;
  onRowClick: (shift: ShiftWithType, assignedName: string | null) => void;
  onEditClick: (shift: ShiftWithType) => void;
  onRefresh: () => void;
  /** Para operaciones en lote: ids seleccionados (controlado por el padre) */
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
};

function formatDate(d: Date): string {
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTimeRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return '—';
  return `${s.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} – ${e.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
}

function normalizeShiftType(ot: unknown): ShiftWithType['organization_shift_types'] {
  if (ot == null) return null;
  const one = Array.isArray(ot) ? (ot[0] ?? null) : ot;
  return one as ShiftWithType['organization_shift_types'];
}

function ShiftListInner({
  orgId,
  canManageShifts,
  refreshKey = 0,
  onRowClick,
  onEditClick,
  onRefresh,
  selectedIds = [],
  onSelectionChange,
}: Props) {
  const [rows, setRows] = useState<ShiftWithType[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [shiftTypes, setShiftTypes] = useState<ShiftTypeOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ShiftListFilters>(defaultListFilters);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [typesOpen, setTypesOpen] = useState(false);
  const [deleteShift, setDeleteShift] = useState<ShiftWithType | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadMeta = useCallback(() => {
    if (!orgId) return;
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
      const ids = (mRes.data ?? []).map((r: { user_id: string }) => r.user_id);
      if (ids.length === 0) {
        setMembers([]);
        return;
      }
      supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', ids)
        .then(({ data }) => {
          setMembers(
            (data ?? []).map((p: { id: string; full_name: string | null }) => ({
              user_id: p.id,
              full_name: p.full_name,
            }))
          );
        });
    });
  }, [orgId]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const load = useCallback(async () => {
    if (!orgId) {
      setRows([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let q = supabase
      .from('shifts')
      .select(
        `id, org_id, shift_type_id, status, start_at, end_at, assigned_user_id, location,
         organization_shift_types (id, name, letter, color, start_time, end_time)`,
        { count: 'exact' }
      )
      .eq('org_id', orgId)
      .order('start_at', { ascending: sortDir === 'asc' })
      .range(from, to);

    if (filters.shiftTypeIds.length > 0) {
      q = q.in('shift_type_id', filters.shiftTypeIds);
    }
    if (filters.userId) {
      q = q.eq('assigned_user_id', filters.userId);
    }
    if (filters.status !== 'all') {
      q = q.eq('status', filters.status);
    }
    if (filters.dateFrom) {
      const iso = new Date(filters.dateFrom + 'T00:00:00').toISOString();
      q = q.gte('end_at', iso);
    }
    if (filters.dateTo) {
      const iso = new Date(filters.dateTo + 'T23:59:59.999').toISOString();
      q = q.lte('start_at', iso);
    }

    const { data, error: err, count } = await q;

    if (err) {
      setError(err.message);
      setRows([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    const raw = (data ?? []) as unknown[];
    const list: ShiftWithType[] = raw.map((s) => ({
      ...(s as ShiftWithType),
      organization_shift_types: normalizeShiftType((s as Record<string, unknown>).organization_shift_types),
    }));
    setRows(list);
    setTotalCount(count ?? 0);

    const userIds = [...new Set(list.map((s) => s.assigned_user_id).filter(Boolean))] as string[];
    if (userIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: { id: string; full_name: string | null }) => {
        map[p.id] = p.full_name?.trim() ?? '';
      });
      setProfilesMap(map);
    } else {
      setProfilesMap({});
    }
    setLoading(false);
  }, [orgId, filters, sortDir, page, refreshKey]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSort = useCallback(() => {
    setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    setPage(1);
  }, []);

  const toggleType = useCallback(
    (id: string) => {
      let next: string[];
      if (filters.shiftTypeIds.length === 0) {
        next = shiftTypes.filter((t) => t.id !== id).map((t) => t.id);
      } else if (filters.shiftTypeIds.includes(id)) {
        next = filters.shiftTypeIds.filter((x) => x !== id);
      } else {
        next = [...filters.shiftTypeIds, id];
      }
      setFilters((f) => ({ ...f, shiftTypeIds: next }));
      setPage(1);
    },
    [filters.shiftTypeIds, shiftTypes]
  );

  const selectAllTypes = useCallback(() => {
    setFilters((f) => ({ ...f, shiftTypeIds: [] }));
    setTypesOpen(false);
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(defaultListFilters);
    setPage(1);
  }, []);

  const doDelete = useCallback(async () => {
    if (!deleteShift) return;
    setDeleting(true);
    const supabase = createClient();
    const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr || !refreshData?.session?.access_token) {
      setDeleting(false);
      setDeleteShift(null);
      return;
    }
    const { error: fnErr } = await supabase.functions.invoke('delete-shift', {
      body: { id: deleteShift.id },
    });
    setDeleting(false);
    setDeleteShift(null);
    if (!fnErr) onRefresh();
  }, [deleteShift, onRefresh]);

  const hasActiveFilters =
    filters.shiftTypeIds.length > 0 ||
    filters.userId ||
    filters.status !== 'all' ||
    filters.dateFrom ||
    filters.dateTo;

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const allTypesSelected = filters.shiftTypeIds.length === 0;

  const toggleOne = useCallback(
    (id: string) => {
      if (!onSelectionChange) return;
      if (selectedIds.includes(id)) {
        onSelectionChange(selectedIds.filter((x) => x !== id));
      } else {
        onSelectionChange([...selectedIds, id]);
      }
    },
    [selectedIds, onSelectionChange]
  );

  const togglePage = useCallback(() => {
    if (!onSelectionChange) return;
    const pageIds = rows.map((s) => s.id);
    const allSelected = pageIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      onSelectionChange(selectedIds.filter((id) => !pageIds.includes(id)));
    } else {
      const merged = [...new Set([...selectedIds, ...pageIds])];
      onSelectionChange(merged);
    }
  }, [onSelectionChange, rows, selectedIds]);

  const showBulk = canManageShifts && typeof onSelectionChange === 'function';

  if (!orgId) {
    return (
      <div className="rounded-xl border border-border bg-background p-6">
        <p className="text-sm text-muted">Selecciona una organización.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background p-3">
        {/* Tipo (checkboxes) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setTypesOpen((o) => !o)}
            className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-secondary hover:bg-subtle-bg"
          >
            <span className="font-medium text-text-primary">Tipo:</span>
            <span>{allTypesSelected ? 'Todos' : `${filters.shiftTypeIds.length} seleccionados`}</span>
          </button>
          {typesOpen && (
            <>
              <button type="button" className="fixed inset-0 z-10" onClick={() => setTypesOpen(false)} aria-label="Cerrar" />
              <div className="absolute left-0 top-full z-20 mt-1 max-h-64 min-w-[200px] overflow-y-auto rounded-lg border border-border bg-background py-2 shadow-lg">
                <div className="border-b border-border px-3 pb-2">
                  <button type="button" onClick={selectAllTypes} className="text-xs text-primary-600 hover:underline">
                    Ver todos los tipos
                  </button>
                </div>
                <div className="mt-2 flex flex-col gap-0.5 px-2">
                  {shiftTypes.map((t) => {
                    const checked = allTypesSelected || filters.shiftTypeIds.includes(t.id);
                    const txt = isColorLight(t.color) ? '#111' : '#fff';
                    return (
                      <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-subtle-bg">
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
            value={filters.userId ?? ''}
            onChange={(e) => {
              setFilters((f) => ({ ...f, userId: e.target.value || null }));
              setPage(1);
            }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"
          >
            <option value="">Todos</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.full_name?.trim() || m.user_id}
              </option>
            ))}
          </select>
        </label>

        {/* Rango de fechas */}
        <label className="flex min-h-[40px] items-center gap-2">
          <span className="text-sm font-medium text-text-secondary">Desde:</span>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => {
              setFilters((f) => ({ ...f, dateFrom: e.target.value }));
              setPage(1);
            }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"
          />
        </label>
        <label className="flex min-h-[40px] items-center gap-2">
          <span className="text-sm font-medium text-text-secondary">Hasta:</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => {
              setFilters((f) => ({ ...f, dateTo: e.target.value }));
              setPage(1);
            }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"
          />
        </label>

        {/* Estado */}
        <label className="flex min-h-[40px] items-center gap-2">
          <span className="text-sm font-medium text-text-secondary">Estado:</span>
          <select
            value={filters.status}
            onChange={(e) => {
              setFilters((f) => ({ ...f, status: e.target.value as ShiftListFilters['status'] }));
              setPage(1);
            }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"
          >
            <option value="all">Todos</option>
            <option value="draft">Borrador</option>
            <option value="published">Publicado</option>
          </select>
        </label>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="min-h-[40px] rounded-lg px-3 py-2 text-sm text-muted hover:bg-subtle-bg hover:text-text-secondary"
          >
            Limpiar
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
          <button type="button" onClick={load} className="ml-2 text-primary-600 hover:underline">
            Reintentar
          </button>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-border bg-background p-6">
          <p className="text-sm text-muted">Cargando turnos…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-background p-6">
          <p className="text-sm text-muted">No hay turnos con los filtros seleccionados.</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-background">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-subtle-bg">
                    {showBulk && (
                      <th className="w-10 px-2 py-3">
                        <label className="flex cursor-pointer items-center justify-center">
                          <input
                            type="checkbox"
                            checked={rows.length > 0 && rows.every((s) => selectedIds.includes(s.id))}
                            onChange={togglePage}
                            className="h-4 w-4 rounded border-border"
                            aria-label="Seleccionar todos en la página"
                          />
                        </label>
                      </th>
                    )}
                    <th className="px-4 py-3 text-left font-medium text-text-primary">
                      <button
                        type="button"
                        onClick={toggleSort}
                        className="flex items-center gap-1 hover:text-primary-600"
                      >
                        Fecha
                        <span className="text-muted">{sortDir === 'asc' ? '↑' : '↓'}</span>
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-text-primary">Horario</th>
                    <th className="px-4 py-3 text-left font-medium text-text-primary">Tipo</th>
                    <th className="px-4 py-3 text-left font-medium text-text-primary">Usuario</th>
                    <th className="px-4 py-3 text-left font-medium text-text-primary">Estado</th>
                    {canManageShifts && (
                      <th className="px-4 py-3 text-right font-medium text-text-primary">Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => {
                    const ot = s.organization_shift_types;
                    const letter = ot?.letter ?? '?';
                    const color = ot?.color ?? '#6B7280';
                    const typeName = ot?.name ?? '—';
                    const assignedName = s.assigned_user_id ? (profilesMap[s.assigned_user_id] ?? '—') : null;
                    const start = new Date(s.start_at);

                    return (
                      <tr
                        key={s.id}
                        className="border-b border-border last:border-0 hover:bg-subtle-bg/50 cursor-pointer"
                        onClick={() => onRowClick(s, assignedName)}
                      >
                        {showBulk && (
                          <td className="w-10 px-2 py-3" onClick={(e) => e.stopPropagation()}>
                            <label className="flex cursor-pointer items-center justify-center">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(s.id)}
                                onChange={() => toggleOne(s.id)}
                                className="h-4 w-4 rounded border-border"
                                aria-label={`Seleccionar turno ${formatDate(start)}`}
                              />
                            </label>
                          </td>
                        )}
                        <td className="px-4 py-3 text-text-primary">{formatDate(start)}</td>
                        <td className="px-4 py-3 text-text-secondary">{formatTimeRange(s.start_at, s.end_at)}</td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                            style={{
                              backgroundColor: color,
                              color: isColorLight(color) ? '#111' : '#fff',
                            }}
                            title={typeName}
                          >
                            {letter}
                          </span>
                          <span className="ml-2 text-text-primary">{typeName}</span>
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {assignedName?.trim() || 'Sin asignar'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              s.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {s.status === 'published' ? 'Publicado' : 'Borrador'}
                          </span>
                        </td>
                        {canManageShifts && (
                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => onEditClick(s)}
                                className="min-h-[44px] min-w-[44px] rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-secondary hover:bg-subtle-bg"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteShift(s)}
                                className="min-h-[44px] min-w-[44px] rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-muted">
                Página {page} de {totalPages} ({totalCount} turnos)
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="min-h-[44px] rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-subtle-bg disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="min-h-[44px] rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-subtle-bg disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmModal
        open={!!deleteShift}
        onClose={() => setDeleteShift(null)}
        onConfirm={doDelete}
        title="Eliminar turno"
        message="¿Eliminar este turno? No se puede deshacer."
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}

export const ShiftList = memo(ShiftListInner);
export { defaultListFilters };
