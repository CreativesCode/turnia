'use client';

/**
 * Lista de solicitudes del usuario (requester) con tabs Pills + lista de cards
 * (icono cuadrado coloreado por estado + título + meta + Pill estado).
 * Diseño: ref docs/design/screens/mobile.jsx MMyRequests timeline list (línea 628).
 */

import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Icons } from '@/components/ui/icons';
import { Pill, type PillTone } from '@/components/ui/Pill';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { cn } from '@/lib/cn';
import { createClient } from '@/lib/supabase/client';
import { fetchProfilesMap } from '@/lib/supabase/queries';
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  submitted: 'Pendiente',
  accepted: 'Aceptada',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
};

type ShiftEmbed = {
  start_at: string;
  end_at: string;
  assigned_user_id: string | null;
  organization_shift_types: { name: string; letter: string; color?: string } | { name: string; letter: string; color?: string }[] | null;
};

type Row = {
  id: string;
  request_type: string;
  status: string;
  comment: string | null;
  created_at: string;
  shift_id: string;
  target_shift_id: string | null;
  target_user_id: string | null;
  shift: ShiftEmbed | null;
  target_shift: ShiftEmbed | null;
};

type Props = {
  orgId: string | null;
  userId: string | null;
  refreshKey?: number;
};

type Tab = 'all' | 'pending' | 'accepted' | 'rejected';

function formatRangeShort(start: string, end: string): string {
  const d1 = new Date(start);
  const d2 = new Date(end);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return '—';
  const day = d1.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
  const t1 = d1.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const t2 = d2.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `${capitalize(day)} · ${t1}–${t2}`;
}

function shortDate(start: string): string {
  const d = new Date(start);
  if (isNaN(d.getTime())) return '—';
  return capitalize(d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' }));
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function statusToTone(status: string): PillTone {
  if (status === 'approved' || status === 'accepted') return 'green';
  if (status === 'rejected') return 'red';
  if (status === 'cancelled') return 'muted';
  return 'amber';
}

function statusToColorVar(status: string): string {
  if (status === 'approved' || status === 'accepted') return 'var(--green)';
  if (status === 'rejected') return 'var(--red)';
  if (status === 'cancelled') return 'var(--muted)';
  return 'var(--amber)';
}

function classifyTab(status: string): Tab[] {
  if (['draft', 'submitted'].includes(status)) return ['all', 'pending'];
  if (status === 'accepted') return ['all', 'accepted'];
  if (status === 'approved') return ['all', 'accepted'];
  if (status === 'rejected') return ['all', 'rejected'];
  if (status === 'cancelled') return ['all', 'rejected'];
  return ['all'];
}

export function MyRequestsList({ orgId, userId, refreshKey = 0 }: Props) {
  const { toast } = useToast();
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('all');

  const swrKey = useMemo(() => {
    if (!orgId || !userId) return null;
    return ['myRequests', orgId, userId] as const;
  }, [orgId, userId]);

  const fetcher = useCallback(async (): Promise<{ rows: Row[]; names: Record<string, string> }> => {
    if (!orgId || !userId) return { rows: [], names: {} };
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from('shift_requests')
      .select(
        `id, request_type, status, comment, created_at, shift_id, target_shift_id, target_user_id,
         shift:shifts!shift_id(start_at, end_at, assigned_user_id, organization_shift_types(name, letter, color)),
         target_shift:shifts!target_shift_id(start_at, end_at, assigned_user_id, organization_shift_types(name, letter, color))`
      )
      .eq('org_id', orgId)
      .eq('requester_id', userId)
      .order('created_at', { ascending: false });

    if (err) throw new Error(err.message);

    const rows = ((data ?? []) as unknown) as Row[];
    const userIds = new Set<string>();
    rows.forEach((r) => {
      if (r.shift?.assigned_user_id) userIds.add(r.shift.assigned_user_id);
      if (r.target_shift?.assigned_user_id) userIds.add(r.target_shift.assigned_user_id);
      if (r.target_user_id) userIds.add(r.target_user_id);
    });
    const names = userIds.size > 0
      ? await fetchProfilesMap(supabase, Array.from(userIds), { fallbackName: (id) => id.slice(0, 8) })
      : {};
    return { rows, names };
  }, [orgId, userId]);

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
  const loading = isLoading || (isValidating && !swrData);
  const error = swrError ? String((swrError as Error).message ?? swrError) : null;

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: rows.length, pending: 0, accepted: 0, rejected: 0 };
    for (const r of rows) {
      for (const t of classifyTab(r.status)) {
        if (t !== 'all') c[t] += 1;
      }
    }
    return c;
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (tab === 'all') return rows;
    return rows.filter((r) => classifyTab(r.status).includes(tab));
  }, [rows, tab]);

  const handleCancel = useCallback(async () => {
    if (!cancelId) return;
    setCancelLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase
      .from('shift_requests')
      .update({ status: 'cancelled' })
      .eq('id', cancelId);
    setCancelLoading(false);
    setCancelId(null);
    if (err) {
      toast({ variant: 'error', title: 'No se pudo cancelar', message: err.message });
      return;
    }
    toast({ variant: 'success', title: 'Solicitud cancelada', message: 'La solicitud fue cancelada.' });
    void mutate();
  }, [cancelId, toast, mutate]);

  const canCancel = (s: string) => ['draft', 'submitted', 'accepted'].includes(s);

  if (!orgId || !userId) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6">
        <p className="text-sm text-muted">Inicia sesión y asegúrate de tener una organización asignada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="tn-h text-[12px] font-bold uppercase tracking-[0.06em] text-muted">Mis solicitudes</p>

      <TabsBar tab={tab} counts={counts} onChange={setTab} />

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : null}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : filteredRows.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <div className="space-y-2">
          {filteredRows.map((r) => (
            <RequestRow
              key={r.id}
              row={r}
              names={names}
              canCancel={canCancel(r.status)}
              onCancel={() => setCancelId(r.id)}
            />
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!cancelId}
        onClose={() => setCancelId(null)}
        onConfirm={handleCancel}
        title="Cancelar solicitud"
        message="¿Seguro que quieres cancelar esta solicitud? No podrás deshacerlo."
        confirmLabel="Sí, cancelar"
        variant="danger"
        loading={cancelLoading}
      />
    </div>
  );
}

function TabsBar({
  tab,
  counts,
  onChange,
}: {
  tab: Tab;
  counts: Record<Tab, number>;
  onChange: (t: Tab) => void;
}) {
  const items: { key: Tab; label: string }[] = [
    { key: 'all', label: 'Todas' },
    { key: 'pending', label: 'Pendientes' },
    { key: 'accepted', label: 'Aceptadas' },
    { key: 'rejected', label: 'Rechazadas' },
  ];
  return (
    <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1">
      {items.map((it) => {
        const active = tab === it.key;
        const n = counts[it.key];
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            aria-pressed={active}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold whitespace-nowrap transition-colors',
              active
                ? 'bg-text text-bg'
                : 'bg-subtle-2 text-text-sec hover:text-text'
            )}
          >
            {it.label}
            {n > 0 ? (
              <span className={cn('text-[10.5px] font-bold', active ? 'opacity-80' : 'text-muted')}>
                · {n}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  const copy = tab === 'pending'
    ? 'No tienes solicitudes pendientes.'
    : tab === 'accepted'
      ? 'Aún no tienes solicitudes aceptadas o aprobadas.'
      : tab === 'rejected'
        ? 'Sin solicitudes rechazadas o canceladas.'
        : 'No tienes solicitudes.';
  return (
    <div className="rounded-2xl border border-border bg-surface px-5 py-12 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-subtle-2 text-muted">
        <Icons.swap size={18} />
      </div>
      <p className="tn-h text-[15px] font-bold text-text">Sin solicitudes</p>
      <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted">{copy}</p>
      <p className="mx-auto mt-2 max-w-sm text-[11.5px] text-muted">
        Para crear una nueva, abre un turno desde el calendario y elige “Solicitar cambio”.
      </p>
    </div>
  );
}

function RequestRow({
  row,
  names,
  canCancel,
  onCancel,
}: {
  row: Row;
  names: Record<string, string>;
  canCancel: boolean;
  onCancel: () => void;
}) {
  const TypeIcon = row.request_type === 'swap'
    ? Icons.swap
    : row.request_type === 'give_away'
      ? Icons.giveaway
      : Icons.takeOpen;
  const statusColor = statusToColorVar(row.status);
  const statusTone = statusToTone(row.status);

  const title = useMemo(() => {
    if (row.request_type === 'swap') {
      const target = row.target_user_id ? names[row.target_user_id] : null;
      return target ? `Intercambio con ${target}` : 'Intercambio de turno';
    }
    if (row.request_type === 'give_away') return 'Ceder turno';
    return 'Tomar turno abierto';
  }, [row.request_type, row.target_user_id, names]);

  const sub = useMemo(() => {
    if (row.request_type === 'swap' && row.shift && row.target_shift) {
      return `${shortDate(row.shift.start_at)} ⇄ ${shortDate(row.target_shift.start_at)}`;
    }
    if (row.shift) return formatRangeShort(row.shift.start_at, row.shift.end_at);
    return '—';
  }, [row.request_type, row.shift, row.target_shift]);

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{
          backgroundColor: `color-mix(in oklab, ${statusColor} 18%, transparent)`,
          color: statusColor,
        }}
      >
        <TypeIcon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold text-text">{title}</p>
        <p className="mt-0.5 truncate text-[11.5px] text-muted">{sub}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <Pill tone={statusTone} dot>
          {STATUS_LABEL[row.status] ?? row.status}
        </Pill>
        {canCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-[10.5px] font-semibold text-red hover:underline"
          >
            Cancelar
          </button>
        ) : null}
      </div>
    </div>
  );
}
