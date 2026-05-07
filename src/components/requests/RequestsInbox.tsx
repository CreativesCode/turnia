'use client';

/**
 * Bandeja de solicitudes para Manager (DRequests):
 * - Desktop: layout master/detail (lista 380px + panel de detalle).
 * - Mobile: lista de cards + modal `RequestDetailModal`.
 * Diseño: ref docs/design/screens/desktop.jsx DRequests (línea 440).
 */

import { RequestDetailModal, type RequestDetailRow } from '@/components/requests/RequestDetailModal';
import { Icons } from '@/components/ui/icons';
import { Pill } from '@/components/ui/Pill';
import { ShiftLetter } from '@/components/ui/ShiftLetter';
import { Skeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { cn } from '@/lib/cn';
import { createClient } from '@/lib/supabase/client';
import { fetchProfilesMap } from '@/lib/supabase/queries';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';

type StatusFilter = 'pending' | 'approved' | 'rejected';

type CountMap = Record<StatusFilter, number>;

type Props = {
  orgId: string | null;
  canApprove: boolean;
  refreshKey?: number;
};

const REQUEST_TYPE_LABEL: Record<string, string> = {
  give_away: 'Cesión',
  swap: 'Intercambio',
  take_open: 'Turno abierto',
};

const PALETTE = ['#0EA5E9', '#8B5CF6', '#14B8A6', '#F97316', '#F59E0B', '#A78BFA', '#EC4899', '#22C55E'];

function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase() || '?'
  );
}

function getTypeLetter(ot: { name: string; letter: string } | { name: string; letter: string }[] | null): string {
  if (!ot) return '?';
  const o = Array.isArray(ot) ? ot[0] : ot;
  return o?.letter ?? '?';
}

function getTypeName(ot: { name: string; letter: string } | { name: string; letter: string }[] | null): string {
  if (!ot) return 'Turno';
  const o = Array.isArray(ot) ? ot[0] : ot;
  return o?.name ?? 'Turno';
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return 'ahora';
  if (diff < 3600_000) return `hace ${Math.floor(diff / 60_000)} min`;
  if (diff < 86400_000) return `hace ${Math.floor(diff / 3600_000)}h`;
  if (diff < 86400_000 * 2) return 'ayer';
  if (diff < 86400_000 * 7) return `${Math.floor(diff / 86400_000)}d`;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

function formatRangeShort(start: string, end: string): string {
  const d1 = new Date(start);
  const d2 = new Date(end);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return '—';
  const dayShort = d1.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
  const t1 = d1.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const t2 = d2.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `${capitalize(dayShort)} · ${t1}–${t2}`;
}

function formatLongDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const day = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  const t = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${t}`;
}

function shortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 6).toUpperCase();
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function statusToFilter(status: string): StatusFilter {
  if (status === 'approved') return 'approved';
  if (status === 'rejected' || status === 'cancelled') return 'rejected';
  return 'pending';
}

function durationHours(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (!isFinite(s) || !isFinite(e) || e <= s) return 0;
  return Math.round(((e - s) / 3600000) * 10) / 10;
}

export function RequestsInbox({ orgId, canApprove, refreshKey = 0 }: Props) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState<RequestDetailRow | null>(null);
  const searchParams = useSearchParams();
  const openRequestId = searchParams?.get('request') ?? null;
  const lastToastErrorRef = useRef<string | null>(null);

  const swrKey = useMemo(() => {
    if (!orgId) return null;
    return ['requestsInbox', orgId, statusFilter] as const;
  }, [orgId, statusFilter]);

  const fetcher = useCallback(async (): Promise<{ rows: RequestDetailRow[]; names: Record<string, string>; counts: CountMap }> => {
    if (!orgId) return { rows: [], names: {}, counts: { pending: 0, approved: 0, rejected: 0 } };
    const supabase = createClient();

    const statuses =
      statusFilter === 'pending'
        ? ['submitted', 'accepted']
        : statusFilter === 'approved'
          ? ['approved']
          : ['rejected', 'cancelled'];

    const { data, error: err } = await supabase
      .from('shift_requests')
      .select(
        `id, request_type, status, comment, created_at, shift_id, target_shift_id, target_user_id, requester_id, suggested_replacement_user_id,
         shift:shifts!shift_id(start_at, end_at, assigned_user_id, location, organization_shift_types(name, letter, color)),
         target_shift:shifts!target_shift_id(start_at, end_at, assigned_user_id, location, organization_shift_types(name, letter, color))`
      )
      .eq('org_id', orgId)
      .in('status', statuses)
      .order('created_at', { ascending: false });

    if (err) throw new Error(err.message);

    const rows = ((data ?? []) as unknown) as RequestDetailRow[];
    const userIds = new Set<string>();
    rows.forEach((r) => {
      userIds.add(r.requester_id);
      if (r.shift?.assigned_user_id) userIds.add(r.shift.assigned_user_id);
      if (r.target_shift?.assigned_user_id) userIds.add(r.target_shift.assigned_user_id);
      if (r.target_user_id) userIds.add(r.target_user_id);
      if (r.suggested_replacement_user_id) userIds.add(r.suggested_replacement_user_id);
    });
    const names = userIds.size > 0
      ? await fetchProfilesMap(supabase, Array.from(userIds), { fallbackName: (id) => id.slice(0, 8) })
      : {};

    // Counts por estado (paralelo)
    const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
      supabase
        .from('shift_requests')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .in('status', ['submitted', 'accepted']),
      supabase
        .from('shift_requests')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('status', 'approved'),
      supabase
        .from('shift_requests')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .in('status', ['rejected', 'cancelled']),
    ]);

    const counts: CountMap = {
      pending: pendingRes.count ?? 0,
      approved: approvedRes.count ?? 0,
      rejected: rejectedRes.count ?? 0,
    };

    return { rows, names, counts };
  }, [orgId, statusFilter]);

  const { data: swrData, error: swrError, isLoading, isValidating, mutate } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
  });

  useEffect(() => {
    if (!swrKey) return;
    void mutate();
  }, [refreshKey, mutate, swrKey]);

  const rows = swrData?.rows ?? [];
  const names = swrData?.names ?? {};
  const counts: CountMap = swrData?.counts ?? { pending: 0, approved: 0, rejected: 0 };
  const loading = isLoading || (isValidating && !swrData);
  const error = swrError ? String((swrError as Error).message ?? swrError) : null;

  // Filtrado por búsqueda (cliente)
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const requester = names[r.requester_id]?.toLowerCase() ?? '';
      const shiftName = r.shift ? getTypeName(r.shift.organization_shift_types).toLowerCase() : '';
      return requester.includes(q) || shiftName.includes(q);
    });
  }, [rows, names, search]);

  useEffect(() => {
    if (!error) return;
    if (lastToastErrorRef.current === error) return;
    lastToastErrorRef.current = error;
    toast({ variant: 'error', title: 'No se pudieron cargar solicitudes', message: error });
  }, [error, toast]);

  // Auto-selección al cargar (desktop) y deep link via ?request=id
  useEffect(() => {
    if (rows.length === 0) {
      if (selectedId) setSelectedId(null);
      return;
    }
    if (openRequestId && rows.find((r) => r.id === openRequestId)) {
      setSelectedId(openRequestId);
      return;
    }
    if (!selectedId || !rows.find((r) => r.id === selectedId)) {
      setSelectedId(rows[0].id);
    }
  }, [rows, openRequestId, selectedId]);

  // Si entra deep-link en mobile, abrir modal
  useEffect(() => {
    if (openRequestId && rows.length > 0) {
      const r = rows.find((row) => row.id === openRequestId);
      if (r && window.matchMedia('(max-width: 767px)').matches) {
        const t = window.setTimeout(() => setMobileDetail(r), 0);
        return () => window.clearTimeout(t);
      }
    }
  }, [openRequestId, rows]);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  const handleSelectMobile = useCallback((r: RequestDetailRow) => {
    setMobileDetail(r);
  }, []);

  const handleResolved = useCallback(() => {
    void mutate();
  }, [mutate]);

  if (!orgId) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6">
        <p className="text-sm text-muted">Selecciona una organización.</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop: layout master/detail */}
      <div className="hidden gap-4 md:flex md:min-h-[640px]">
        <div className="flex w-[380px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface">
          <ListHeader
            statusFilter={statusFilter}
            counts={counts}
            search={search}
            onSearchChange={setSearch}
            onStatusChange={setStatusFilter}
          />
          <RequestList
            loading={loading}
            rows={filteredRows}
            names={names}
            selectedId={selectedId}
            onSelect={(r) => setSelectedId(r.id)}
            error={error}
          />
        </div>

        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-surface">
          {selected ? (
            <RequestDetailPanel
              request={selected}
              names={names}
              canApprove={canApprove}
              onResolved={handleResolved}
            />
          ) : (
            <DetailEmptyState />
          )}
        </div>
      </div>

      {/* Mobile: lista + modal */}
      <div className="md:hidden">
        <div className="space-y-3">
          <ListHeader
            statusFilter={statusFilter}
            counts={counts}
            search={search}
            onSearchChange={setSearch}
            onStatusChange={setStatusFilter}
            mobile
          />
          <RequestList
            loading={loading}
            rows={filteredRows}
            names={names}
            selectedId={null}
            onSelect={handleSelectMobile}
            error={error}
            mobile
          />
        </div>
        <RequestDetailModal
          open={!!mobileDetail}
          onClose={() => setMobileDetail(null)}
          onResolved={() => {
            setMobileDetail(null);
            void mutate();
          }}
          request={mobileDetail}
          names={names}
        />
      </div>
    </>
  );
}

function ListHeader({
  statusFilter,
  counts,
  search,
  onSearchChange,
  onStatusChange,
  mobile,
}: {
  statusFilter: StatusFilter;
  counts: CountMap;
  search: string;
  onSearchChange: (v: string) => void;
  onStatusChange: (v: StatusFilter) => void;
  mobile?: boolean;
}) {
  const tabs: { key: StatusFilter; label: string }[] = [
    { key: 'pending', label: 'Pendientes' },
    { key: 'approved', label: 'Aprobadas' },
    { key: 'rejected', label: 'Rechazadas' },
  ];
  return (
    <div
      className={cn(
        'flex flex-col gap-2.5',
        mobile ? 'rounded-2xl border border-border bg-surface p-3' : 'border-b border-border p-4'
      )}
    >
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {tabs.map((t) => {
          const active = statusFilter === t.key;
          const n = counts[t.key];
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onStatusChange(t.key)}
              aria-pressed={active}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
                active ? 'bg-text text-bg' : 'text-text-sec hover:bg-subtle-2'
              )}
            >
              {t.label}
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-1.5 text-[10.5px] font-bold',
                  active ? 'bg-white/18 text-white' : 'bg-subtle-2 text-muted'
                )}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>

      <label
        className={cn(
          'flex h-9 items-center gap-2 rounded-lg border border-border bg-subtle-2 px-2.5 text-[12px] text-muted',
          'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15'
        )}
      >
        <Icons.search size={14} />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar persona, fecha…"
          className="h-full w-full bg-transparent text-text outline-none placeholder:text-muted"
        />
      </label>
    </div>
  );
}

function RequestList({
  loading,
  rows,
  names,
  selectedId,
  onSelect,
  error,
  mobile,
}: {
  loading: boolean;
  rows: RequestDetailRow[];
  names: Record<string, string>;
  selectedId: string | null;
  onSelect: (r: RequestDetailRow) => void;
  error: string | null;
  mobile?: boolean;
}) {
  if (loading) {
    return (
      <div className={cn('space-y-2', mobile ? '' : 'flex-1 overflow-y-auto p-3')}>
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    );
  }
  if (error) {
    return (
      <div className={cn('p-4', mobile ? '' : 'flex-1')}>
        <p className="text-[12.5px] text-red-600">{error}</p>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className={cn('flex items-center justify-center px-4 py-12 text-center', mobile ? '' : 'flex-1')}>
        <div>
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-subtle-2 text-muted">
            <Icons.inbox size={18} />
          </div>
          <p className="text-[13px] font-semibold text-text">Sin solicitudes</p>
          <p className="mt-0.5 text-[11.5px] text-muted">No hay solicitudes con ese filtro.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(mobile ? 'space-y-2' : 'flex-1 overflow-y-auto')}>
      {rows.map((r) => {
        const requesterName = names[r.requester_id] ?? r.requester_id.slice(0, 8);
        const isAccepted = r.status === 'accepted';
        const TypeIcon = r.request_type === 'swap' ? Icons.swap : r.request_type === 'give_away' ? Icons.giveaway : Icons.takeOpen;
        const typeLabel = REQUEST_TYPE_LABEL[r.request_type] ?? r.request_type;
        const meta = r.shift ? formatRangeShort(r.shift.start_at, r.shift.end_at) : '—';
        const swapMeta = r.request_type === 'swap' && r.target_shift ? ` ⇄ ${formatRangeShort(r.target_shift.start_at, r.target_shift.end_at).split(' · ')[0]}` : '';
        const userColor = colorForUser(r.requester_id);
        const selected = selectedId === r.id;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onSelect(r)}
            className={cn(
              'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
              mobile
                ? 'rounded-xl border border-border bg-surface hover:bg-subtle-2'
                : 'border-b border-border hover:bg-subtle-2/40',
              !mobile && selected ? 'bg-primary-soft/40' : '',
              !mobile && selected ? 'border-l-[3px] border-l-primary pl-[13px]' : 'border-l-[3px] border-l-transparent pl-[13px]'
            )}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold"
              style={{ backgroundColor: userColor + '22', color: userColor }}
            >
              {getInitials(requesterName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-semibold text-text">{requesterName}</span>
                {isAccepted ? (
                  <span
                    className="rounded px-1.5 py-px text-[9.5px] font-bold uppercase tracking-[0.04em]"
                    style={{
                      backgroundColor: 'color-mix(in oklab, var(--green) 22%, transparent)',
                      color: 'var(--green)',
                    }}
                  >
                    Aceptado
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 flex items-center gap-1 truncate text-[11.5px] text-muted">
                <TypeIcon size={11} />
                {typeLabel} · {meta}
                {swapMeta}
              </p>
            </div>
            <span className="shrink-0 text-[10.5px] text-muted">{formatRelative(r.created_at)}</span>
          </button>
        );
      })}
    </div>
  );
}

function DetailEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-subtle-2 text-muted">
        <Icons.inbox size={22} />
      </div>
      <p className="tn-h text-[15px] font-bold text-text">Selecciona una solicitud</p>
      <p className="mt-1 max-w-sm text-[12.5px] text-muted">Elige una solicitud de la lista para ver el detalle y aprobar o rechazar.</p>
    </div>
  );
}

function RequestDetailPanel({
  request,
  names,
  canApprove,
  onResolved,
}: {
  request: RequestDetailRow;
  names: Record<string, string>;
  canApprove: boolean;
  onResolved: () => void;
}) {
  const { toast } = useToast();
  const [managerComment, setManagerComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCommentBox, setShowCommentBox] = useState(false);

  // Reset estado al cambiar de solicitud
  useEffect(() => {
    setManagerComment('');
    setShowCommentBox(false);
  }, [request.id]);

  const canAct = ['submitted', 'accepted'].includes(request.status);
  const requesterName = names[request.requester_id] ?? request.requester_id.slice(0, 8);
  const userColor = colorForUser(request.requester_id);

  const TypeIcon = request.request_type === 'swap' ? Icons.swap : request.request_type === 'give_away' ? Icons.giveaway : Icons.takeOpen;
  const typeTitle =
    request.request_type === 'swap' ? 'Intercambio de turnos'
      : request.request_type === 'give_away' ? 'Cesión de turno'
        : 'Solicitud de turno abierto';

  const submittedAt = new Date(request.created_at);
  const submittedLabel = `${formatLongDateTime(request.created_at)}`;

  const action = useCallback(async (kind: 'approve' | 'reject') => {
    if (kind === 'reject' && !showCommentBox) {
      setShowCommentBox(true);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr || !refreshData?.session?.access_token) {
      toast({ variant: 'error', title: 'Sesión expirada', message: 'Recarga la página e inicia sesión de nuevo.' });
      setLoading(false);
      return;
    }
    const { data, error: fnErr } = await supabase.functions.invoke('approve-request', {
      body: {
        requestId: request.id,
        action: kind,
        comment: kind === 'reject' && managerComment.trim() ? managerComment.trim() : undefined,
      },
    });
    setLoading(false);
    const json = (data ?? {}) as { ok?: boolean; error?: string };
    if (fnErr || !json.ok) {
      const msg = String(json.error || (fnErr as Error)?.message || 'Error al procesar.');
      toast({ variant: 'error', title: 'No se pudo procesar', message: msg });
      return;
    }
    setManagerComment('');
    setShowCommentBox(false);
    toast({
      variant: 'success',
      title: kind === 'approve' ? 'Solicitud aprobada' : 'Solicitud rechazada',
      message: 'La solicitud fue procesada correctamente.',
    });
    onResolved();
  }, [request.id, managerComment, showCommentBox, onResolved, toast]);

  return (
    <div className="flex h-full flex-col">
      {/* Header del detalle */}
      <div className="border-b border-border p-6">
        <div className="flex items-start gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: 'color-mix(in oklab, var(--primary) 14%, transparent)',
              color: 'var(--primary)',
            }}
          >
            <TypeIcon size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="tn-h text-[22px] font-bold tracking-[-0.02em] text-text">{typeTitle}</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">
              Solicitado por <span className="font-semibold text-text">{requesterName}</span>
              <span className="mx-1.5 text-muted">·</span>
              {formatRelative(request.created_at)}
              <span className="mx-1.5 text-muted">·</span>
              ID #SR-{submittedAt.getFullYear()}-{shortId(request.id)}
            </p>
          </div>
          {request.status === 'accepted' ? (
            <Pill tone="green" dot>Contraparte aceptó</Pill>
          ) : request.status === 'approved' ? (
            <Pill tone="green" dot>Aprobada</Pill>
          ) : request.status === 'rejected' ? (
            <Pill tone="red" dot>Rechazada</Pill>
          ) : request.status === 'cancelled' ? (
            <Pill tone="muted">Cancelada</Pill>
          ) : (
            <Pill tone="amber" dot>Pendiente</Pill>
          )}
        </div>

        <div className="mt-4">
          <RequestVisual request={request} names={names} userColor={userColor} />
        </div>
      </div>

      {/* Body scrollable */}
      <div className="flex-1 overflow-y-auto p-6">
        <RequestDetails request={request} names={names} />

        {request.comment ? (
          <div className="mt-6">
            <h3 className="tn-h mb-2.5 text-[12px] font-bold uppercase tracking-[0.06em] text-muted">Mensaje del solicitante</h3>
            <div className="rounded-xl border border-border bg-subtle-2/60 p-3.5 text-[13.5px] leading-[1.55] text-text">
              {request.comment}
            </div>
          </div>
        ) : null}

        <div className="mt-6">
          <h3 className="tn-h mb-2.5 text-[12px] font-bold uppercase tracking-[0.06em] text-muted">Línea de tiempo</h3>
          <RequestTimeline request={request} names={names} />
        </div>
      </div>

      {/* Footer pegajoso */}
      {canActOn(request.status) && canApprove ? (
        <div className="border-t border-border bg-subtle-2/60 p-4">
          {showCommentBox ? (
            <div className="mb-3">
              <label className="mb-1.5 block text-[12px] font-semibold text-text-sec">
                Comentario para el solicitante (opcional)
              </label>
              <Textarea
                value={managerComment}
                onChange={(e) => setManagerComment(e.target.value)}
                placeholder="Motivo del rechazo o nota…"
                rows={2}
                className="min-h-[64px]"
              />
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={loading}
              onClick={() => setShowCommentBox((v) => !v)}
              className="inline-flex h-10 items-center rounded-lg border border-border bg-bg px-3.5 text-[13px] font-medium text-text-sec transition-colors hover:text-text disabled:opacity-50"
            >
              {showCommentBox ? 'Ocultar comentario' : 'Pedir más info'}
            </button>
            <div className="flex-1" />
            <button
              type="button"
              disabled={loading}
              onClick={() => action('reject')}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-bg px-4 text-[13.5px] font-semibold text-red transition-colors hover:bg-red-soft disabled:opacity-50"
              style={{ border: '1px solid color-mix(in oklab, var(--red) 55%, transparent)' }}
            >
              <Icons.x size={15} /> Rechazar
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => action('approve')}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-green px-5 text-[13.5px] font-bold text-white transition-transform hover:-translate-y-px disabled:opacity-50"
              style={{ boxShadow: '0 8px 18px -10px var(--green)' }}
            >
              <Icons.check size={15} stroke={2.6 as unknown as number} />{' '}
              {request.request_type === 'swap' ? 'Aprobar intercambio' : request.request_type === 'give_away' ? 'Aprobar cesión' : 'Aprobar'}
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t border-border bg-subtle-2/60 p-4">
          <p className="text-center text-[12.5px] text-muted">
            {canActOn(request.status)
              ? 'No tienes permisos para aprobar solicitudes.'
              : 'Esta solicitud ya fue procesada.'}
          </p>
        </div>
      )}
    </div>
  );
}

function canActOn(status: string): boolean {
  return ['submitted', 'accepted'].includes(status);
}

function RequestVisual({
  request,
  names,
  userColor,
}: {
  request: RequestDetailRow;
  names: Record<string, string>;
  userColor: string;
}) {
  const requester = names[request.requester_id] ?? request.requester_id.slice(0, 8);

  if (request.request_type === 'swap' && request.shift && request.target_shift) {
    const targetUser = request.target_shift.assigned_user_id
      ? names[request.target_shift.assigned_user_id] ?? '—'
      : 'Sin asignar';
    return (
      <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
        <SwapCard who={requester} shift={request.shift} fallback={userColor} />
        <div
          className="flex h-9 w-9 items-center justify-center self-center rounded-full"
          style={{
            backgroundColor: 'color-mix(in oklab, var(--primary) 14%, transparent)',
            color: 'var(--primary)',
          }}
        >
          <Icons.swap2 size={18} />
        </div>
        <SwapCard
          who={targetUser}
          shift={request.target_shift}
          fallback={request.target_shift.assigned_user_id ? colorForUser(request.target_shift.assigned_user_id) : '#A78BFA'}
        />
      </div>
    );
  }

  if (request.shift) {
    return <SwapCard who={requester} shift={request.shift} fallback={userColor} />;
  }
  return null;
}

function SwapCard({
  who,
  shift,
  fallback,
}: {
  who: string;
  shift: NonNullable<RequestDetailRow['shift']>;
  fallback: string;
}) {
  const ot = Array.isArray(shift.organization_shift_types) ? shift.organization_shift_types[0] : shift.organization_shift_types;
  const letter = ot?.letter ?? '?';
  const name = ot?.name ?? 'Turno';
  // El tipo del modal omite color; usamos fallback para no romper el tipo.
  const color = fallback;
  return (
    <div className="flex-1 rounded-2xl border border-border bg-subtle-2/60 p-3.5">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted">{who}</p>
      <div className="mt-2 flex items-center gap-2.5">
        <ShiftLetter letter={letter} color={color} size={36} />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-text">{formatRangeShort(shift.start_at, shift.end_at)}</p>
          <p className="mt-0.5 truncate text-[11.5px] text-muted">
            {name}
            {shift.location?.trim() ? ` · ${shift.location.trim()}` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

function RequestDetails({ request }: { request: RequestDetailRow; names: Record<string, string> }) {
  const stats: { label: string; value: string; sub?: string; pos?: boolean }[] = [];

  if (request.shift) {
    const dur = durationHours(request.shift.start_at, request.shift.end_at);
    stats.push({ label: 'Duración del turno', value: `${dur}h`, sub: 'Total programado' });
  }

  if (request.request_type === 'swap' && request.shift && request.target_shift) {
    const a = durationHours(request.shift.start_at, request.shift.end_at);
    const b = durationHours(request.target_shift.start_at, request.target_shift.end_at);
    const diff = Math.round((b - a) * 10) / 10;
    stats.push({
      label: 'Diferencia de horas',
      value: diff === 0 ? '0h' : `${diff > 0 ? '+' : ''}${diff}h`,
      sub: diff === 0 ? 'Misma duración' : 'Distintas duraciones',
      pos: diff === 0,
    });

    const aType = Array.isArray(request.shift.organization_shift_types)
      ? request.shift.organization_shift_types[0]?.name
      : request.shift.organization_shift_types?.name;
    const bType = Array.isArray(request.target_shift.organization_shift_types)
      ? request.target_shift.organization_shift_types[0]?.name
      : request.target_shift.organization_shift_types?.name;
    if (aType && bType) {
      const compatible = aType === bType;
      stats.push({
        label: 'Tipos de turno',
        value: `${aType} ↔ ${bType}`,
        sub: compatible ? 'Compatibles' : 'Distintos',
        pos: compatible,
      });
    }
  }

  if (request.request_type === 'give_away' && request.shift?.assigned_user_id) {
    stats.push({ label: 'Estado de reemplazo', value: request.suggested_replacement_user_id ? 'Sugerido' : 'Pendiente', sub: '' });
  }

  if (request.request_type === 'take_open') {
    stats.push({ label: 'Disponibilidad', value: 'Abierto', sub: 'Sin asignar', pos: true });
  }

  if (stats.length === 0) return null;

  return (
    <div>
      <h3 className="tn-h mb-2.5 text-[12px] font-bold uppercase tracking-[0.06em] text-muted">Detalles</h3>
      <div className="grid gap-2.5 md:grid-cols-2">
        {stats.map((s, i) => (
          <StatCard key={i} {...s} />
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, pos }: { label: string; value: string; sub?: string; pos?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-subtle-2/40 p-3.5">
      <p className="text-[11px] font-semibold text-muted">{label}</p>
      <p className="tn-h mt-1 text-[18px] font-bold tracking-[-0.015em] text-text">{value}</p>
      {sub ? (
        <p className={cn('mt-0.5 flex items-center gap-1 text-[11.5px]', pos ? 'text-green' : 'text-muted')}>
          {pos ? <Icons.check size={11} stroke={3 as unknown as number} /> : null}
          {sub}
        </p>
      ) : null}
    </div>
  );
}

function RequestTimeline({ request, names }: { request: RequestDetailRow; names: Record<string, string> }) {
  const requester = names[request.requester_id] ?? request.requester_id.slice(0, 8);
  type Event = { icon: React.ReactNode; color: string; text: string; date: string };
  const events: Event[] = [
    {
      icon: <Icons.send size={12} />,
      color: 'var(--muted)',
      text: `${requester} envió la solicitud`,
      date: formatLongDateTime(request.created_at),
    },
  ];
  if (request.status === 'accepted') {
    const target = request.target_user_id ? names[request.target_user_id] : null;
    events.push({
      icon: <Icons.check size={12} stroke={3 as unknown as number} />,
      color: 'var(--green)',
      text: target ? `${target} aceptó la solicitud` : 'La contraparte aceptó',
      date: 'pendiente',
    });
    events.push({
      icon: <Icons.clock size={12} />,
      color: 'var(--amber)',
      text: 'Esperando aprobación de manager',
      date: 'pendiente',
    });
  } else if (request.status === 'approved') {
    events.push({
      icon: <Icons.check size={12} stroke={3 as unknown as number} />,
      color: 'var(--green)',
      text: 'Manager aprobó la solicitud',
      date: '—',
    });
  } else if (request.status === 'rejected') {
    events.push({
      icon: <Icons.x size={12} />,
      color: 'var(--red)',
      text: 'Manager rechazó la solicitud',
      date: '—',
    });
  } else if (request.status === 'submitted') {
    events.push({
      icon: <Icons.clock size={12} />,
      color: 'var(--amber)',
      text: 'Esperando aprobación',
      date: 'pendiente',
    });
  } else if (request.status === 'cancelled') {
    events.push({
      icon: <Icons.x size={12} />,
      color: 'var(--muted)',
      text: 'Solicitud cancelada',
      date: '—',
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {events.map((e, i) => (
        <div key={i} className="flex items-center gap-3 text-[13px]">
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `color-mix(in oklab, ${e.color} 22%, transparent)`, color: e.color }}
          >
            {e.icon}
          </span>
          <span className="flex-1 text-text">{e.text}</span>
          <span className="text-[11.5px] text-muted">{e.date}</span>
        </div>
      ))}
    </div>
  );
}
