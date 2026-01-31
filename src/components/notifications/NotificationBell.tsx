'use client';

/**
 * Icono de campana con badge de no leídas y desplegable con lista.
 * @see project-roadmap.md Módulo 5.4
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { NotificationsList, type NotificationRow } from './NotificationsList';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

const LIMIT = 10;

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export function NotificationBell() {
  const { canApproveRequests } = useScheduleOrg();
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = 'notification-bell-panel';
  const titleId = 'notification-bell-title';

  const fetchCount = useCallback(async () => {
    const supabase = createClient();
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .is('read_at', null);
    setUnreadCount(count ?? 0);
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('notifications')
      .select('id, title, message, type, entity_type, entity_id, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(LIMIT);
    setList((data ?? []) as NotificationRow[]);
    setLoading(false);
    fetchCount();
  }, [fetchCount]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  useEffect(() => {
    if (open) fetchList();
  }, [open, fetchList]);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      // Permite a teclado/screen readers entrar al panel.
      panelRef.current?.focus();
    } else {
      // Devolver foco al trigger al cerrar.
      buttonRef.current?.focus();
    }
  }, [open]);

  const markAsRead = useCallback(
    async (id: string) => {
      const supabase = createClient();
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
      setList((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
      fetchCount();
    },
    [fetchCount]
  );

  const getHref = useCallback(
    (n: NotificationRow): string => {
      if (n.entity_type === 'shift_request' && n.entity_id) {
        return canApproveRequests ? `/dashboard/manager/requests?request=${n.entity_id}` : `/dashboard/staff/my-requests?request=${n.entity_id}`;
      }
      if (n.entity_type === 'shift' && n.entity_id) {
        return `/dashboard/manager?shift=${n.entity_id}`;
      }
      return '/dashboard';
    },
    [canApproveRequests]
  );

  return (
    <div className="relative" ref={containerRef}>
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon"
        onClick={() => setOpen((o) => !o)}
        className="relative text-text-secondary hover:text-text-primary"
        aria-label={unreadCount > 0 ? `${unreadCount} notificaciones sin leer` : 'Notificaciones'}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="dialog"
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>
      {open && (
        <div
          id={panelId}
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          className="absolute right-0 top-full z-50 mt-1 w-[320px] overflow-hidden rounded-xl border border-border bg-background shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <div className="border-b border-border px-3 py-2">
            <span id={titleId} className="font-medium text-text-primary">
              Notificaciones
            </span>
          </div>
          {loading ? (
            <div className="space-y-2 px-3 py-4">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-4 w-72" />
              <Skeleton className="h-4 w-64" />
            </div>
          ) : (
            <NotificationsList items={list} onMarkAsRead={markAsRead} getHref={getHref} compact emptyMessage="No hay notificaciones." />
          )}
          <div className="border-t border-border px-3 py-2">
            <Link
              href="/dashboard/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              Ver todas
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
