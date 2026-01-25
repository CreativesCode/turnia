'use client';

/**
 * Página de notificaciones: lista completa y marcar todas como leídas.
 * @see project-roadmap.md Módulo 5.4
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { NotificationsList, type NotificationRow } from '@/components/notifications/NotificationsList';

const LIMIT = 50;

export default function NotificationsPage() {
  const { canApproveRequests } = useScheduleOrg();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [markAllLoading, setMarkAllLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('notifications')
      .select('id, title, message, type, entity_type, entity_id, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(LIMIT);
    setItems((data ?? []) as NotificationRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markAsRead = useCallback(async (id: string) => {
    const supabase = createClient();
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
  }, []);

  const markAllAsRead = useCallback(async () => {
    const unread = items.filter((n) => !n.read_at);
    if (unread.length === 0) return;
    setMarkAllLoading(true);
    const supabase = createClient();
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', unread.map((n) => n.id));
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    setMarkAllLoading(false);
  }, [items]);

  const getHref = useCallback(
    (n: NotificationRow): string => {
      if (n.entity_type === 'shift_request' && n.entity_id) {
        return canApproveRequests ? `/dashboard/manager/requests?request=${n.entity_id}` : `/dashboard/staff/my-requests?request=${n.entity_id}`;
      }
      return '/dashboard';
    },
    [canApproveRequests]
  );

  const unreadCount = items.filter((n) => !n.read_at).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-xl font-semibold text-text-primary">Notificaciones</h1>
        <Link href="/dashboard" className="text-sm text-primary-600 hover:text-primary-700">
          ← Dashboard
        </Link>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllAsRead}
            disabled={markAllLoading}
            className="ml-auto min-h-[44px] rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-subtle-bg disabled:opacity-50"
          >
            {markAllLoading ? 'Marcando…' : 'Marcar todas como leídas'}
          </button>
        )}
      </div>
      <p className="text-sm text-muted">
        Solicitudes de intercambio, aprobaciones, rechazos y novedades de tus turnos.
      </p>
      {loading ? (
        <div className="rounded-xl border border-border bg-background p-6">
          <p className="text-sm text-muted">Cargando…</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-background overflow-hidden">
          <NotificationsList items={items} onMarkAsRead={markAsRead} getHref={getHref} emptyMessage="No hay notificaciones." />
        </div>
      )}
    </div>
  );
}
