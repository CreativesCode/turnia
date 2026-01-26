'use client';

/**
 * Modal de solo lectura para ver el detalle de un evento de disponibilidad (vista manager).
 * @see project-roadmap.md Módulo 6.2
 */

import { getTypeLabel, type AvailabilityEvent } from './AvailabilityEventModal';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-lg">
        <div className="border-b border-border px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Detalle de disponibilidad</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted hover:bg-subtle-bg hover:text-text-primary"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
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
      </div>
    </div>
  );
}
