'use client';

/**
 * Lista de notificaciones: título, mensaje, fecha y enlace a la entidad.
 * Marcar como leída al hacer clic.
 * @see project-roadmap.md Módulo 5.4
 */

import { useCallback } from 'react';
import Link from 'next/link';

export type NotificationRow = {
  id: string;
  title: string;
  message: string;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

type Props = {
  items: NotificationRow[];
  onMarkAsRead: (id: string) => void | Promise<unknown>;
  getHref: (n: NotificationRow) => string;
  compact?: boolean;
  emptyMessage?: string;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return 'Ahora';
  if (diff < 3600_000) return `Hace ${Math.floor(diff / 60_000)} min`;
  if (diff < 86400_000) return `Hace ${Math.floor(diff / 3600_000)} h`;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

export function NotificationsList({
  items,
  onMarkAsRead,
  getHref,
  compact = false,
  emptyMessage = 'No hay notificaciones.',
}: Props) {
  const handleClick = useCallback(
    (n: NotificationRow) => {
      if (!n.read_at) onMarkAsRead(n.id);
    },
    [onMarkAsRead]
  );

  if (items.length === 0) {
    return <p className={`text-sm text-muted ${compact ? 'px-3 py-4' : 'p-4'}`}>{emptyMessage}</p>;
  }

  return (
    <ul className={compact ? 'divide-y divide-border' : 'space-y-1 p-4'}>
      {items.map((n) => (
        <li key={n.id}>
          <Link
            href={getHref(n)}
            onClick={() => handleClick(n)}
            className={`block ${compact ? 'px-3 py-2.5 hover:bg-subtle-bg' : 'rounded-lg border border-border bg-background p-4 hover:border-primary-200'} ${!n.read_at ? 'bg-primary-50/50' : ''}`}
          >
            <div className="flex items-start gap-2">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${!n.read_at ? 'bg-primary-500' : 'bg-transparent'}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-text-primary">{n.title}</p>
                <p className={`text-muted ${compact ? 'line-clamp-1 text-xs' : 'mt-0.5 text-sm'}`}>{n.message}</p>
                <p className={`text-muted ${compact ? 'mt-0.5 text-xs' : 'mt-1 text-xs'}`}>{formatTime(n.created_at)}</p>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
