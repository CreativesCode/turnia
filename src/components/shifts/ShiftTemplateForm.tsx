'use client';

/**
 * Formulario para generar turnos desde un patrón semanal.
 * Patrón: filas (día de la semana, tipo de turno, asignación opcional).
 * Aplicar a rango de fechas; opción de usar o no las asignaciones.
 * @see project-roadmap.md Módulo 3.3
 */

import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useState } from 'react';

const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
];

type PatternRow = { day_of_week: number; shift_type_id: string; assigned_user_id: string | null };

type ShiftTypeOption = { id: string; name: string; letter: string; color: string };
type MemberOption = { user_id: string; full_name: string | null };

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orgId: string;
};

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function ShiftTemplateForm({ open, onClose, onSuccess, orgId }: Props) {
  const [shiftTypes, setShiftTypes] = useState<ShiftTypeOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [rows, setRows] = useState<PatternRow[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [useAssignments, setUseAssignments] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && orgId) {
      const supabase = createClient();
      supabase
        .from('organization_shift_types')
        .select('id, name, letter, color')
        .eq('org_id', orgId)
        .order('sort_order')
        .order('name')
        .then(({ data: st }) => setShiftTypes((st ?? []) as ShiftTypeOption[]));

      supabase
        .from('memberships')
        .select('user_id')
        .eq('org_id', orgId)
        .then(({ data: m }) => {
          const ids = (m ?? []).map((r: { user_id: string }) => r.user_id);
          if (ids.length === 0) {
            setMembers([]);
            return;
          }
          supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', ids)
            .then(({ data }) =>
              setMembers((data ?? []).map((p: { id: string; full_name: string | null }) => ({ user_id: p.id, full_name: p.full_name })))
            );
        });
    }
  }, [open, orgId]);

  useEffect(() => {
    if (open) {
      const base = new Date();
      const monday = new Date(base);
      monday.setDate(base.getDate() - base.getDay() + 1);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setDateFrom(toDateString(monday));
      setDateTo(toDateString(sunday));
      setRows([]);
      setUseAssignments(true);
      setError(null);
    }
  }, [open]);

  const addRow = useCallback(() => {
    const firstType = shiftTypes[0]?.id ?? '';
    setRows((r) => [...r, { day_of_week: 1, shift_type_id: firstType, assigned_user_id: null }]);
  }, [shiftTypes]);

  const updateRow = useCallback((idx: number, patch: Partial<PatternRow>) => {
    setRows((r) => r.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  }, []);

  const removeRow = useCallback((idx: number) => {
    setRows((r) => r.filter((_, i) => i !== idx));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (rows.length === 0) {
      setError('Añade al menos una fila al patrón.');
      return;
    }
    if (shiftTypes.length === 0) {
      setError('No hay tipos de turno en la organización.');
      return;
    }
    if (!dateFrom || !dateTo) {
      setError('Indica el rango de fechas.');
      return;
    }
    const from = new Date(dateFrom + 'T12:00:00');
    const to = new Date(dateTo + 'T12:00:00');
    if (from > to) {
      setError('La fecha fin debe ser posterior o igual a la de inicio.');
      return;
    }
    const invalid = rows.some((r) => !r.shift_type_id);
    if (invalid) {
      setError('Todas las filas deben tener un tipo de turno.');
      return;
    }

    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr || !refreshData?.session?.access_token) {
      setError('Sesión expirada. Recarga e inicia sesión.');
      setLoading(false);
      return;
    }
    const pattern = rows.map((r) => ({
      day_of_week: r.day_of_week,
      shift_type_id: r.shift_type_id,
      assigned_user_id: r.assigned_user_id || undefined,
    }));
    const { data, error: fnErr } = await supabase.functions.invoke('generate-shifts-from-pattern', {
      body: {
        org_id: orgId,
        pattern,
        date_from: dateFrom,
        date_to: dateTo,
        use_assignments: useAssignments,
      },
    });
    setLoading(false);
    const json = (data ?? {}) as { ok?: boolean; error?: string; generated?: number };
    if (fnErr || json.error) {
      setError(String(json.error || (fnErr as Error)?.message || 'Error al generar'));
      return;
    }
    onSuccess();
    onClose();
  }, [orgId, rows, dateFrom, dateTo, useAssignments, shiftTypes.length, onSuccess, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Cerrar" />
      <div className="relative z-10 my-auto max-h-[85dvh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-background p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-text-primary">Generar desde patrón</h2>
        <p className="mt-1 text-sm text-muted">
          Define un patrón por día de la semana y aplícalo a un rango de fechas.
        </p>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-text-primary">Patrón semanal</label>
            <button
              type="button"
              onClick={addRow}
              className="text-sm font-medium text-primary-600 hover:underline"
            >
              + Añadir fila
            </button>
          </div>
          {rows.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Añade filas (día, tipo, asignación opcional).</p>
          ) : (
            <div className="mt-2 space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <select
                    value={r.day_of_week}
                    onChange={(e) => updateRow(i, { day_of_week: Number(e.target.value) })}
                    className="rounded border border-border bg-background px-2 py-1.5 text-sm text-text-primary"
                  >
                    {WEEKDAY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={r.shift_type_id}
                    onChange={(e) => updateRow(i, { shift_type_id: e.target.value })}
                    className="rounded border border-border bg-background px-2 py-1.5 text-sm text-text-primary"
                  >
                    {shiftTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.letter} – {t.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={r.assigned_user_id ?? ''}
                    onChange={(e) => updateRow(i, { assigned_user_id: e.target.value || null })}
                    className="rounded border border-border bg-background px-2 py-1.5 text-sm text-text-primary"
                  >
                    <option value="">Sin asignar</option>
                    {members.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.full_name?.trim() || m.user_id}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-primary">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"
            />
          </div>
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={useAssignments}
            onChange={(e) => setUseAssignments(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <span className="text-sm text-text-primary">Usar asignaciones del patrón</span>
        </label>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-subtle-bg"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="min-h-[44px] rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? 'Generando…' : 'Generar'}
          </button>
        </div>
      </div>
    </div>
  );
}
