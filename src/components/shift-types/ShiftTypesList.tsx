'use client';

import { Pill } from '@/components/ui/Pill';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ShiftLetter } from '@/components/ui/ShiftLetter';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  SettingsIcon,
  XIcon,
} from '@/components/ui/icons';
import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import type { ShiftTypeRow } from './ShiftTypeFormModal';
import { ShiftTypeFormModal } from './ShiftTypeFormModal';

type Props = {
  orgId: string;
  refreshKey?: number;
  onRefresh?: () => void;
};

function formatTime(t: string | null): string {
  if (!t) return '—';
  return t.substring(0, 5);
}

function durationOf(start: string | null, end: string | null): string {
  if (!start || !end) return '24h';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function ShiftTypesList({ orgId, refreshKey = 0, onRefresh }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ShiftTypeRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ShiftTypeRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);

  const { firstDay, lastDay } = useMemo(() => {
    const now = new Date();
    return {
      firstDay: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      lastDay: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString(),
    };
  }, []);

  const swrKey = useMemo(() => ['shiftTypes', orgId, firstDay] as const, [orgId, firstDay]);
  const fetcher = useCallback(async (): Promise<{
    rows: ShiftTypeRow[];
    counts: Record<string, number>;
  }> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('organization_shift_types')
      .select('id, org_id, name, letter, color, sort_order, start_time, end_time')
      .eq('org_id', orgId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as ShiftTypeRow[];

    /* Conteo de turnos por tipo en el mes actual. */
    let counts: Record<string, number> = {};
    if (rows.length > 0) {
      const { data: shifts } = await supabase
        .from('shifts')
        .select('shift_type_id')
        .eq('org_id', orgId)
        .gte('start_at', firstDay)
        .lte('start_at', lastDay);
      if (shifts) {
        counts = (shifts as { shift_type_id: string | null }[]).reduce<Record<string, number>>(
          (acc, s) => {
            if (s.shift_type_id) acc[s.shift_type_id] = (acc[s.shift_type_id] || 0) + 1;
            return acc;
          },
          {},
        );
      }
    }
    return { rows, counts };
  }, [orgId, firstDay, lastDay]);

  const { data, error: swrError, isLoading, isValidating, mutate } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
  });
  const rows = data?.rows ?? [];
  const counts = data?.counts ?? {};

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
      .channel(`turnia:shiftTypes:${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'organization_shift_types',
          filter: `org_id=eq.${orgId}`,
        },
        () => scheduleRealtimeRefresh(),
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
          : err.message,
      );
      return;
    }
    onRefresh?.();
    void mutate();
  }, [orgId, confirmDelete, onRefresh, mutate]);

  const existingLetters = rows.map((r) => r.letter);
  const existingColors = rows.map((r) => r.color);

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
          if (!prev) return prev;
          const prevRows = prev.rows;
          if (index < 0 || index >= prevRows.length) return prev;
          const t = index + dir;
          if (t < 0 || t >= prevRows.length) return prev;
          const next = [...prevRows];
          const ra = next[index];
          const rb = next[t];
          next[index] = { ...rb, sort_order: ra.sort_order };
          next[t] = { ...ra, sort_order: rb.sort_order };
          return { ...prev, rows: next };
        },
        { revalidate: false },
      );

      const supabase = createClient();
      const { error: e1 } = await supabase
        .from('organization_shift_types')
        .update({ sort_order: b.sort_order })
        .eq('id', a.id)
        .eq('org_id', orgId);

      const { error: e2 } = await supabase
        .from('organization_shift_types')
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
    [rows, orgId, reordering, onRefresh, mutate],
  );

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-44 animate-pulse rounded-2xl bg-subtle-bg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-bg p-4">
        <p className="text-sm text-red">{error}</p>
        <button
          type="button"
          onClick={() => void mutate()}
          className="mt-3 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-sec hover:bg-subtle-2"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {(reorderError || deleteError) && (
        <div className="rounded-xl border border-border bg-subtle-bg p-3 text-sm text-red">
          {reorderError || deleteError}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-muted">
          {rows.length} tipo{rows.length === 1 ? '' : 's'} configurado{rows.length === 1 ? '' : 's'}
        </p>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-semibold text-white shadow-[0_4px_12px_-6px_var(--color-primary)]"
        >
          <PlusIcon size={14} stroke={2.6} /> Nuevo tipo
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r, idx) => {
          const count = counts[r.id] ?? 0;
          return (
            <article
              key={r.id}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-bg p-4 transition-colors hover:border-border-strong"
            >
              <div className="flex items-start gap-3">
                <ShiftLetter letter={r.letter} color={r.color} size={48} />
                <div className="min-w-0 flex-1">
                  <h3 className="tn-h truncate text-[15px] font-bold text-text">{r.name}</h3>
                  <p className="mt-0.5 text-[12px] text-muted">
                    {formatTime(r.start_time)} — {formatTime(r.end_time)} · {durationOf(r.start_time, r.end_time)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(r)}
                  aria-label="Editar tipo"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-sec hover:bg-subtle-2"
                >
                  <SettingsIcon size={14} />
                </button>
              </div>

              <div className="mt-1 flex items-center justify-between border-t border-border pt-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
                  Programados este mes
                </span>
                <span
                  className="tn-h text-[18px] font-extrabold"
                  style={{ color: r.color }}
                >
                  {count}
                </span>
              </div>

              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(idx, -1)}
                    disabled={reordering || idx === 0}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-subtle-2 text-text-sec hover:bg-subtle disabled:opacity-30"
                    aria-label="Subir orden"
                    title="Subir orden"
                  >
                    <ChevronLeftIcon size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(idx, 1)}
                    disabled={reordering || idx === rows.length - 1}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-subtle-2 text-text-sec hover:bg-subtle disabled:opacity-30"
                    aria-label="Bajar orden"
                    title="Bajar orden"
                  >
                    <ChevronRightIcon size={14} />
                  </button>
                </div>
                {count === 0 ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(r)}
                    aria-label="Eliminar tipo"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red hover:bg-red-soft"
                  >
                    <XIcon size={14} stroke={2.4} />
                  </button>
                ) : (
                  <Pill tone="muted">En uso</Pill>
                )}
              </div>
            </article>
          );
        })}

        {/* Card "+" dashed para crear */}
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-border text-muted transition-colors hover:border-primary hover:text-primary"
        >
          <PlusIcon size={22} stroke={2} />
          <span className="text-[13px] font-semibold">Crear tipo</span>
        </button>
      </div>

      <ShiftTypeFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          onRefresh?.();
          void mutate();
        }}
        orgId={orgId}
        editing={null}
        existingLetters={existingLetters}
        existingColors={existingColors}
      />

      <ShiftTypeFormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        onSuccess={() => {
          onRefresh?.();
          void mutate();
        }}
        orgId={orgId}
        editing={editing}
        existingLetters={existingLetters}
        existingColors={existingColors}
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
    </div>
  );
}
