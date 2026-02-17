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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';

const LIMIT = 50;

export default function NotificationsPage() {
  const { canApproveRequests } = useScheduleOrg();
  const [markAllLoading, setMarkAllLoading] = useState(false);
  const realtimeTimerRef = useRef<number | null>(null);

  const swrKey = useMemo(() => ['notificationsPage', LIMIT] as const, []);
  const fetcher = useCallback(async (): Promise<NotificationRow[]> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('notifications')
      .select('id, title, message, type, entity_type, entity_id, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(LIMIT);
    if (error) throw new Error(error.message);
    return (data ?? []) as NotificationRow[];
  }, []);

  const { data: items, error: swrError, isLoading, isValidating, mutate } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
  });

  const scheduleRealtimeRefresh = useCallback(() => {
    if (realtimeTimerRef.current) window.clearTimeout(realtimeTimerRef.current);
    realtimeTimerRef.current = window.setTimeout(() => {
      void mutate();
    }, 250);
  }, [mutate]);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;

    void (async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id ?? null;
      if (!active || !userId) return;

      channel = supabase
        .channel(`turnia:notificationsPage:${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            scheduleRealtimeRefresh();
          }
        )
        .subscribe();
    })();

    return () => {
      active = false;
      if (realtimeTimerRef.current) {
        window.clearTimeout(realtimeTimerRef.current);
        realtimeTimerRef.current = null;
      }
      if (channel) supabase.removeChannel(channel);
    };
  }, [scheduleRealtimeRefresh]);

  const markAsRead = useCallback(async (id: string) => {
    const supabase = createClient();
    const nowIso = new Date().toISOString();
    mutate((prev) => (prev ?? []).map((n) => (n.id === id ? { ...n, read_at: n.read_at || nowIso } : n)), {
      revalidate: false,
    });
    const { error } = await supabase.from('notifications').update({ read_at: nowIso }).eq('id', id);
    if (error) {
      // Revalidar para reparar el estado si falla el update.
      await mutate();
    }
  }, [mutate]);

  const markAllAsRead = useCallback(async () => {
    const current = items ?? [];
    const unread = current.filter((n) => !n.read_at);
    if (unread.length === 0) return;
    setMarkAllLoading(true);
    const supabase = createClient();
    const nowIso = new Date().toISOString();
    mutate((prev) => (prev ?? []).map((n) => ({ ...n, read_at: n.read_at || nowIso })), { revalidate: false });
    const { error } = await supabase.from('notifications').update({ read_at: nowIso }).in('id', unread.map((n) => n.id));
    if (error) await mutate();
    setMarkAllLoading(false);
  }, [items, mutate]);

  const getHref = useCallback(
    (n: NotificationRow): string => {
      if (n.entity_type === 'shift_request' && n.entity_id) {
        return canApproveRequests ? `/dashboard/manager/requests?request=${n.entity_id}` : `/dashboard/transactions?request=${n.entity_id}`;
      }
      if (n.entity_type === 'shift' && n.entity_id) {
        return `/dashboard/manager?shift=${n.entity_id}`;
      }
      return '/dashboard';
    },
    [canApproveRequests]
  );

  const safeItems = items ?? [];
  const unreadCount = useMemo(() => safeItems.filter((n) => !n.read_at).length, [safeItems]);
  const loading = isLoading || (isValidating && !items);
  const error = swrError ? String((swrError as Error).message ?? swrError) : null;
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

        {error ? (
          <div className="p-6">
            <p className="text-sm text-red-700">{error}</p>
            <Button type="button" variant="secondary" className="mt-3" onClick={() => void mutate()}>
              Reintentar
            </Button>
          </div>
        ) : loading ? (
          <div className="p-6">
            <p className="text-sm text-muted">Cargando…</p>
          </div>
        ) : (
          <NotificationsList items={safeItems} onMarkAsRead={markAsRead} getHref={getHref} emptyMessage="No hay notificaciones." />
        )}
      </div>
    </div>
  );
}
