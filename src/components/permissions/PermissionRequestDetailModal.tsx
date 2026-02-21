'use client';

/**
 * Modal de detalle de solicitud de permiso para el manager: ver datos y aprobar/rechazar.
 */

import { PERMISSION_REQUEST_TYPE_OPTIONS } from '@/components/permissions/PermissionRequestModal';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Dialog } from '@/components/ui/Dialog';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { createClient } from '@/lib/supabase/client';
import { useCallback, useState } from 'react';

const PERMISSION_SCOPE_LABEL: Record<string, string> = {
  days: 'Por unos o varios días',
  fraction_shift: 'Fraccionar un turno específico',
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

export type PermissionRequestRow = {
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
  open: boolean;
  onClose: () => void;
  onResolved: () => void;
  request: PermissionRequestRow | null;
  names: Record<string, string>;
  canApprove: boolean;
};

function formatDateRange(start: string, end: string): string {
  const d1 = new Date(start);
  const d2 = new Date(end);
  return `${d1.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })} – ${d2.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}`;
}

export function PermissionRequestDetailModal({
  open,
  onClose,
  onResolved,
  request,
  names,
  canApprove,
}: Props) {
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Sesión expirada. Recarga la página e inicia sesión de nuevo.');
      toast({ variant: 'error', title: 'Sesión expirada', message: 'Recarga la página e inicia sesión de nuevo.' });
      setLoading(false);
      setAction(null);
      return;
    }

    const newStatus = isApprove ? 'approved' : 'rejected';

    const { error: updateErr } = await supabase
      .from('permission_requests')
      .update({
        status: newStatus,
        approver_id: user.id,
        comment_approver: !isApprove && managerComment.trim() ? managerComment.trim() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', request.id);

    if (updateErr) {
      const msg = updateErr.message;
      setError(msg);
      toast({ variant: 'error', title: 'No se pudo procesar', message: msg });
      setLoading(false);
      setAction(null);
      return;
    }

    if (isApprove) {
      await supabase.from('availability_events').insert({
        org_id: request.org_id,
        user_id: request.requester_id,
        type: request.request_type,
        start_at: request.start_at,
        end_at: request.end_at,
        note: request.reason || `Permiso aprobado: ${request.request_type}`,
      });
    }

    setLoading(false);
    setAction(null);
    setManagerComment('');
    onResolved();
    onClose();
    toast({
      variant: 'success',
      title: isApprove ? 'Solicitud aprobada' : 'Solicitud rechazada',
      message: 'La solicitud fue procesada correctamente.',
    });
  }, [request, action, managerComment, onResolved, onClose, toast]);

  const handleClose = useCallback(() => {
    setAction(null);
    setManagerComment('');
    setError(null);
    onClose();
  }, [onClose]);

  if (!open || !request) return null;

  const canAct = canApprove && request.status === 'submitted';
  const requesterName = names[request.requester_id] ?? request.requester_id.slice(0, 8);
  const scopeLabel = PERMISSION_SCOPE_LABEL[request.permission_scope_type] ?? request.permission_scope_type;
  const typeLabel = REQUEST_TYPE_LABEL[request.request_type] ?? request.request_type;
  const dateRange = formatDateRange(request.start_at, request.end_at);

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        active={!action}
        closeOnEscape={!action}
        title="Detalle de solicitud de permiso"
        panelClassName="max-w-lg"
      >
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="font-medium text-text-secondary">Tipo de permiso</dt>
            <dd className="text-text-primary">{scopeLabel}</dd>
          </div>
          <div>
            <dt className="font-medium text-text-secondary">Tipo de solicitud</dt>
            <dd className="text-text-primary">{typeLabel}</dd>
          </div>
          <div>
            <dt className="font-medium text-text-secondary">Estado</dt>
            <dd>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  request.status === 'approved'
                    ? 'bg-green-100 text-green-800'
                    : request.status === 'rejected' || request.status === 'cancelled'
                      ? 'bg-gray-100 text-gray-700'
                      : 'bg-amber-100 text-amber-800'
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
            <dt className="font-medium text-text-secondary">Rango de fechas</dt>
            <dd className="text-text-primary">{dateRange}</dd>
          </div>
          <div>
            <dt className="font-medium text-text-secondary">Fecha solicitud</dt>
            <dd className="text-text-primary">
              {new Date(request.created_at).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </dd>
          </div>
          {request.reason && (
            <div>
              <dt className="font-medium text-text-secondary">Motivo</dt>
              <dd className="text-text-primary">{request.reason}</dd>
            </div>
          )}
        </dl>

        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p>
        )}

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
              <Button type="button" onClick={handleClose} disabled={loading} variant="secondary">
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
      </Dialog>

      <ConfirmModal
        open={action === 'approve'}
        onClose={() => setAction(null)}
        onConfirm={runAction}
        title="Aprobar solicitud de permiso"
        message="La solicitud será marcada como aprobada. El solicitante no estará disponible en el rango de fechas indicado."
        confirmLabel="Sí, aprobar"
        loading={loading}
      />
      <ConfirmModal
        open={action === 'reject'}
        onClose={() => setAction(null)}
        onConfirm={runAction}
        title="Rechazar solicitud de permiso"
        message="El solicitante recibirá la solicitud como rechazada. ¿Continuar?"
        confirmLabel="Sí, rechazar"
        variant="danger"
        loading={loading}
      />
    </>
  );
}
