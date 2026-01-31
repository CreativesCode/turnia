'use client';

/**
 * Lista de solicitudes del usuario (requester). Cancelar si está en draft/submitted/accepted.
 * @see project-roadmap.md Módulo 4.1 — /dashboard/staff/my-requests
 */

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/toast/ToastProvider';

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

function formatRange(start: string, end: string): string {
  const d1 = new Date(start);
  const d2 = new Date(end);
  return `${d1.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })} ${d1.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} – ${d2.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
}

function getTypeLetter(ot: ShiftEmbed['organization_shift_types']): string {
  if (!ot) return '?';
  const o = Array.isArray(ot) ? ot[0] : ot;
  return o?.letter ?? '?';
}

export function MyRequestsList({ orgId, userId, refreshKey = 0 }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const load = useCallback(async () => {
    if (!orgId || !userId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
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

    if (err) {
      setError(err.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const list = ((data ?? []) as unknown) as Row[];
    setRows(list);

    const userIds = new Set<string>();
    list.forEach((r) => {
      if (r.shift?.assigned_user_id) userIds.add(r.shift.assigned_user_id);
      if (r.target_shift?.assigned_user_id) userIds.add(r.target_shift.assigned_user_id);
      if (r.target_user_id) userIds.add(r.target_user_id);
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
  }, [orgId, userId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

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
      setError(err.message);
      toast({ variant: 'error', title: 'No se pudo cancelar', message: err.message });
      return;
    }
    toast({ variant: 'success', title: 'Solicitud cancelada', message: 'La solicitud fue cancelada.' });
    load();
  }, [cancelId, load, toast]);

  const canCancel = (s: string) => ['draft', 'submitted', 'accepted'].includes(s);

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

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-background p-6">
          <p className="text-sm text-muted">No tienes solicitudes.</p>
          <p className="mt-1 text-sm text-muted">
            Puedes crear solicitudes desde el calendario: clic en un turno → Solicitar cambio.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-background overflow-hidden">
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
                {rows.map((r) => {
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
