'use client';

import { Pill } from '@/components/ui/Pill';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  SettingsIcon,
  StethoscopeIcon,
  XIcon,
} from '@/components/ui/icons';
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

const PALETTE = ['#0EA5E9', '#8B5CF6', '#14B8A6', '#F97316', '#F59E0B', '#A78BFA', '#EC4899', '#22C55E'];

function colorForPosition(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function StaffPositionsList({ orgId, refreshKey = 0, onRefresh }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<StaffPositionRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StaffPositionRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);

  const swrKey = useMemo(() => ['staffPositions', orgId] as const, [orgId]);
  const fetcher = useCallback(async (): Promise<{
    positions: StaffPositionRow[];
    counts: Record<string, number>;
  }> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('organization_staff_positions')
      .select('id, org_id, name, sort_order')
      .eq('org_id', orgId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw new Error(error.message);
    const positions = (data ?? []) as StaffPositionRow[];

    /* Count memberships per position */
    let counts: Record<string, number> = {};
    if (positions.length > 0) {
      const { data: members, error: mErr } = await supabase
        .from('memberships')
        .select('staff_position_id')
        .eq('org_id', orgId);
      if (!mErr && members) {
        counts = (members as { staff_position_id: string | null }[]).reduce<Record<string, number>>(
          (acc, m) => {
            if (m.staff_position_id) acc[m.staff_position_id] = (acc[m.staff_position_id] || 0) + 1;
            return acc;
          },
          {},
        );
      }
    }

    return { positions, counts };
  }, [orgId]);

  const { data, error: swrError, isLoading, isValidating, mutate } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
  });
  const rows = data?.positions ?? [];
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
      .channel(`turnia:staffPositions:${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'organization_staff_positions',
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
      .from('organization_staff_positions')
      .delete()
      .eq('id', confirmDelete.id)
      .eq('org_id', orgId);
    setDeleting(false);
    setConfirmDelete(null);
    if (err) {
      setDeleteError(
        err.code === '23503'
          ? 'No se puede eliminar: hay miembros con este puesto. Reasigna esos miembros primero.'
          : err.message,
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
          if (!prev) return prev;
          const prevRows = prev.positions;
          if (index < 0 || index >= prevRows.length) return prev;
          const t = index + dir;
          if (t < 0 || t >= prevRows.length) return prev;
          const next = [...prevRows];
          const ra = next[index];
          const rb = next[t];
          next[index] = { ...rb, sort_order: ra.sort_order };
          next[t] = { ...ra, sort_order: rb.sort_order };
          return { ...prev, positions: next };
        },
        { revalidate: false },
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
    [rows, orgId, reordering, onRefresh, mutate],
  );

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 w-full animate-pulse rounded-2xl bg-subtle-bg" />
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
          {rows.length} puesto{rows.length === 1 ? '' : 's'} configurado{rows.length === 1 ? '' : 's'}
        </p>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-semibold text-white shadow-[0_4px_12px_-6px_var(--color-primary)]"
        >
          <PlusIcon size={14} stroke={2.6} /> Nuevo puesto
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-bg p-8 text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{
              background: 'color-mix(in oklab, var(--color-primary) 14%, transparent)',
              color: 'var(--color-primary)',
            }}
            aria-hidden
          >
            <StethoscopeIcon size={22} />
          </div>
          <p className="text-[13.5px] font-semibold text-text">Sin puestos definidos</p>
          <p className="text-[12.5px] text-muted">
            Crea puestos como Médico Adjunto o Residente para asignarlos a los miembros.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-bg">
          <div className="hidden grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-border bg-subtle-bg px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted sm:grid">
            <span>Puesto</span>
            <span className="w-24 text-center">Miembros</span>
            <span className="w-24 text-center">Orden</span>
            <span className="w-20 text-right">Acciones</span>
          </div>
          {rows.map((r, idx) => {
            const color = colorForPosition(r.id);
            const memberCount = counts[r.id] ?? 0;
            return (
              <div
                key={r.id}
                className={
                  'grid grid-cols-1 items-center gap-3 px-4 py-3 sm:grid-cols-[1fr_auto_auto_auto] ' +
                  (idx < rows.length - 1 ? 'border-b border-border' : '')
                }
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background: `color-mix(in oklab, ${color} 18%, transparent)`,
                      color,
                    }}
                    aria-hidden
                  >
                    <StethoscopeIcon size={18} />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold text-text">{r.name}</div>
                    <div className="text-[11.5px] text-muted">
                      {memberCount > 0
                        ? `${memberCount} miembro${memberCount === 1 ? '' : 's'} asignado${memberCount === 1 ? '' : 's'}`
                        : 'Sin asignaciones'}
                    </div>
                  </div>
                </div>

                <div className="flex justify-start sm:w-24 sm:justify-center">
                  <Pill tone={memberCount > 0 ? 'primary' : 'muted'}>{memberCount}</Pill>
                </div>

                <div className="flex items-center gap-1 sm:w-24 sm:justify-center">
                  <button
                    type="button"
                    onClick={() => move(idx, -1)}
                    disabled={reordering || idx === 0}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-subtle-2 text-text-sec transition-colors hover:bg-subtle disabled:opacity-30"
                    aria-label="Subir"
                    title="Subir"
                  >
                    <ChevronUpIcon size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(idx, 1)}
                    disabled={reordering || idx === rows.length - 1}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-subtle-2 text-text-sec transition-colors hover:bg-subtle disabled:opacity-30"
                    aria-label="Bajar"
                    title="Bajar"
                  >
                    <ChevronDownIcon size={14} />
                  </button>
                </div>

                <div className="flex items-center gap-1 sm:w-20 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setEditing(r)}
                    aria-label="Editar"
                    title="Editar"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-sec transition-colors hover:bg-subtle-2"
                  >
                    <SettingsIcon size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(r)}
                    aria-label="Eliminar"
                    title="Eliminar"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red transition-colors hover:bg-red-soft"
                  >
                    <XIcon size={14} stroke={2.4} />
                  </button>
                </div>
              </div>
            );
          })}
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
    </div>
  );
}
