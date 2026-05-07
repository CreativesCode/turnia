'use client';

/**
 * Lista de notificaciones agrupada por período de tiempo, con cuadrado de
 * ícono coloreado por tipo y dot teal de no-leída.
 * Diseño: ref docs/design/screens/mobile.jsx MNotifications (línea 744).
 */

import { Icons, type IconName } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import Link from 'next/link';
import { useCallback, useMemo } from 'react';

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
  /** Modo compacto para popovers/menús: dot a la izquierda + texto, sin agrupación. */
  compact?: boolean;
  /** Sin compact: agrupa por Hoy / Esta semana / Antes. */
  grouped?: boolean;
  emptyMessage?: string;
};

function formatTimeRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return 'ahora';
  if (diff < 3600_000) return `hace ${Math.floor(diff / 60_000)} min`;
  if (diff < 86400_000) return `hace ${Math.floor(diff / 3600_000)} h`;
  if (diff < 86400_000 * 7) {
    return d.toLocaleDateString('es-ES', { weekday: 'short' });
  }
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

type IconSpec = { color: string; iconName: IconName };

function getIconSpec(n: NotificationRow): IconSpec {
  const key = `${(n.type ?? '').toLowerCase()} ${(n.title ?? '').toLowerCase()} ${(n.entity_type ?? '').toLowerCase()}`;

  if (key.includes('rejected') || key.includes('rechaz')) {
    return { color: 'var(--red)', iconName: 'x' };
  }
  if (key.includes('approved') || key.includes('aprob') || key.includes('accepted') || key.includes('acept')) {
    return { color: 'var(--green)', iconName: 'check' };
  }
  if (key.includes('swap') || key.includes('intercambi')) {
    return { color: 'var(--primary)', iconName: 'swap' };
  }
  if (key.includes('giveaway') || key.includes('ced')) {
    return { color: 'var(--violet)', iconName: 'giveaway' };
  }
  if (key.includes('alert') || key.includes('reminder') || key.includes('recorda')) {
    return { color: 'var(--amber)', iconName: 'bell' };
  }
  if (key.includes('publish') || key.includes('publica')) {
    return { color: 'var(--violet)', iconName: 'calendar' };
  }
  if ((n.entity_type ?? '').toLowerCase() === 'shift') {
    return { color: 'var(--blue)', iconName: 'cal2' };
  }
  if ((n.entity_type ?? '').toLowerCase() === 'shift_request') {
    return { color: 'var(--primary)', iconName: 'swap' };
  }
  return { color: 'var(--muted)', iconName: 'bell' };
}

type GroupKey = 'today' | 'week' | 'older';

function groupKey(iso: string): GroupKey {
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diff = now - d;
  if (diff < 86400_000) return 'today';
  if (diff < 86400_000 * 7) return 'week';
  return 'older';
}

const GROUP_LABELS: Record<GroupKey, string> = {
  today: 'Hoy',
  week: 'Esta semana',
  older: 'Anteriores',
};

export function NotificationsList({
  items,
  onMarkAsRead,
  getHref,
  compact = false,
  grouped = true,
  emptyMessage = 'No hay notificaciones.',
}: Props) {
  const handleClick = useCallback(
    (n: NotificationRow) => {
      if (!n.read_at) onMarkAsRead(n.id);
    },
    [onMarkAsRead]
  );

  const groups = useMemo(() => {
    if (compact || !grouped) return null;
    const map: Record<GroupKey, NotificationRow[]> = { today: [], week: [], older: [] };
    for (const n of items) map[groupKey(n.created_at)].push(n);
    return (['today', 'week', 'older'] as GroupKey[])
      .map((k) => ({ key: k, label: GROUP_LABELS[k], items: map[k] }))
      .filter((g) => g.items.length > 0);
  }, [items, compact, grouped]);

  if (items.length === 0) {
    return <p className={cn('text-sm text-muted', compact ? 'px-3 py-4' : 'px-4 py-8 text-center')}>{emptyMessage}</p>;
  }

  if (compact) {
    return (
      <ul className="divide-y divide-border">
        {items.map((n) => (
          <li key={n.id}>
            <CompactRow notification={n} href={getHref(n)} onClick={() => handleClick(n)} />
          </li>
        ))}
      </ul>
    );
  }

  if (groups) {
    return (
      <div className="space-y-5">
        {groups.map((g) => (
          <div key={g.key}>
            <p className="mb-2 px-1 text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">{g.label}</p>
            <div className="space-y-2">
              {g.items.map((n) => (
                <FullRow key={n.id} notification={n} href={getHref(n)} onClick={() => handleClick(n)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((n) => (
        <FullRow key={n.id} notification={n} href={getHref(n)} onClick={() => handleClick(n)} />
      ))}
    </div>
  );
}

function FullRow({
  notification,
  href,
  onClick,
}: {
  notification: NotificationRow;
  href: string;
  onClick: () => void;
}) {
  const { color, iconName } = getIconSpec(notification);
  const Icon = Icons[iconName];
  const isUnread = !notification.read_at;
  return (
    <Link
      href={href}
      onClick={onClick}
      className="relative flex items-start gap-3 rounded-2xl border border-border bg-surface p-3.5 transition-colors hover:border-[color-mix(in_oklab,var(--primary)_40%,transparent)]"
    >
      {isUnread ? (
        <span
          aria-hidden
          className="absolute left-1 top-[22px] h-1.5 w-1.5 rounded-full bg-primary"
        />
      ) : null}
      <span
        aria-hidden
        className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', isUnread ? 'ml-1.5' : '')}
        style={{ backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`, color }}
      >
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('text-[13.5px] text-text', isUnread ? 'font-semibold' : 'font-medium')}>
          {notification.title}
        </p>
        {notification.message?.trim() ? (
          <p className="mt-0.5 truncate text-[12px] text-muted">{notification.message}</p>
        ) : null}
      </div>
      <p className="shrink-0 text-[11px] text-muted">{formatTimeRelative(notification.created_at)}</p>
    </Link>
  );
}

function CompactRow({
  notification,
  href,
  onClick,
}: {
  notification: NotificationRow;
  href: string;
  onClick: () => void;
}) {
  const { color, iconName } = getIconSpec(notification);
  const Icon = Icons[iconName];
  const isUnread = !notification.read_at;
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn('flex items-start gap-2.5 px-3 py-2.5 transition-colors hover:bg-subtle-2', isUnread ? 'bg-primary-soft/30' : '')}
    >
      <span
        aria-hidden
        className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`, color }}
      >
        <Icon size={13} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('text-[13px] text-text', isUnread ? 'font-semibold' : 'font-medium')}>
          {notification.title}
        </p>
        {notification.message?.trim() ? (
          <p className="line-clamp-1 text-[11.5px] text-muted">{notification.message}</p>
        ) : null}
        <p className="mt-0.5 text-[11px] text-muted">{formatTimeRelative(notification.created_at)}</p>
      </div>
      {isUnread ? <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden /> : null}
    </Link>
  );
}
