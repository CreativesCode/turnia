'use client';

/**
 * Lista de notificaciones: título, mensaje, fecha y enlace a la entidad.
 * Marcar como leída al hacer clic.
 * @see project-roadmap.md Módulo 5.4
 */

import { cn } from '@/lib/cn';
import Link from 'next/link';
import { useCallback } from 'react';

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

type IconSpec = { bg: string; fg: string; icon: React.ReactNode };

function CalendarCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M3 10h18" />
      <path d="m9 16 2 2 4-4" />
    </svg>
  );
}

function RepeatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function CircleCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function CircleAlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}

function getIconSpec(n: NotificationRow): IconSpec {
  const key = `${(n.type ?? '').toLowerCase()} ${(n.title ?? '').toLowerCase()} ${(n.entity_type ?? '').toLowerCase()}`;

  if (key.includes('rejected') || key.includes('rechaz')) {
    return {
      bg: 'bg-red-100',
      fg: 'text-red-600',
      icon: <CircleAlertIcon className="h-5 w-5" />,
    };
  }
  if (key.includes('approved') || key.includes('aprob')) {
    return {
      bg: 'bg-amber-100',
      fg: 'text-amber-600',
      icon: <RepeatIcon className="h-5 w-5" />,
    };
  }
  if (key.includes('completed') || key.includes('complet')) {
    return {
      bg: 'bg-green-100',
      fg: 'text-green-600',
      icon: <CircleCheckIcon className="h-5 w-5" />,
    };
  }
  if ((n.entity_type ?? '').toLowerCase() === 'shift') {
    return {
      bg: 'bg-primary-100',
      fg: 'text-primary-600',
      icon: <CalendarCheckIcon className="h-5 w-5" />,
    };
  }
  if ((n.entity_type ?? '').toLowerCase() === 'shift_request') {
    return {
      bg: 'bg-primary-100',
      fg: 'text-primary-600',
      icon: <RepeatIcon className="h-5 w-5" />,
    };
  }
  return {
    bg: 'bg-subtle-bg',
    fg: 'text-muted',
    icon: <BellIcon className="h-5 w-5" />,
  };
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
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
    <ul className="divide-y divide-border">
      {items.map((n) => (
        <li key={n.id}>
          <Link
            href={getHref(n)}
            onClick={() => handleClick(n)}
            className={cn(
              'block',
              compact ? 'px-3 py-2.5 hover:bg-subtle-bg' : 'px-5 py-5 hover:bg-subtle-bg',
              !n.read_at ? 'bg-primary-50' : 'bg-background'
            )}
          >
            <div className={cn('flex gap-4', compact ? 'items-start' : 'items-center')}>
              {!compact ? (
                <span
                  className={cn('flex h-10 w-10 items-center justify-center rounded-full', getIconSpec(n).bg, getIconSpec(n).fg)}
                  aria-hidden
                >
                  {getIconSpec(n).icon}
                </span>
              ) : (
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${!n.read_at ? 'bg-primary-500' : 'bg-transparent'}`} aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                {compact ? (
                  <>
                    <p className="font-medium text-text-primary">{n.title}</p>
                    <p className="line-clamp-1 text-xs text-muted">{n.message}</p>
                    <p className="mt-0.5 text-xs text-muted">{formatTime(n.created_at)}</p>
                  </>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary">{n.title}</p>
                      <p className="mt-1 text-[13px] text-text-secondary">{n.message}</p>
                    </div>
                    <p className="shrink-0 text-xs text-muted">{formatTime(n.created_at)}</p>
                  </div>
                )}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
