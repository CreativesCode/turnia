'use client';

/**
 * Bandeja de solicitudes para Manager: listar, filtrar y abrir detalle para aprobar/rechazar.
 * @see project-roadmap.md Módulo 4.2
 */

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { RequestDetailModal, type RequestDetailRow } from '@/components/requests/RequestDetailModal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/toast/ToastProvider';

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

type Filters = {
  requestType: string;
  status: string;
};

type Props = {
  orgId: string | null;
  canApprove: boolean;
  refreshKey?: number;
};

function formatRange(start: string, end: string): string {
  const d1 = new Date(start);
  const d2 = new Date(end);
  return `${d1.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} ${d1.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} – ${d2.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
}

function getTypeLetter(ot: { name: string; letter: string } | { name: string; letter: string }[] | null): string {
  if (!ot) return '?';
  const o = Array.isArray(ot) ? ot[0] : ot;
  return o?.letter ?? '?';
}

export function RequestsInbox({ orgId, canApprove, refreshKey = 0 }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<RequestDetailRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ requestType: '', status: 'submitted,accepted' });
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [detail, setDetail] = useState<RequestDetailRow | null>(null);
  const searchParams = useSearchParams();
  const openRequestId = searchParams?.get('request') ?? null;

  const load = useCallback(async () => {
    if (!orgId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();

    let q = supabase
      .from('shift_requests')
      .select(
        `id, request_type, status, comment, created_at, shift_id, target_shift_id, target_user_id, requester_id, suggested_replacement_user_id,
         shift:shifts!shift_id(start_at, end_at, assigned_user_id, organization_shift_types(name, letter)),
         target_shift:shifts!target_shift_id(start_at, end_at, assigned_user_id, organization_shift_types(name, letter))`
      )
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (filters.requestType) q = q.eq('request_type', filters.requestType);
    if (filters.status) {
      const statuses = filters.status.split(',').map((s) => s.trim()).filter(Boolean);
      if (statuses.length > 0) q = q.in('status', statuses);
    }

    const { data, error: err } = await q;

    if (err) {
      setError(err.message);
      toast({ variant: 'error', title: 'No se pudieron cargar solicitudes', message: err.message });
      setRows([]);
      setLoading(false);
      return;
    }

    const list = ((data ?? []) as unknown) as RequestDetailRow[];
    setRows(list);

    const userIds = new Set<string>();
    list.forEach((r) => {
      userIds.add(r.requester_id);
      if (r.shift?.assigned_user_id) userIds.add(r.shift.assigned_user_id);
      if (r.target_shift?.assigned_user_id) userIds.add(r.target_shift.assigned_user_id);
      if (r.target_user_id) userIds.add(r.target_user_id);
      if (r.suggested_replacement_user_id) userIds.add(r.suggested_replacement_user_id);
    });
    if (userIds.size > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', Array.from(userIds));
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: { id: string; full_name: string | null }) => {
        map[p.id] = p.full_name?.trim() || p.id.slice(0, 8);
      });
      setNames(map);
    } else {
      setNames({});
    }
    setLoading(false);
  }, [orgId, filters.requestType, filters.status, toast]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // Abrir detalle si viene ?request=id (p. ej. desde una notificación)
  useEffect(() => {
    if (openRequestId && rows.length > 0) {
      const r = rows.find((row) => row.id === openRequestId);
      if (r) setDetail(r);
    }
  }, [openRequestId, rows]);

  if (!orgId) {
    return (
      <div className="rounded-xl border border-border bg-background p-6">
        <p className="text-sm text-muted">Selecciona una organización.</p>
      </div>
    );
  }

  const hasActive = filters.requestType !== '' || filters.status !== 'submitted,accepted';
  const activeCount = [filters.requestType !== '', filters.status !== 'submitted,accepted'].filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-background">
        <button
          type="button"
          onClick={() => setFiltersVisible((v) => !v)}
          className="flex min-h-[44px] w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-text-secondary hover:bg-subtle-bg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-inset"
          aria-expanded={filtersVisible}
          aria-controls="requests-inbox-filters-panel"
        >
          <span className="flex items-center gap-2">
            {filtersVisible ? 'Ocultar filtros' : 'Filtros'}
            {!filtersVisible && hasActive && (
              <span className="rounded-full bg-primary-100 px-1.5 py-0.5 text-xs font-semibold text-primary-700">
                {activeCount}
              </span>
            )}
          </span>
          {filtersVisible ? <ChevronUp /> : <ChevronDown />}
        </button>
        {filtersVisible && (
          <div
            id="requests-inbox-filters-panel"
            className="flex flex-wrap items-center gap-4 border-t border-border p-3"
          >
            <label className="flex min-h-[44px] items-center gap-2 text-sm text-text-secondary">
              Tipo
              <Select
                value={filters.requestType}
                onChange={(e) => setFilters((f) => ({ ...f, requestType: e.target.value }))}
              >
                <option value="">Todos</option>
                <option value="give_away">{REQUEST_TYPE_LABEL.give_away}</option>
                <option value="swap">{REQUEST_TYPE_LABEL.swap}</option>
                <option value="take_open">{REQUEST_TYPE_LABEL.take_open}</option>
              </Select>
            </label>
            <label className="flex min-h-[44px] items-center gap-2 text-sm text-text-secondary">
              Estado
              <Select
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="submitted,accepted">Pendientes (enviada, aceptada)</option>
                <option value="approved">Aprobadas</option>
                <option value="rejected">Rechazadas</option>
                <option value="cancelled">Canceladas</option>
                <option value="">Todos</option>
              </Select>
            </label>
          </div>
        )}
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <div className="rounded-xl border border-border bg-background p-6">
          <p className="text-sm text-muted">Cargando solicitudes…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-background p-6">
          <p className="text-sm text-muted">No hay solicitudes con los filtros seleccionados.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-background overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-subtle-bg">
                  <th className="px-4 py-3 text-left font-medium text-text-primary">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium text-text-primary">Solicitante</th>
                  <th className="px-4 py-3 text-left font-medium text-text-primary">Turno</th>
                  <th className="px-4 py-3 text-left font-medium text-text-primary">Estado</th>
                  <th className="px-4 py-3 text-left font-medium text-text-primary">Fecha</th>
                  <th className="px-4 py-3 text-right font-medium text-text-primary">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const shift = r.shift;
                  const letter = shift ? getTypeLetter(shift.organization_shift_types) : '?';
                  const range = shift ? formatRange(shift.start_at, shift.end_at) : '—';
                  const assignedName = shift?.assigned_user_id ? (names[shift.assigned_user_id] ?? '—') : 'Sin asignar';
                  const requesterName = names[r.requester_id] ?? r.requester_id.slice(0, 8);
                  const targetInfo =
                    r.request_type === 'swap' && r.target_shift
                      ? ` ↔ ${getTypeLetter(r.target_shift.organization_shift_types)} (${r.target_shift.assigned_user_id ? names[r.target_shift.assigned_user_id] ?? '—' : '?'})`
                      : '';
                  const canAct = canApprove && ['submitted', 'accepted'].includes(r.status);

                  return (
                    <tr
                      key={r.id}
                      className="border-b border-border last:border-0 hover:bg-subtle-bg/50"
                    >
                      <td className="px-4 py-3 text-text-primary">{REQUEST_TYPE_LABEL[r.request_type] ?? r.request_type}</td>
                      <td className="px-4 py-3 text-text-primary">{requesterName}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        <span className="font-medium text-text-primary">{letter}</span> {range}
                        {r.request_type !== 'take_open' && ` — ${assignedName}`}
                        {targetInfo}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.status === 'approved' ? 'bg-green-100 text-green-800' : r.status === 'rejected' || r.status === 'cancelled' ? 'bg-gray-100 text-gray-700' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {new Date(r.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
      )}

      <RequestDetailModal
        open={!!detail}
        onClose={() => setDetail(null)}
        onResolved={() => { setDetail(null); load(); }}
        request={detail}
        names={names}
      />
    </div>
  );
}
