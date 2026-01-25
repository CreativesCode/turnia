'use client';

/**
 * Modal de detalle de turno (al hacer clic en el calendario).
 * Muestra tipo, horario, asignado, estado; botones Editar y Eliminar (con confirmación) si canManageShifts.
 * @see project-roadmap.md Módulo 3.1
 */

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatShiftTypeSchedule } from '@/lib/utils';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import type { ShiftWithType } from '@/components/calendar/ShiftCalendar';

type Props = {
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDeleted: () => void;
  shift: ShiftWithType | null;
  assignedName: string | null;
  canManageShifts: boolean;
};

export function ShiftDetailModal({
  open,
  onClose,
  onEdit,
  onDeleted,
  shift,
  assignedName,
  canManageShifts,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [deleteError, setDeleteError] = useState<string | null>(null);

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
    if (!open) return;
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
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
      <div className="relative w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-lg">
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
        {canManageShifts && (
          <div className="mt-6 flex flex-wrap justify-end gap-3">
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
          </div>
        )}
        {!canManageShifts && (
          <div className="mt-4">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-subtle-bg"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
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
