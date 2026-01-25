'use client';

import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { createClient } from '@/lib/supabase/client';
import { formatShiftTypeSchedule, isColorLight } from '@/lib/utils';
import { useCallback, useEffect, useState } from 'react';
import type { ShiftTypeRow } from './ShiftTypeFormModal';
import { ShiftTypeFormModal } from './ShiftTypeFormModal';

type Props = {
  orgId: string;
  refreshKey?: number;
  onRefresh?: () => void;
};

export function ShiftTypesList({ orgId, refreshKey = 0, onRefresh }: Props) {
  const [rows, setRows] = useState<ShiftTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ShiftTypeRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ShiftTypeRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from('organization_shift_types')
      .select('id, org_id, name, letter, color, sort_order, start_time, end_time')
      .eq('org_id', orgId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as ShiftTypeRow[]);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const doDelete = useCallback(async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setDeleteError(null);
    const supabase = createClient();
    const { error: err } = await supabase
      .from('organization_shift_types')
      .delete()
      .eq('id', confirmDelete.id)
      .eq('org_id', orgId);
    setDeleting(false);
    setConfirmDelete(null);
    if (err) {
      setDeleteError(
        err.code === '23503'
          ? 'No se puede eliminar: hay turnos asignados a este tipo. Reasigna o elimina esos turnos antes.'
          : err.message
      );
      return;
    }
    onRefresh?.();
    load();
  }, [orgId, confirmDelete, onRefresh, load]);

  const existingLetters = rows.map((r) => r.letter);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-background p-4">
        <p className="text-sm text-muted">Cargando tipos de turno…</p>
        <div className="mt-3 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded bg-subtle-bg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-background p-4">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <>
      {deleteError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {deleteError}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="min-h-[44px] rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          Nuevo tipo de turno
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-background p-6 text-center">
          <p className="text-sm text-muted">
            Aún no hay tipos de turno. Crea al menos uno (ej. Mañana, Noche, 24h) para poder asignarlos a los turnos.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-background shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-subtle-bg">
                <th className="px-3 py-2.5 text-left font-medium text-text-primary">Tipo</th>
                <th className="px-3 py-2.5 text-left font-medium text-text-primary">Nombre</th>
                <th className="px-3 py-2.5 text-left font-medium text-text-primary">Horario</th>
                <th className="px-3 py-2.5 text-right font-medium text-text-primary">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2.5">
                    <span
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-xs font-bold"
                      style={{
                        backgroundColor: r.color,
                        color: isColorLight(r.color) ? '#0F172A' : '#FFFFFF',
                      }}
                      title={`${r.name} (${r.letter}) · ${r.color}`}
                    >
                      {r.letter}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-text-primary">{r.name}</td>
                  <td className="px-3 py-2.5 text-muted">
                    {formatShiftTypeSchedule(r.start_time, r.end_time)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing(r)}
                        className="min-h-[44px] min-w-[44px] rounded-lg px-2 py-1.5 text-sm text-primary-600 hover:bg-primary-50"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(r)}
                        className="min-h-[44px] min-w-[44px] rounded-lg px-2 py-1.5 text-sm text-red-600 hover:bg-red-50"
                      >
                        Eliminar
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ShiftTypeFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          onRefresh?.();
          load();
        }}
        orgId={orgId}
        editing={null}
        existingLetters={existingLetters}
      />

      <ShiftTypeFormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        onSuccess={() => {
          onRefresh?.();
          load();
        }}
        orgId={orgId}
        editing={editing}
        existingLetters={existingLetters}
      />

      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title="Eliminar tipo de turno"
        message={
          confirmDelete
            ? `¿Eliminar "${confirmDelete.name}" (${confirmDelete.letter})? No se puede si hay turnos que lo usan.`
            : ''
        }
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={deleting}
      />
    </>
  );
}
