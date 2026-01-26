'use client';

/**
 * Modal de detalle de un evento del audit log: snapshot antes/después, comentario.
 * @see project-roadmap.md Módulo 8.1
 */

import { useCallback, useEffect } from 'react';
import Link from 'next/link';

export type AuditLogRow = {
  id: string;
  org_id: string | null;
  actor_id: string | null;
  entity: string;
  entity_id: string | null;
  action: string;
  before_snapshot: Record<string, unknown> | null;
  after_snapshot: Record<string, unknown> | null;
  comment: string | null;
  created_at: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  entry: AuditLogRow | null;
  actorName: string;
  entityLabel: string;
  actionLabel: string;
};

function JsonBlock({ data, title }: { data: unknown; title: string }) {
  if (data == null) return null;
  return (
    <div>
      <h4 className="text-sm font-medium text-text-secondary">{title}</h4>
      <pre className="mt-1 max-h-48 overflow-auto rounded-lg border border-border bg-subtle-bg p-3 text-xs text-text-primary whitespace-pre-wrap break-all">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export function AuditLogDetailModal({
  open,
  onClose,
  entry,
  actorName,
  entityLabel,
  actionLabel,
}: Props) {
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

  if (!open) return null;

  const hasBefore = entry?.before_snapshot && Object.keys(entry.before_snapshot).length > 0;
  const hasAfter = entry?.after_snapshot && Object.keys(entry.after_snapshot).length > 0;
  const hasComment = !!entry?.comment?.trim();
  const entityLink =
    entry?.entity === 'shift_request' && entry?.entity_id
      ? { href: `/dashboard/manager/requests?request=${entry.entity_id}`, label: 'Ver solicitud' }
      : entry?.entity === 'shift' && entry?.entity_id
        ? { href: `/dashboard/manager/shifts?shift=${entry.entity_id}`, label: 'Ver turno' }
        : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-detail-title"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
        aria-label="Cerrar"
      />
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-border bg-background p-6 shadow-lg">
        <h2 id="audit-detail-title" className="text-lg font-semibold text-text-primary">
          Detalle del evento
        </h2>

        {entry && (
          <div className="mt-4 space-y-4 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <span className="text-text-secondary">Fecha: </span>
                <span className="text-text-primary">
                  {new Date(entry.created_at).toLocaleString('es-ES', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
              <div>
                <span className="text-text-secondary">Actor: </span>
                <span className="text-text-primary">{actorName || '—'}</span>
              </div>
              <div>
                <span className="text-text-secondary">Entidad: </span>
                <span className="text-text-primary">{entityLabel}</span>
              </div>
              <div>
                <span className="text-text-secondary">Acción: </span>
                <span className="text-text-primary">{actionLabel}</span>
              </div>
            </div>

            {entityLink && (
              <div>
                <Link
                  href={entityLink.href}
                  className="text-primary-600 hover:text-primary-700 hover:underline"
                >
                  {entityLink.label} →
                </Link>
              </div>
            )}

            {hasComment && (
              <div>
                <h4 className="text-sm font-medium text-text-secondary">Comentario</h4>
                <p className="mt-1 rounded-lg border border-border bg-subtle-bg p-3 text-text-primary">
                  {entry.comment}
                </p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <JsonBlock data={entry.before_snapshot} title="Antes" />
              <JsonBlock data={entry.after_snapshot} title="Después" />
            </div>

            {!hasBefore && !hasAfter && !hasComment && (
              <p className="text-text-secondary">No hay datos adicionales (snapshots vacíos).</p>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-subtle-bg"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
