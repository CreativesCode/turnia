'use client';

/**
 * Bandeja de solicitudes de permiso para Manager: listar, filtrar y aprobar/rechazar.
 */

import {
  PermissionRequestDetailModal,
  type PermissionRequestRow,
} from '@/components/permissions/PermissionRequestDetailModal';
import { PERMISSION_REQUEST_TYPE_OPTIONS } from '@/components/permissions/PermissionRequestModal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { createClient } from '@/lib/supabase/client';
import { fetchProfilesMap } from '@/lib/supabase/queries';
import useSWR from 'swr';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

function ChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
function ChevronUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
      <path d="M18 15l-6-6-6 6" />
    </svg>
  );
}

const PERMISSION_SCOPE_LABEL: Record<string, string> = {
  days: 'Por unos o varios días',
  fraction_shift: 'Fraccionar turno',
};

const REQUEST_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  PERMISSION_REQUEST_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
};

type Filters = { requestType: string; status: string };

type Props = {
  orgId: string | null;
  canApprove: boolean;
  refreshKey?: number;
};

function formatDateRange(start: string, end: string): string {
  const d1 = new Date(start);
  const d2 = new Date(end);
  return `${d1.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} – ${d2.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}`;
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

export function PermissionRequestsInbox({ orgId, canApprove, refreshKey = 0 }: Props) {
  const { toast } = useToast();
  const [filters, setFilters] = useState<Filters>({ requestType: '', status: 'submitted' });
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [detail, setDetail] = useState<PermissionRequestRow | null>(null);
  const lastToastErrorRef = useRef<string | null>(null);

  const swrKey = useMemo(() => {
    if (!orgId) return null;
    return ['permissionRequestsInbox', orgId, filters.requestType, filters.status] as const;
  }, [orgId, filters.requestType, filters.status]);

  const fetcher = useCallback(async (): Promise<{ rows: PermissionRequestRow[]; names: Record<string, string> }> => {
    if (!orgId) return { rows: [], names: {} };
    const supabase = createClient();

    let q = supabase
      .from('permission_requests')
      .select('id, org_id, requester_id, permission_scope_type, request_type, start_at, end_at, reason, status, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (filters.requestType) q = q.eq('request_type', filters.requestType);
    if (filters.status) {
      const statuses = filters.status.split(',').map((s) => s.trim()).filter(Boolean);
      if (statuses.length > 0) q = q.in('status', statuses);
    }

    const { data, error: err } = await q;
    if (err) throw new Error(err.message);

    const rows = ((data ?? []) as unknown) as PermissionRequestRow[];
    const userIds = new Set<string>(rows.map((r) => r.requester_id));
    const names =
      userIds.size > 0
        ? await fetchProfilesMap(supabase, Array.from(userIds), { fallbackName: (id) => id.slice(0, 8) })
        : {};
    return { rows, names };
  }, [orgId, filters.requestType, filters.status]);

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

  useEffect(() => {
    if (!error) return;
    if (lastToastErrorRef.current === error) return;
    lastToastErrorRef.current = error;
    toast({ variant: 'error', title: 'No se pudieron cargar solicitudes de permiso', message: error });
  }, [error, toast]);

  if (!orgId) {
    return (
      <div className="rounded-xl border border-border bg-background p-6">
        <p className="text-sm text-muted">Selecciona una organización.</p>
      </div>
    );
  }

  const canActOn = (s: string) => canApprove && s === 'submitted';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 overflow-x-auto rounded-xl border border-border bg-background p-2">
        <button
          type="button"
          onClick={() => setFilters((f) => ({ ...f, status: 'submitted' }))}
          className={`min-h-[36px] shrink-0 rounded-lg px-3 text-sm font-medium transition-colors ${filters.status === 'submitted' ? 'bg-primary-50 text-primary-700' : 'text-text-secondary hover:bg-subtle-bg'}`}
        >
          Pendientes
        </button>
        <button
          type="button"
          onClick={() => setFilters((f) => ({ ...f, status: 'approved' }))}
          className={`min-h-[36px] shrink-0 rounded-lg px-3 text-sm font-medium transition-colors ${filters.status === 'approved' ? 'bg-primary-50 text-primary-700' : 'text-text-secondary hover:bg-subtle-bg'}`}
        >
          Aprobadas
        </button>
        <button
          type="button"
          onClick={() => setFilters((f) => ({ ...f, status: 'rejected' }))}
          className={`min-h-[36px] shrink-0 rounded-lg px-3 text-sm font-medium transition-colors ${filters.status === 'rejected' ? 'bg-primary-50 text-primary-700' : 'text-text-secondary hover:bg-subtle-bg'}`}
        >
          Rechazadas
        </button>
      </div>

      <div className="rounded-lg border border-border bg-background">
        <button
          type="button"
          onClick={() => setFiltersVisible((v) => !v)}
          className="flex min-h-[44px] w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-text-secondary hover:bg-subtle-bg focus:outline-none"
          aria-expanded={filtersVisible}
          aria-controls="permission-inbox-filters"
        >
          <span>{filtersVisible ? 'Ocultar filtros' : 'Filtros'}</span>
          {filtersVisible ? <ChevronUp /> : <ChevronDown />}
        </button>
        {filtersVisible && (
          <div id="permission-inbox-filters" className="flex flex-wrap items-center gap-4 border-t border-border p-3">
            <label className="flex min-h-[44px] items-center gap-2 text-sm text-text-secondary">
              Tipo de solicitud
              <Select
                value={filters.requestType}
                onChange={(e) => setFilters((f) => ({ ...f, requestType: e.target.value }))}
              >
                <option value="">Todos</option>
                {PERMISSION_REQUEST_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        )}
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <div className="rounded-xl border border-border bg-background p-6">
          <p className="text-sm text-muted">Cargando solicitudes de permiso…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-background p-6">
          <p className="text-sm text-muted">No hay solicitudes de permiso con los filtros seleccionados.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {rows.map((r) => {
              const requesterName = names[r.requester_id] ?? r.requester_id.slice(0, 8);
              const typeLabel = REQUEST_TYPE_LABEL[r.request_type] ?? r.request_type;
              const dateRange = formatDateRange(r.start_at, r.end_at);
              return (
                <div key={r.id} className="rounded-2xl border border-border bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex h-6 items-center rounded-md bg-primary-100 px-2 text-xs font-semibold text-primary-800">
                      {typeLabel}
                    </span>
                    <span className="text-xs text-muted">{formatRelative(r.created_at)}</span>
                  </div>
                  <p className="mt-2 text-sm text-text-primary">{requesterName}</p>
                  <p className="mt-1 text-sm text-muted">{dateRange}</p>
                  <div className="mt-3 flex items-center justify-end">
                    <Button type="button" variant="secondary" size="sm" onClick={() => setDetail(r)}>
                      {canActOn(r.status) ? 'Ver / Aprobar' : 'Ver'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-border bg-background md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-subtle-bg">
                    <th className="px-4 py-3 text-left font-medium text-text-primary">Tipo</th>
                    <th className="px-4 py-3 text-left font-medium text-text-primary">Solicitante</th>
                    <th className="px-4 py-3 text-left font-medium text-text-primary">Rango fechas</th>
                    <th className="px-4 py-3 text-left font-medium text-text-primary">Estado</th>
                    <th className="px-4 py-3 text-left font-medium text-text-primary">Fecha solicitud</th>
                    <th className="px-4 py-3 text-right font-medium text-text-primary">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const requesterName = names[r.requester_id] ?? r.requester_id.slice(0, 8);
                    const typeLabel = REQUEST_TYPE_LABEL[r.request_type] ?? r.request_type;
                    const dateRange = formatDateRange(r.start_at, r.end_at);
                    const canAct = canActOn(r.status);
                    return (
                      <tr key={r.id} className="border-b border-border last:border-0 hover:bg-subtle-bg/50">
                        <td className="px-4 py-3 text-text-primary">{typeLabel}</td>
                        <td className="px-4 py-3 text-text-primary">{requesterName}</td>
                        <td className="px-4 py-3 text-text-secondary">{dateRange}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              r.status === 'approved'
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
                          <Button type="button" variant="secondary" size="sm" onClick={() => setDetail(r)}>
                            {canAct ? 'Ver / Aprobar' : 'Ver'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <PermissionRequestDetailModal
        open={!!detail}
        onClose={() => setDetail(null)}
        onResolved={() => {
          setDetail(null);
          void mutate();
        }}
        request={detail}
        names={names}
        canApprove={canApprove}
      />
    </div>
  );
}
