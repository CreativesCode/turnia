'use client';

/**
 * Modal de detalle de una solicitud para el manager: ver datos y aprobar/rechazar.
 * @see project-roadmap.md Módulo 4.2
 */

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
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

export type RequestDetailRow = {
  id: string;
  request_type: string;
  status: string;
  comment: string | null;
  created_at: string;
  shift_id: string;
  target_shift_id: string | null;
  target_user_id: string | null;
  suggested_replacement_user_id?: string | null;
  requester_id: string;
  shift: {
    start_at: string;
    end_at: string;
    assigned_user_id: string | null;
    organization_shift_types: { name: string; letter: string } | { name: string; letter: string }[] | null;
  } | null;
  target_shift: {
    start_at: string;
    end_at: string;
    assigned_user_id: string | null;
    organization_shift_types: { name: string; letter: string } | { name: string; letter: string }[] | null;
  } | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onResolved: () => void;
  request: RequestDetailRow | null;
  names: Record<string, string>;
};

function formatRange(start: string, end: string): string {
  const d1 = new Date(start);
  const d2 = new Date(end);
  return `${d1.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })} ${d1.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} – ${d2.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
}

function getTypeLetter(ot: { name: string; letter: string } | { name: string; letter: string }[] | null): string {
  if (!ot) return '?';
  const o = Array.isArray(ot) ? ot[0] : ot;
  return o?.letter ?? '?';
}

export function RequestDetailModal({ open, onClose, onResolved, request, names }: Props) {
  const { toast } = useToast();
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [managerComment, setManagerComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAction = useCallback(async () => {
    if (!request || !action) return;
    const isApprove = action === 'approve';
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr || !refreshData?.session?.access_token) {
      setError('Sesión expirada. Recarga la página e inicia sesión de nuevo.');
      toast({ variant: 'error', title: 'Sesión expirada', message: 'Recarga la página e inicia sesión de nuevo.' });
      setLoading(false);
      setAction(null);
      return;
    }

    const { data, error: fnErr } = await supabase.functions.invoke('approve-request', {
      body: {
        requestId: request.id,
        action,
        comment: !isApprove && managerComment.trim() ? managerComment.trim() : undefined,
      },
    });
    setLoading(false);
    setAction(null);
    setManagerComment('');
    const json = (data ?? {}) as { ok?: boolean; error?: string };
    if (fnErr || !json.ok) {
      const msg = String(json.error || (fnErr as Error)?.message || 'Error al procesar.');
      setError(msg);
      toast({ variant: 'error', title: 'No se pudo procesar', message: msg });
      return;
    }
    onResolved();
    onClose();
    toast({
      variant: 'success',
      title: action === 'approve' ? 'Solicitud aprobada' : 'Solicitud rechazada',
      message: 'La solicitud fue procesada correctamente.',
    });
  }, [request, action, managerComment, onResolved, onClose, toast]);

  const handleClose = useCallback(() => {
    setAction(null);
    setManagerComment('');
    setError(null);
    onClose();
  }, [onClose]);

  const onEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && !action) handleClose();
    },
    [open, action, handleClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [open, onEscape]);

  if (!open || !request) return null;

  const canAct = ['submitted', 'accepted'].includes(request.status);
  const shift = request.shift;
  const letter = shift ? getTypeLetter(shift.organization_shift_types) : '?';
  const range = shift ? formatRange(shift.start_at, shift.end_at) : '—';
  const assignedName = shift?.assigned_user_id ? (names[shift.assigned_user_id] ?? '—') : 'Sin asignar';
  const requesterName = names[request.requester_id] ?? request.requester_id.slice(0, 8);
  const targetInfo =
    request.request_type === 'swap' && request.target_shift
      ? ` ↔ ${getTypeLetter(request.target_shift.organization_shift_types)} ${formatRange(request.target_shift.start_at, request.target_shift.end_at)} (${request.target_shift.assigned_user_id ? names[request.target_shift.assigned_user_id] ?? '—' : '?'})`
      : '';

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="request-detail-title">
        <button type="button" onClick={handleClose} className="absolute inset-0 bg-black/50" aria-label="Cerrar" />
        <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-background p-6 shadow-lg">
          <h2 id="request-detail-title" className="text-lg font-semibold text-text-primary">
            Detalle de solicitud
          </h2>

          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="font-medium text-text-secondary">Tipo</dt>
              <dd className="text-text-primary">{REQUEST_TYPE_LABEL[request.request_type] ?? request.request_type}</dd>
            </div>
            <div>
              <dt className="font-medium text-text-secondary">Estado</dt>
              <dd>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    request.status === 'approved' ? 'bg-green-100 text-green-800' : request.status === 'rejected' || request.status === 'cancelled' ? 'bg-gray-100 text-gray-700' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {STATUS_LABEL[request.status] ?? request.status}
                </span>
              </dd>
            </div>
            <div>
              <dt className="font-medium text-text-secondary">Solicitante</dt>
              <dd className="text-text-primary">{requesterName}</dd>
            </div>
            <div>
              <dt className="font-medium text-text-secondary">Turno</dt>
              <dd className="text-text-primary">
                <span className="font-medium">{letter}</span> {range}
                {request.request_type !== 'take_open' && ` — ${assignedName}`}
                {targetInfo}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-text-secondary">Fecha solicitud</dt>
              <dd className="text-text-primary">
                {new Date(request.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </dd>
            </div>
            {request.comment && (
              <div>
                <dt className="font-medium text-text-secondary">Comentario del solicitante</dt>
                <dd className="text-text-primary">{request.comment}</dd>
              </div>
            )}
            {request.request_type === 'give_away' && request.suggested_replacement_user_id && (
              <div>
                <dt className="font-medium text-text-secondary">Sugerencia de reemplazo</dt>
                <dd className="text-text-primary">{names[request.suggested_replacement_user_id] ?? request.suggested_replacement_user_id.slice(0, 8)}</dd>
              </div>
            )}
          </dl>

          {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p>}

          {canAct && (
            <div className="mt-6 space-y-3">
              <label className="block text-sm font-medium text-text-secondary">
                Comentario (opcional; se guarda al rechazar)
                <Textarea
                  value={managerComment}
                  onChange={(e) => setManagerComment(e.target.value)}
                  placeholder="Ej. Motivo del rechazo o nota para el solicitante"
                  rows={2}
                  className="mt-1.5 min-h-[80px]"
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={() => setAction('approve')}
                  disabled={loading}
                  className="bg-green-600 text-white hover:bg-green-700"
                >
                  Aprobar
                </Button>
                <Button
                  type="button"
                  onClick={() => setAction('reject')}
                  disabled={loading}
                  variant="secondary"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                >
                  Rechazar
                </Button>
                <Button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  variant="secondary"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          )}

          {!canAct && (
            <div className="mt-6">
              <Button type="button" variant="secondary" onClick={handleClose}>
                Cerrar
              </Button>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={action === 'approve'}
        onClose={() => setAction(null)}
        onConfirm={runAction}
        title="Aprobar solicitud"
        message="Se aplicarán los cambios en los turnos (dar de baja / intercambio / tomar turno). ¿Continuar?"
        confirmLabel="Sí, aprobar"
        loading={loading}
      />
      <ConfirmModal
        open={action === 'reject'}
        onClose={() => setAction(null)}
        onConfirm={runAction}
        title="Rechazar solicitud"
        message="El solicitante recibirá la solicitud como rechazada. ¿Continuar?"
        confirmLabel="Sí, rechazar"
        variant="danger"
        loading={loading}
      />
    </>
  );
}
