'use client';

/**
 * Página de notificaciones: lista completa y marcar todas como leídas.
 * @see project-roadmap.md Módulo 5.4
 */

import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { NotificationsList, type NotificationRow } from '@/components/notifications/NotificationsList';
import { Button } from '@/components/ui/Button';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useState } from 'react';

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
      if (n.entity_type === 'shift' && n.entity_id) {
        return `/dashboard/manager?shift=${n.entity_id}`;
      }
      return '/dashboard';
    },
    [canApproveRequests]
  );

  const unreadCount = items.filter((n) => !n.read_at).length;
  const headerActions =
    unreadCount > 0 ? (
      <Button
        type="button"
        variant="ghost"
        onClick={markAllAsRead}
        disabled={markAllLoading}
        className="hidden min-h-[36px] px-0 text-sm font-medium text-primary-600 hover:bg-transparent hover:text-primary-700 md:inline-flex"
      >
        {markAllLoading ? 'Marcando…' : 'Marcar todas como leídas'}
      </Button>
    ) : null;

  return (
    <div className="space-y-4">
      <DashboardDesktopHeader title="Notificaciones" subtitle="Tus avisos y actualizaciones recientes" actions={headerActions} />

      <div className="overflow-hidden rounded-2xl border border-border bg-background md:rounded-xl">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 md:hidden">
          <h1 className="text-lg font-semibold text-text-primary md:hidden">Notificaciones</h1>
          <div className="ml-auto">
            {unreadCount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={markAllAsRead}
                disabled={markAllLoading}
                className="min-h-[36px] px-0 text-sm font-medium text-primary-600 hover:bg-transparent hover:text-primary-700"
              >
                {markAllLoading ? 'Marcando…' : 'Marcar todas como leídas'}
              </Button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="p-6">
            <p className="text-sm text-muted">Cargando…</p>
          </div>
        ) : (
          <NotificationsList items={items} onMarkAsRead={markAsRead} getHref={getHref} emptyMessage="No hay notificaciones." />
        )}
      </div>
    </div>
  );
}
