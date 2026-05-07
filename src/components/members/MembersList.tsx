'use client';

/**
 * Lista de miembros con avatar coloreado, Pills por rol y acciones.
 * Diseño: ref docs/design/screens/extras.jsx DAdminMembers (línea 413).
 */

import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Icons } from '@/components/ui/icons';
import { Pill, type PillTone } from '@/components/ui/Pill';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { EditMembershipForm } from './EditMembershipForm';
import { MemberDetails } from './MemberDetails';
import type { MemberForDetails } from './MemberDetails';
import { ROLE_LABELS } from './role-labels';

const ERROR_MESSAGES: Record<string, string> = {
  forbidden: 'No tienes permiso para realizar esta acción.',
  membership_not_found: 'No se encontró la membresía.',
  cannot_remove_superadmin: 'Solo un superadmin puede eliminar a un superadmin.',
  cannot_remove_last_admin: 'No se puede eliminar al último administrador de la organización.',
};

type Props = {
  orgId: string;
  refreshKey?: number;
  onRefresh?: () => void;
  onCountsChange?: (counts: RoleCounts) => void;
};

export type RoleCounts = {
  total: number;
  superadmin: number;
  org_admin: number;
  team_manager: number;
  user: number;
  viewer: number;
};

const PAGE_SIZE = 50;
const PALETTE = ['#0EA5E9', '#8B5CF6', '#14B8A6', '#F97316', '#F59E0B', '#A78BFA', '#EC4899', '#22C55E'];

function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function getInitials(name: string | null, email: string | null): string {
  const base = (name?.trim() || email || '').trim();
  if (!base) return '?';
  const parts = base.split(/\s+|@/).filter(Boolean);
  const a = parts[0]?.[0] ?? '?';
  const b = parts[1]?.[0] ?? '';
  return (a + b).toUpperCase();
}

function roleToTone(role: string): PillTone {
  switch (role) {
    case 'superadmin':
      return 'amber';
    case 'org_admin':
      return 'red';
    case 'team_manager':
      return 'violet';
    case 'viewer':
      return 'muted';
    case 'user':
    default:
      return 'primary';
  }
}

export function MembersList({ orgId, refreshKey = 0, onRefresh, onCountsChange }: Props) {
  const [detailMember, setDetailMember] = useState<MemberForDetails | null>(null);
  const [editMember, setEditMember] = useState<MemberForDetails | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<MemberForDetails | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const swrKey = useMemo(() => ['membersList', orgId, page] as const, [orgId, page]);

  const fetcher = useCallback(async (): Promise<{ rows: MemberForDetails[]; total: number; counts: RoleCounts }> => {
    const supabase = createClient();
    const fromIdx = (page - 1) * PAGE_SIZE;
    const { data: memberships, error: mErr, count } = await supabase
      .from('memberships')
      .select(
        'id, user_id, role, staff_position_id, created_at, updated_at, organization_staff_positions(name)',
        { count: 'exact' }
      )
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .range(fromIdx, fromIdx + PAGE_SIZE - 1);

    if (mErr) throw new Error(mErr.message);

    const list = (memberships ?? []) as {
      id: string;
      user_id: string;
      role: string;
      staff_position_id: string | null;
      created_at: string;
      updated_at: string | null;
      organization_staff_positions: { name: string } | { name: string }[] | null;
    }[];

    const baseCounts: RoleCounts = { total: count ?? 0, superadmin: 0, org_admin: 0, team_manager: 0, user: 0, viewer: 0 };
    if (list.length === 0) return { rows: [], total: count ?? 0, counts: baseCounts };

    const userIds = [...new Set(list.map((m) => m.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);
    const profileMap = Object.fromEntries(((profiles ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((p) => [p.id, p]));

    const merged: MemberForDetails[] = list.map((m) => {
      const p = profileMap[m.user_id];
      const sp = m.organization_staff_positions;
      const staffPositionName = sp ? (Array.isArray(sp) ? sp[0]?.name : sp?.name) : null;
      const role = m.role as keyof RoleCounts;
      if (role !== 'total' && role in baseCounts) {
        baseCounts[role] = (baseCounts[role] ?? 0) + 1;
      }
      return {
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        staff_position_id: m.staff_position_id,
        staff_position_name: staffPositionName?.trim() ?? null,
        created_at: m.created_at,
        updated_at: m.updated_at ?? undefined,
        full_name: p?.full_name ?? null,
        email: p?.email ?? null,
      };
    });

    return { rows: merged, total: count ?? 0, counts: baseCounts };
  }, [orgId, page]);

  const { data, error: swrError, isLoading, isValidating, mutate } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
  });

  useEffect(() => {
    void mutate();
  }, [refreshKey, mutate]);

  useEffect(() => {
    if (data?.counts) onCountsChange?.(data.counts);
  }, [data?.counts, onCountsChange]);

  const realtimeTimerRef = useRef<number | null>(null);
  const scheduleRealtimeRefresh = useCallback(() => {
    if (realtimeTimerRef.current) window.clearTimeout(realtimeTimerRef.current);
    realtimeTimerRef.current = window.setTimeout(() => void mutate(), 250);
  }, [mutate]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`turnia:memberships:${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'memberships', filter: `org_id=eq.${orgId}` },
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

  const doRemove = useCallback(async () => {
    if (!confirmRemove) return;
    setRemoving(true);
    setRemoveError(null);
    const supabase = createClient();
    const { data: rpcData, error: rpcError } = await supabase.rpc('remove_from_org', {
      p_org_id: orgId,
      p_user_id: confirmRemove.user_id,
    });
    setRemoving(false);
    setConfirmRemove(null);
    if (rpcError) {
      setRemoveError(rpcError.message);
      return;
    }
    const res = rpcData as { ok?: boolean; error?: string } | null;
    if (!res?.ok) {
      setRemoveError(ERROR_MESSAGES[res?.error ?? ''] ?? res?.error ?? 'Error al eliminar');
      return;
    }
    onRefresh?.();
    void mutate();
  }, [orgId, confirmRemove, onRefresh, mutate]);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const loading = isLoading || (isValidating && !data);
  const error = swrError ? String((swrError as Error).message ?? swrError) : null;

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => void mutate()}
          className="mt-3 inline-flex h-9 items-center rounded-lg border border-border bg-bg px-3 text-[12.5px] font-semibold text-text-sec hover:text-text"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface px-5 py-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-subtle-2 text-muted">
          <Icons.users size={20} />
        </div>
        <p className="tn-h text-[15px] font-bold text-text">Sin miembros</p>
        <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted">
          Aún no hay miembros en esta organización. Invita a alguien para comenzar.
        </p>
      </div>
    );
  }

  return (
    <>
      {removeError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {removeError}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {rows.map((r, i) => {
          const userColor = colorForUser(r.user_id);
          const tone = roleToTone(r.role);
          const isLast = i === rows.length - 1;
          return (
            <div
              key={r.id}
              className={cn(
                'flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-subtle-2/50',
                !isLast ? 'border-b border-border' : ''
              )}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12.5px] font-extrabold"
                style={{ backgroundColor: userColor + '22', color: userColor }}
              >
                {getInitials(r.full_name, r.email)}
              </div>
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setDetailMember(r)}
                  className="block w-full truncate text-left text-[13.5px] font-semibold text-text hover:text-primary"
                >
                  {r.full_name?.trim() || r.email || 'Sin nombre'}
                </button>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 truncate text-[11.5px] text-muted">
                  {r.email ? <span className="truncate">{r.email}</span> : null}
                  {r.staff_position_name ? <span className="truncate">· {r.staff_position_name}</span> : null}
                </p>
              </div>
              <Pill tone={tone}>{ROLE_LABELS[r.role] ?? r.role}</Pill>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setDetailMember(r)}
                  aria-label="Ver detalle"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-subtle-2 hover:text-text"
                >
                  <Icons.eye size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditMember(r)}
                  aria-label="Editar"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-text-sec hover:bg-subtle-2 hover:text-primary"
                >
                  <Icons.settings size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRemove(r)}
                  aria-label="Eliminar"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-text-sec hover:bg-red-soft hover:text-red"
                >
                  <Icons.x size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12.5px] text-text-sec">
            {total} miembro{total !== 1 ? 's' : ''} · Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex h-9 items-center rounded-lg border border-border bg-bg px-3 text-[12.5px] font-semibold text-text-sec hover:text-text disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex h-9 items-center rounded-lg border border-border bg-bg px-3 text-[12.5px] font-semibold text-text-sec hover:text-text disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      ) : null}

      {detailMember ? (
        <MemberDetails
          member={detailMember}
          onClose={() => setDetailMember(null)}
          onEditRole={() => {
            setDetailMember(null);
            setEditMember(detailMember);
          }}
        />
      ) : null}

      {editMember ? (
        <EditMembershipForm
          member={editMember}
          orgId={orgId}
          onSuccess={() => {
            onRefresh?.();
            void mutate();
          }}
          onClose={() => setEditMember(null)}
        />
      ) : null}

      <ConfirmModal
        open={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        onConfirm={doRemove}
        title="Eliminar miembro"
        message={
          confirmRemove
            ? `¿Eliminar a ${confirmRemove.full_name?.trim() || confirmRemove.email || 'este usuario'} de la organización? Dejará de tener acceso.`
            : ''
        }
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={removing}
      />
    </>
  );
}
