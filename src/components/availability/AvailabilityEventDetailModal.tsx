'use client';

/**
 * Modal de solo lectura para ver el detalle de un evento de disponibilidad (vista manager).
 * @see project-roadmap.md Módulo 6.2
 */

import { getTypeLabel, type AvailabilityEvent } from './AvailabilityEventModal';
import { Dialog } from '@/components/ui/Dialog';

type Props = {
  open: boolean;
  onClose: () => void;
  event: AvailabilityEvent | null;
  userName: string | null;
};

function formatDate(s: string): string {
  try {
    const d = new Date(s);
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return s;
  }
}

export function AvailabilityEventDetailModal({
  open,
  onClose,
  event,
  userName,
}: Props) {
  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Detalle de disponibilidad"
      titleClassName="sr-only"
      showCloseButton={false}
      panelClassName="max-w-md p-0"
      disableDefaultContentSpacing
    >
      <div className="p-4 space-y-3">
        {event && (
          <>
            <div>
              <span className="text-sm font-medium text-text-secondary">Usuario</span>
              <p className="text-text-primary">{userName?.trim() || event.user_id}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-text-secondary">Tipo</span>
              <p className="text-text-primary">{getTypeLabel(event.type)}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-text-secondary">Desde</span>
              <p className="text-text-primary">{formatDate(event.start_at)}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-text-secondary">Hasta</span>
              <p className="text-text-primary">{formatDate(event.end_at)}</p>
            </div>
            {event.note?.trim() && (
              <div>
                <span className="text-sm font-medium text-text-secondary">Nota</span>
                <p className="text-text-primary whitespace-pre-wrap">{event.note.trim()}</p>
              </div>
            )}
          </>
        )}
      </div>
      <div className="border-t border-border px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-subtle-bg"
        >
          Cerrar
        </button>
      </div>
    </Dialog>
  );
}
