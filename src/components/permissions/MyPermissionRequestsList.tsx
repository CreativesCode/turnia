'use client';

/**
 * Lista de solicitudes de permiso del usuario. Puede cancelar si está submitted.
 */

import { PERMISSION_REQUEST_TYPE_OPTIONS } from '@/components/permissions/PermissionRequestModal';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';

const REQUEST_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  PERMISSION_REQUEST_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
};

type Row = {
  id: string;
  org_id: string;
  requester_id: string;
  permission_scope_type: string;
  request_type: string;
  start_at: string;
  end_at: string;
  reason: string | null;
  status: string;
  created_at: string;
};

type Props = {
  orgId: string | null;
  userId: string | null;
  refreshKey?: number;
};

function formatDateRange(start: string, end: string): string {
  const d1 = new Date(start);
  const d2 = new Date(end);
  return `${d1.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })} – ${d2.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}`;
}

export function MyPermissionRequestsList({ orgId, userId, refreshKey = 0 }: Props) {
  const { toast } = useToast();
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const swrKey = useMemo(() => {
    if (!orgId || !userId) return null;
    return ['myPermissionRequests', orgId, userId] as const;
  }, [orgId, userId]);

  const fetcher = useCallback(async (): Promise<Row[]> => {
    if (!orgId || !userId) return [];
    const supabase = createClient();
    const { data, error } = await supabase
      .from('permission_requests')
      .select('id, org_id, requester_id, permission_scope_type, request_type, start_at, end_at, reason, status, created_at')
      .eq('org_id', orgId)
      .eq('requester_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Row[];
  }, [orgId, userId]);

  const { data: rows = [], error, isLoading, isValidating, mutate } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
  });

  useEffect(() => {
    if (!swrKey) return;
    void mutate();
  }, [refreshKey, mutate, swrKey]);

  const loading = isLoading || (isValidating && rows.length === 0);
  const canCancel = (s: string) => s === 'submitted';

  const handleCancel = useCallback(async () => {
    if (!cancelId) return;
    setCancelLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase
      .from('permission_requests')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', cancelId);
    setCancelLoading(false);
    setCancelId(null);
    if (err) {
      toast({ variant: 'error', title: 'No se pudo cancelar', message: err.message });
      return;
    }
    toast({ variant: 'success', title: 'Solicitud cancelada', message: 'La solicitud de permiso fue cancelada.' });
    void mutate();
  }, [cancelId, toast, mutate]);

  if (!orgId || !userId) return null;
  if (rows.length === 0 && !loading) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-text-primary">Mis solicitudes de permiso</h2>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      {loading ? (
        <p className="text-sm text-muted">Cargando solicitudes de permiso…</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const typeLabel = REQUEST_TYPE_LABEL[r.request_type] ?? r.request_type;
            const dateRange = formatDateRange(r.start_at, r.end_at);
            return (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background p-4"
              >
                <div>
                  <p className="font-medium text-text-primary">{typeLabel}</p>
                  <p className="text-sm text-muted">{dateRange}</p>
                  {r.reason && (
                    <p className="mt-1 text-sm text-text-secondary line-clamp-2">{r.reason}</p>
                  )}
                  <span
                    className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.status === 'approved'
                        ? 'bg-green-100 text-green-800'
                        : r.status === 'rejected' || r.status === 'cancelled'
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>
                {canCancel(r.status) && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setCancelId(r.id)}
                    className="border-red-200 text-red-600 hover:bg-red-50"
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
      <ConfirmModal
        open={!!cancelId}
        onClose={() => setCancelId(null)}
        onConfirm={handleCancel}
        title="Cancelar solicitud de permiso"
        message="¿Cancelar esta solicitud de permiso? No se puede deshacer."
        confirmLabel="Sí, cancelar"
        variant="danger"
        loading={cancelLoading}
      />
    </div>
  );
}
