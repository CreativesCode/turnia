'use client';

import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import type { StaffPositionRow } from './StaffPositionFormModal';
import { StaffPositionFormModal } from './StaffPositionFormModal';

type Props = {
  orgId: string;
  refreshKey?: number;
  onRefresh?: () => void;
};

export function StaffPositionsList({ orgId, refreshKey = 0, onRefresh }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<StaffPositionRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StaffPositionRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);

  const swrKey = useMemo(() => ['staffPositions', orgId] as const, [orgId]);
  const fetcher = useCallback(async (): Promise<StaffPositionRow[]> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('organization_staff_positions')
      .select('id, org_id, name, sort_order')
      .eq('org_id', orgId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as StaffPositionRow[];
  }, [orgId]);

  const { data: rows = [], error: swrError, isLoading, isValidating, mutate } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
  });

  useEffect(() => {
    void mutate();
  }, [refreshKey, mutate]);

  const realtimeTimerRef = useRef<number | null>(null);
  const scheduleRealtimeRefresh = useCallback(() => {
    if (realtimeTimerRef.current) window.clearTimeout(realtimeTimerRef.current);
    realtimeTimerRef.current = window.setTimeout(() => void mutate(), 250);
  }, [mutate]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`turnia:staffPositions:${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'organization_staff_positions', filter: `org_id=eq.${orgId}` },
        () => scheduleRealtimeRefresh()
      )
      .subscribe();

    return () => {
      if (realtimeTimerRef.current) {
        window.clearTimeout(realtimeTimerRef.current);
        realtimeTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [orgId, scheduleRealtimeRefresh]);

  const loading = isLoading || (isValidating && rows.length === 0);
  const error = swrError ? String((swrError as Error).message ?? swrError) : null;

  const doDelete = useCallback(async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setDeleteError(null);
    const supabase = createClient();
    const { error: err } = await supabase
      .from('organization_staff_positions')
      .delete()
      .eq('id', confirmDelete.id)
      .eq('org_id', orgId);
    setDeleting(false);
    setConfirmDelete(null);
    if (err) {
      setDeleteError(
        err.code === '23503'
          ? 'No se puede eliminar: hay miembros con este puesto. Reasigna o elimina esos miembros antes.'
          : err.message
      );
      return;
    }
    onRefresh?.();
    void mutate();
  }, [orgId, confirmDelete, onRefresh, mutate]);

  const move = useCallback(
    async (index: number, dir: -1 | 1) => {
      if (reordering) return;
      const target = index + dir;
      if (index < 0 || index >= rows.length) return;
      if (target < 0 || target >= rows.length) return;

      const a = rows[index];
      const b = rows[target];

      setReorderError(null);
      setReordering(true);

      mutate(
        (prev) => {
          const prevRows = (prev ?? []) as StaffPositionRow[];
          if (index < 0 || index >= prevRows.length) return prevRows;
          const t = index + dir;
          if (t < 0 || t >= prevRows.length) return prevRows;
          const next = [...prevRows];
          const ra = next[index];
          const rb = next[t];
          next[index] = { ...rb, sort_order: ra.sort_order };
          next[t] = { ...ra, sort_order: rb.sort_order };
          return next;
        },
        { revalidate: false }
      );

      const supabase = createClient();
      const { error: e1 } = await supabase
        .from('organization_staff_positions')
        .update({ sort_order: b.sort_order })
        .eq('id', a.id)
        .eq('org_id', orgId);

      const { error: e2 } = await supabase
        .from('organization_staff_positions')
        .update({ sort_order: a.sort_order })
        .eq('id', b.id)
        .eq('org_id', orgId);

      setReordering(false);

      if (e1 || e2) {
        setReorderError((e1 ?? e2)?.message ?? 'No se pudo reordenar.');
        void mutate();
        return;
      }

      onRefresh?.();
      void mutate();
    },
    [rows, orgId, reordering, onRefresh, mutate]
  );

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-background p-4">
        <p className="text-sm text-muted">Cargando puestos…</p>
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
        <button
          type="button"
          onClick={() => void mutate()}
          className="mt-3 min-h-[44px] min-w-[44px] rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-subtle-bg"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <>
      {reorderError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {reorderError}
        </div>
      )}
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
          Nuevo puesto
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-background p-6 text-center">
          <p className="text-sm text-muted">
            Aún no hay puestos de personal. Crea algunos (ej. Médico Turnate, Médico de refuerzo) para asignarlos a los
            miembros.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-background shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-subtle-bg">
                <th className="w-[90px] px-3 py-2.5 text-left font-medium text-text-primary">Orden</th>
                <th className="px-3 py-2.5 text-left font-medium text-text-primary">Puesto</th>
                <th className="px-3 py-2.5 text-right font-medium text-text-primary">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => move(idx, -1)}
                        disabled={reordering || idx === 0}
                        className="min-h-[44px] min-w-[44px] rounded-lg px-2 py-1.5 text-sm text-text-secondary hover:bg-subtle-bg disabled:opacity-40"
                        aria-label="Subir"
                        title="Subir"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => move(idx, 1)}
                        disabled={reordering || idx === rows.length - 1}
                        className="min-h-[44px] min-w-[44px] rounded-lg px-2 py-1.5 text-sm text-text-secondary hover:bg-subtle-bg disabled:opacity-40"
                        aria-label="Bajar"
                        title="Bajar"
                      >
                        ↓
                      </button>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-text-primary">{r.name}</td>
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

      <StaffPositionFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          onRefresh?.();
          void mutate();
        }}
        orgId={orgId}
        editing={null}
      />

      <StaffPositionFormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        onSuccess={() => {
          onRefresh?.();
          void mutate();
        }}
        orgId={orgId}
        editing={editing}
      />

      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title="Eliminar puesto"
        message={
          confirmDelete
            ? `¿Eliminar "${confirmDelete.name}"? No se puede si hay miembros asignados a este puesto.`
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
