'use client';

import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';

type Row = {
  id: string;
  name: string;
  slug: string | null;
  parent_id: string | null;
  created_at: string;
};

type Props = {
  refreshKey?: number;
};

const PAGE_SIZE = 50;

export function OrganizationList({ refreshKey = 0 }: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const swrKey = useMemo(() => ['organizationList', page] as const, [page]);

  const fetcher = useCallback(async (): Promise<{ rows: Row[]; total: number; parentNames: Record<string, string> }> => {
    const supabase = createClient();
    const fromIdx = (page - 1) * PAGE_SIZE;
    const { data, error: err, count } = await supabase
      .from('organizations')
      .select('id, name, slug, parent_id, created_at', { count: 'exact' })
      .order('name')
      .range(fromIdx, fromIdx + PAGE_SIZE - 1);
    if (err) throw new Error(err.message);
    const rows = (data ?? []) as Row[];
    const parentIds = [...new Set(rows.map((r) => r.parent_id).filter(Boolean))] as string[];
    const parentNames: Record<string, string> = {};
    if (parentIds.length > 0) {
      const { data: parents } = await supabase.from('organizations').select('id, name').in('id', parentIds);
      (parents ?? []).forEach((p: { id: string; name: string }) => {
        parentNames[p.id] = p.name;
      });
    }
    return { rows, total: count ?? 0, parentNames };
  }, [page]);

  const { data, error: swrError, isLoading, isValidating, mutate } = useSWR(swrKey, fetcher, {
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
      .channel('turnia:organizations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'organizations' }, () => scheduleRealtimeRefresh())
      .subscribe();

    return () => {
      if (realtimeTimerRef.current) {
        window.clearTimeout(realtimeTimerRef.current);
        realtimeTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [scheduleRealtimeRefresh]);

  const deleteOrg = useCallback(
    async (id: string) => {
      setDeletingId(id);
      const supabase = createClient();
      const { error } = await supabase.from('organizations').delete().eq('id', id);
      setDeletingId(null);
      setConfirmId(null);
      if (error) {
        await mutate();
        return;
      }
      // Refresh y ajustar página si se vacía (p.ej. borrar último item de la página)
      const next = await mutate();
      const totalAfter = (next as any)?.total as number | undefined;
      const totalPagesAfter = Math.max(1, Math.ceil((totalAfter ?? 0) / PAGE_SIZE));
      setPage((p) => Math.min(p, totalPagesAfter));
    },
    [mutate]
  );

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const parentNames = data?.parentNames ?? {};
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const loading = isLoading || (isValidating && !data);
  const error = swrError ? String((swrError as Error).message ?? swrError) : null;

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
        <div className="h-6 w-48 animate-pulse rounded bg-subtle-bg" />
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 w-full animate-pulse rounded bg-subtle-bg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
        <p className="text-red-600">{error}</p>
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

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
        <p className="text-text-secondary">No hay organizaciones.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-background shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead>
            <tr className="bg-subtle-bg">
              <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Nombre</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Padre</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Slug</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Creada</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id} className="bg-background">
                <td className="px-4 py-3 text-sm text-text-primary">{r.name}</td>
                <td className="px-4 py-3 text-sm text-muted">
                  {r.parent_id ? (parentNames[r.parent_id] ?? r.parent_id) : '—'}
                </td>
                <td className="px-4 py-3 text-sm text-muted">{r.slug ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-muted">
                  {new Date(r.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right text-sm">
                  <Link
                    href={`/dashboard/admin/organizations?edit=${r.id}`}
                    className="font-medium text-primary-600 hover:text-primary-700"
                  >
                    Editar
                  </Link>
                  <button
                    type="button"
                    onClick={() => setConfirmId(r.id)}
                    className="ml-3 font-medium text-red-600 hover:text-red-700"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border bg-background px-4 py-3">
          <p className="text-sm text-text-secondary">
            {total} organización{total !== 1 ? 'es' : ''} · Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-text-primary hover:bg-subtle-bg disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-text-primary hover:bg-subtle-bg disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={() => confirmId && deleteOrg(confirmId)}
        title="Eliminar organización"
        message={
          confirmId
            ? `¿Eliminar "${rows.find((r) => r.id === confirmId)?.name ?? 'esta organización'}"? Se borrarán todos los equipos, miembros, turnos e invitaciones. No se puede deshacer.`
            : ''
        }
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={!!confirmId && deletingId === confirmId}
      />
    </div>
  );
}
