'use client';

import { Pill } from '@/components/ui/Pill';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { getContrastTextColor } from '@/lib/colorContrast';
import {
  BuildingIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PinIcon,
  SettingsIcon,
  UsersIcon,
  XIcon,
} from '@/components/ui/icons';
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

const PAGE_SIZE = 24;
const PALETTE = ['#0EA5E9', '#14B8A6', '#8B5CF6', '#F97316', '#22C55E', '#EC4899', '#F59E0B', '#A78BFA'];

function colorForOrg(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function orgInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? '?';
  const b = parts[1]?.[0] ?? parts[0]?.[1] ?? '';
  return (a + b).toUpperCase();
}

function timeAgo(iso: string, now: number): string {
  const days = Math.floor((now - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  if (days < 1) return 'hoy';
  if (days < 7) return `hace ${days}d`;
  if (days < 30) return `hace ${Math.floor(days / 7)} sem`;
  if (days < 365) return `hace ${Math.floor(days / 30)} meses`;
  return `hace ${Math.floor(days / 365)}a`;
}

export function OrganizationList({ refreshKey = 0 }: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const swrKey = useMemo(() => ['organizationList', page] as const, [page]);

  const fetcher = useCallback(async (): Promise<{
    rows: Row[];
    total: number;
    parentNames: Record<string, string>;
    memberCounts: Record<string, number>;
  }> => {
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

    /* Conteo de miembros por org. */
    const orgIds = rows.map((r) => r.id);
    let memberCounts: Record<string, number> = {};
    if (orgIds.length > 0) {
      const { data: members } = await supabase
        .from('memberships')
        .select('org_id')
        .in('org_id', orgIds);
      if (members) {
        memberCounts = (members as { org_id: string }[]).reduce<Record<string, number>>((acc, m) => {
          acc[m.org_id] = (acc[m.org_id] || 0) + 1;
          return acc;
        }, {});
      }
    }

    return { rows, total: count ?? 0, parentNames, memberCounts };
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'organizations' },
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
      const next = await mutate();
      const totalAfter = (next as { total?: number } | undefined)?.total;
      const totalPagesAfter = Math.max(1, Math.ceil((totalAfter ?? 0) / PAGE_SIZE));
      setPage((p) => Math.min(p, totalPagesAfter));
    },
    [mutate],
  );

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const parentNames = data?.parentNames ?? {};
  const memberCounts = data?.memberCounts ?? {};
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const loading = isLoading || (isValidating && !data);
  const error = swrError ? String((swrError as Error).message ?? swrError) : null;
  const now = Date.now();

  if (loading) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-subtle-bg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-bg p-6">
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

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-bg p-8 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{
            background: 'color-mix(in oklab, var(--color-primary) 14%, transparent)',
            color: 'var(--color-primary)',
          }}
          aria-hidden
        >
          <BuildingIcon size={22} />
        </div>
        <p className="text-[13.5px] font-semibold text-text">Sin organizaciones</p>
        <p className="text-[12.5px] text-muted">Crea tu primera organización para empezar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((r) => {
          const color = colorForOrg(r.id || r.name);
          const text = getContrastTextColor(color);
          const members = memberCounts[r.id] ?? 0;
          const isSubOrg = !!r.parent_id;
          return (
            <article
              key={r.id}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-bg p-4 transition-colors hover:border-border-strong"
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[15px] font-extrabold"
                  style={{ background: color, color: text }}
                  aria-hidden
                >
                  {orgInitials(r.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="tn-h truncate text-[15px] font-bold text-text">{r.name}</h3>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-muted">
                    {r.slug ? (
                      <span className="flex items-center gap-1">
                        <PinIcon size={11} />
                        {r.slug}
                      </span>
                    ) : null}
                    {r.parent_id ? (
                      <>
                        {r.slug ? <span aria-hidden>·</span> : null}
                        <span>↳ {parentNames[r.parent_id] ?? 'Organización padre'}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <Pill tone={isSubOrg ? 'blue' : 'green'} dot>
                  {isSubOrg ? 'Sub-org' : 'Activa'}
                </Pill>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
                <div>
                  <div className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted">
                    <UsersIcon size={11} /> Miembros
                  </div>
                  <div
                    className="tn-h mt-0.5 text-[22px] font-extrabold"
                    style={{ color: members > 0 ? 'var(--text)' : 'var(--muted-color)' }}
                  >
                    {members}
                  </div>
                </div>
                <div>
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted">
                    Creada
                  </div>
                  <div className="tn-h mt-0.5 text-[14px] font-bold text-text">
                    {timeAgo(r.created_at, now)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Link
                  href={`/dashboard/admin/organizations?edit=${r.id}`}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-subtle-2 text-[12.5px] font-semibold text-text-sec transition-colors hover:bg-subtle"
                >
                  <SettingsIcon size={13} />
                  Configurar
                </Link>
                <button
                  type="button"
                  onClick={() => setConfirmId(r.id)}
                  aria-label="Eliminar organización"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-red transition-colors hover:bg-red-soft"
                >
                  <XIcon size={14} stroke={2.4} />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-text-sec">
            {total} organización{total !== 1 ? 'es' : ''} · Página {page} de {totalPages}
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              aria-label="Página anterior"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-bg text-text-sec hover:bg-subtle-2 disabled:opacity-50"
            >
              <ChevronLeftIcon size={14} />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              aria-label="Página siguiente"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-bg text-text-sec hover:bg-subtle-2 disabled:opacity-50"
            >
              <ChevronRightIcon size={14} />
            </button>
          </div>
        </div>
      ) : null}

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
