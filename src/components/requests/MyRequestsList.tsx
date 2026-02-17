'use client';

/**
 * Lista de solicitudes del usuario (requester). Cancelar si está en draft/submitted/accepted.
 * @see project-roadmap.md Módulo 4.1 — /dashboard/staff/my-requests
 */

import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { createClient } from '@/lib/supabase/client';
import { fetchProfilesMap } from '@/lib/supabase/queries';
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';

const REQUEST_TYPE_LABEL: Record<string, string> = {
  give_away: 'Dar de baja',
  swap: 'Intercambiar',
  take_open: 'Tomar turno abierto',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  submitted: 'Enviada',
  accepted: 'Aceptada (pend. aprob.)',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
};

type ShiftEmbed = {
  start_at: string;
  end_at: string;
  assigned_user_id: string | null;
  organization_shift_types: { name: string; letter: string } | { name: string; letter: string }[] | null;
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

type Tab = 'all' | 'pending' | 'approved';

function formatRange(start: string, end: string): string {
  const d1 = new Date(start);
  const d2 = new Date(end);
  return `${d1.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })} ${d1.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} – ${d2.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return 'Ahora';
  if (diff < 3600_000) return `Hace ${Math.floor(diff / 60_000)} min`;
  if (diff < 86400_000) return `Hace ${Math.floor(diff / 3600_000)} h`;
  return `Hace ${Math.floor(diff / 86400_000)} d`;
}

function getTypeLetter(ot: ShiftEmbed['organization_shift_types']): string {
  if (!ot) return '?';
  const o = Array.isArray(ot) ? ot[0] : ot;
  return o?.letter ?? '?';
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
         shift:shifts!shift_id(start_at, end_at, assigned_user_id, organization_shift_types(name, letter)),
         target_shift:shifts!target_shift_id(start_at, end_at, assigned_user_id, organization_shift_types(name, letter))`
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
    const names =
      userIds.size > 0
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
  const isPending = (s: string) => ['draft', 'submitted', 'accepted'].includes(s);

  if (!orgId || !userId) {
    return (
      <div className="rounded-xl border border-border bg-background p-6">
        <p className="text-sm text-muted">Inicia sesión y asegúrate de tener una organización asignada.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-background p-6">
        <p className="text-sm text-muted">Cargando solicitudes…</p>
      </div>
    );
  }

  const filteredRows =
    tab === 'pending'
      ? rows.filter((r) => isPending(r.status))
      : tab === 'approved'
        ? rows.filter((r) => r.status === 'approved')
        : rows;

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      {/* Tabs siempre visibles para poder cambiar de filtro */}
      <div className="flex items-center gap-2 overflow-x-auto rounded-xl border border-border bg-background p-2">
        <TabButton active={tab === 'all'} onClick={() => setTab('all')}>
          Todas
        </TabButton>
        <TabButton active={tab === 'pending'} onClick={() => setTab('pending')}>
          Pendientes
        </TabButton>
        <TabButton active={tab === 'approved'} onClick={() => setTab('approved')}>
          Aprobadas
        </TabButton>
      </div>

      {filteredRows.length === 0 ? (
        <div className="rounded-xl border border-border bg-background p-6">
          <p className="text-sm text-muted">
            {tab === 'all' ? 'No tienes solicitudes.' : tab === 'pending' ? 'No tienes solicitudes pendientes.' : 'No tienes solicitudes aprobadas.'}
          </p>
          <p className="mt-1 text-sm text-muted">
            Puedes crear solicitudes desde el calendario: clic en un turno → Solicitar cambio.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {filteredRows.map((r) => {
              const shift = r.shift;
              const letter = shift ? getTypeLetter(shift.organization_shift_types) : '?';
              const range = shift ? formatRange(shift.start_at, shift.end_at) : '—';
              const assignedName = shift?.assigned_user_id ? (names[shift.assigned_user_id] ?? '—') : 'Sin asignar';
              const title =
                r.request_type === 'swap'
                  ? `Intercambio${r.target_user_id ? ` con ${names[r.target_user_id] ?? 'otro miembro'}` : ''}`
                  : r.request_type === 'give_away'
                    ? 'Ceder turno'
                    : 'Tomar turno abierto';

              const statusColor =
                r.status === 'approved'
                  ? 'text-green-600'
                  : r.status === 'rejected' || r.status === 'cancelled'
                    ? 'text-gray-600'
                    : 'text-amber-600';

              const typeBadgeClass =
                r.request_type === 'swap'
                  ? 'bg-amber-500'
                  : r.request_type === 'give_away'
                    ? 'bg-green-600'
                    : 'bg-primary-600';

              return (
                <div key={r.id} className="rounded-2xl border border-border bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`inline-flex h-6 items-center rounded-md px-2 text-xs font-semibold text-white ${typeBadgeClass}`}>
                      {REQUEST_TYPE_LABEL[r.request_type] ?? r.request_type}
                    </span>
                    <span className={`text-xs font-medium ${statusColor}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
                  </div>

                  <div className="mt-3 space-y-1">
                    <p className="text-sm font-medium text-text-primary">{title}</p>
                    <p className="text-sm text-text-secondary">
                      <span className="font-semibold text-text-primary">{letter}</span> {range}
                      {r.request_type !== 'take_open' ? ` — ${assignedName}` : null}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-muted">{formatRelative(r.created_at)}</p>
                    {canCancel(r.status) ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setCancelId(r.id)}
                        className="border-red-200 text-red-600 hover:bg-red-50"
                      >
                        Cancelar
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table (mantiene funcionalidad actual) */}
          <div className="hidden overflow-hidden rounded-xl border border-border bg-background md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-subtle-bg">
                    <th className="px-4 py-3 text-left font-medium text-text-primary">Tipo</th>
                    <th className="px-4 py-3 text-left font-medium text-text-primary">Turno</th>
                    <th className="px-4 py-3 text-left font-medium text-text-primary">Estado</th>
                    <th className="px-4 py-3 text-left font-medium text-text-primary">Fecha solicitud</th>
                    <th className="px-4 py-3 text-right font-medium text-text-primary">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => {
                    const shift = r.shift;
                    const letter = shift ? getTypeLetter(shift.organization_shift_types) : '?';
                    const range = shift ? formatRange(shift.start_at, shift.end_at) : '—';
                    const assignedName = shift?.assigned_user_id ? (names[shift.assigned_user_id] ?? '—') : 'Sin asignar';
                    const targetInfo =
                      r.request_type === 'swap' && r.target_shift
                        ? ` ↔ ${getTypeLetter(r.target_shift.organization_shift_types)} ${formatRange(r.target_shift.start_at, r.target_shift.end_at)} (${r.target_shift.assigned_user_id ? names[r.target_shift.assigned_user_id] ?? '—' : '?'})`
                        : '';

                    return (
                      <tr key={r.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-text-primary">
                          {REQUEST_TYPE_LABEL[r.request_type] ?? r.request_type}
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          <span className="font-medium text-text-primary">{letter}</span> {range}
                          {r.request_type !== 'take_open' && ` — ${assignedName}`}
                          {targetInfo}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${r.status === 'approved'
                              ? 'bg-green-100 text-green-800'
                              : r.status === 'rejected' || r.status === 'cancelled'
                                ? 'bg-gray-100 text-gray-700'
                                : 'bg-amber-100 text-amber-800'
                              }`}
                          >
                            {STATUS_LABEL[r.status] ?? r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {new Date(r.created_at).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canCancel(r.status) && (
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => setCancelId(r.id)}
                              className="border-red-200 px-3 text-red-600 hover:bg-red-50"
                            >
                              Cancelar solicitud
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[36px] shrink-0 rounded-lg px-3 text-sm font-medium transition-colors ${active ? 'bg-primary-50 text-primary-700' : 'text-text-secondary hover:bg-subtle-bg'
        }`}
    >
      {children}
    </button>
  );
}
