'use client';

/**
 * Modal de detalle de turno (al hacer clic en el calendario).
 * Muestra tipo, horario, asignado, estado; botones Editar y Eliminar si canManageShifts;
 * acciones Solicitar cambio: Dar de baja, Intercambiar (mi turno), Tomar turno (sin asignar).
 * @see project-roadmap.md Módulo 3.1, 4.1
 */

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatShiftTypeSchedule } from '@/lib/utils';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { GiveAwayRequestModal } from '@/components/requests/GiveAwayRequestModal';
import { TakeOpenRequestModal } from '@/components/requests/TakeOpenRequestModal';
import { SwapRequestModal } from '@/components/requests/SwapRequestModal';
import type { ShiftWithType } from '@/components/calendar/ShiftCalendar';

type RequestModalType = 'give_away' | 'take_open' | 'swap' | null;

type Props = {
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDeleted: () => void;
  onRequestCreated?: () => void;
  shift: ShiftWithType | null;
  assignedName: string | null;
  canManageShifts: boolean;
  canCreateRequests: boolean;
  currentUserId: string | null;
};

export function ShiftDetailModal({
  open,
  onClose,
  onEdit,
  onDeleted,
  onRequestCreated,
  shift,
  assignedName,
  canManageShifts,
  canCreateRequests,
  currentUserId,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [requestModal, setRequestModal] = useState<RequestModalType>(null);

  const isMine = !!currentUserId && !!shift && shift.assigned_user_id === currentUserId;
  const isOpen = !!shift && !shift.assigned_user_id;
  const showRequestActions = canCreateRequests && currentUserId && (isMine || isOpen);

  const doDelete = useCallback(async () => {
    if (!shift) return;
    setDeleting(true);
    setDeleteError(null);
    const supabase = createClient();

    // Refrescar sesión para obtener un access_token válido (evita 401 Invalid JWT si expiró)
    const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr || !refreshData?.session?.access_token) {
      setDeleteError('Sesión expirada. Recarga la página e inicia sesión de nuevo.');
      setDeleting(false);
      setConfirmDelete(false);
      return;
    }

    const { error: fnErr } = await supabase.functions.invoke('delete-shift', {
      body: { id: shift.id },
    });
    setDeleting(false);
    setConfirmDelete(false);
    if (fnErr) {
      setDeleteError(String((fnErr as Error)?.message || 'Error al eliminar.'));
      return;
    }
    onDeleted();
    onClose();
  }, [shift, onDeleted, onClose]);

  const onEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    },
    [open, onClose]
  );

  useEffect(() => {
    if (!open) {
      setRequestModal(null);
      return;
    }
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [open, onEscape]);

  if (!open || !shift) return null;

  const t = shift.organization_shift_types;
  const typeName = t?.name ?? '—';
  const typeLetter = t?.letter ?? '?';
  const typeColor = t?.color ?? '#6B7280';
  const schedule = t ? formatShiftTypeSchedule(t.start_time, t.end_time) : '—';
  const start = new Date(shift.start_at);
  const end = new Date(shift.end_at);
  const timeRange =
    isNaN(start.getTime()) || isNaN(end.getTime())
      ? '—'
      : `${start.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })} – ${end.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 md:items-center md:justify-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shift-detail-title"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
        aria-label="Cerrar"
      />
      <div className="relative w-full max-w-none max-h-[85vh] overflow-y-auto rounded-t-2xl border border-b-0 border-border bg-background p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-lg md:max-w-sm md:max-h-[90vh] md:rounded-xl md:border-b md:pb-6">
        {/* Asa para arrastrar en móvil (bottom sheet) */}
        <div className="-mt-1 mb-2 flex justify-center md:hidden">
          <span className="h-1 w-12 shrink-0 rounded-full bg-muted" aria-hidden />
        </div>
        <h2 id="shift-detail-title" className="text-lg font-semibold text-text-primary">
          Detalle del turno
        </h2>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: typeColor }}
            >
              {typeLetter}
            </span>
            <span className="text-text-primary">{typeName}</span>
            <span className="text-muted">({schedule})</span>
          </div>
          <p className="text-text-secondary">
            <span className="font-medium text-text-primary">Horario: </span>
            {timeRange}
          </p>
          <p className="text-text-secondary">
            <span className="font-medium text-text-primary">Asignado: </span>
            {assignedName?.trim() || 'Sin asignar'}
          </p>
          {shift.location?.trim() && (
            <p className="text-text-secondary">
              <span className="font-medium text-text-primary">Ubicación: </span>
              {shift.location}
            </p>
          )}
          <p className="text-text-secondary">
            <span className="font-medium text-text-primary">Estado: </span>
            {shift.status === 'published' ? 'Publicado' : 'Borrador'}
          </p>
        </div>
        {deleteError && (
          <p className="mt-4 text-sm text-red-600">{deleteError}</p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          {canManageShifts && (
            <>
              <button
                type="button"
                onClick={() => { setDeleteError(null); setConfirmDelete(true); }}
                className="min-h-[44px] min-w-[44px] rounded-lg px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Eliminar
              </button>
              <button
                type="button"
                onClick={onEdit}
                className="min-h-[44px] min-w-[44px] rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
              >
                Editar
              </button>
            </>
          )}
          {showRequestActions && isMine && (
            <>
              <button
                type="button"
                onClick={() => setRequestModal('give_away')}
                className="min-h-[44px] min-w-[44px] rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-subtle-bg"
              >
                Dar de baja
              </button>
              <button
                type="button"
                onClick={() => setRequestModal('swap')}
                className="min-h-[44px] min-w-[44px] rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-subtle-bg"
              >
                Intercambiar
              </button>
            </>
          )}
          {showRequestActions && isOpen && (
            <button
              type="button"
              onClick={() => setRequestModal('take_open')}
              className="min-h-[44px] min-w-[44px] rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
            >
              Tomar turno
            </button>
          )}
          {!canManageShifts && (
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-subtle-bg"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
      <GiveAwayRequestModal
        open={requestModal === 'give_away'}
        onClose={() => setRequestModal(null)}
        onSuccess={() => { onRequestCreated?.(); setRequestModal(null); }}
        shift={shift}
        currentUserId={currentUserId}
      />
      <TakeOpenRequestModal
        open={requestModal === 'take_open'}
        onClose={() => setRequestModal(null)}
        onSuccess={() => { onRequestCreated?.(); setRequestModal(null); }}
        shift={shift}
        currentUserId={currentUserId}
      />
      <SwapRequestModal
        open={requestModal === 'swap'}
        onClose={() => setRequestModal(null)}
        onSuccess={() => { onRequestCreated?.(); setRequestModal(null); }}
        shift={shift}
        currentUserId={currentUserId}
      />
      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={doDelete}
        title="Eliminar turno"
        message="¿Eliminar este turno? No se puede deshacer."
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
