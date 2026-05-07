'use client';

/**
 * Página de historial de notificaciones, agrupadas por período (Hoy / Esta semana / Anteriores).
 * Diseño: ref docs/design/screens/mobile.jsx MNotifications (línea 744).
 */

import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { NotificationsList, type NotificationRow } from '@/components/notifications/NotificationsList';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';

const PAGE_SIZE = 50;

export default function NotificationsPage() {
  const { userId, canApproveRequests, isLoading: orgLoading } = useScheduleOrg();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [allNotifications, setAllNotifications] = useState<NotificationRow[]>([]);

  const fetchNotifications = useCallback(async (): Promise<NotificationRow[]> => {
    if (!userId) return [];
    const supabase = createClient();
    const { data, error } = await supabase
      .from('notifications')
      .select('id, title, message, type, entity_type, entity_id, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE * page);

    if (error) {
      console.error('Error fetching notifications:', error);
      toast({ variant: 'error', title: 'Error', message: 'No se pudieron cargar las notificaciones' });
      return [];
    }

    return (data ?? []) as NotificationRow[];
  }, [userId, page, toast]);

  const { data: notifications = [], isLoading, mutate } = useSWR(
    userId ? ['notifications', userId, page] : null,
    fetchNotifications,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  useEffect(() => {
    if (notifications.length > 0) {
      setAllNotifications(notifications);
    }
  }, [notifications]);

  const markAsRead = useCallback(
    async (id: string) => {
      const supabase = createClient();
      const nowIso = new Date().toISOString();
      setAllNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at || nowIso } : n)));
      const { error } = await supabase.from('notifications').update({ read_at: nowIso }).eq('id', id);
      if (error) {
        console.error('Error marking notification as read:', error);
        toast({ variant: 'error', title: 'Error', message: 'No se pudo marcar como leída' });
        void mutate();
      } else {
        void mutate();
      }
    },
    [mutate, toast]
  );

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    const nowIso = new Date().toISOString();
    const unreadIds = allNotifications.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) {
      toast({ variant: 'info', title: 'Ya está todo leído', message: 'Todas las notificaciones ya están marcadas como leídas' });
      return;
    }
    setAllNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || nowIso })));
    const { error } = await supabase.from('notifications').update({ read_at: nowIso }).in('id', unreadIds);
    if (error) {
      console.error('Error marking all as read:', error);
      toast({ variant: 'error', title: 'Error', message: 'No se pudieron marcar todas como leídas' });
      void mutate();
    } else {
      toast({ variant: 'success', title: 'Marcadas', message: `${unreadIds.length} notificaciones marcadas como leídas` });
      void mutate();
    }
  }, [userId, allNotifications, mutate, toast]);

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

  const unreadCount = useMemo(() => allNotifications.filter((n) => !n.read_at).length, [allNotifications]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      try {
        channel = supabase
          .channel(`turnia:notifications:${userId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${userId}`,
            },
            () => {
              void mutate();
            }
          )
          .subscribe();
      } catch (e) {
        console.error('Error subscribing to notifications:', e);
      }
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, mutate]);

  const subtitle = unreadCount > 0
    ? `${unreadCount} ${unreadCount === 1 ? 'nueva' : 'nuevas'}`
    : 'Tu actividad reciente';

  if (orgLoading) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Notificaciones" subtitle="Tu actividad reciente" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DashboardDesktopHeader
        title="Notificaciones"
        subtitle={subtitle}
        actions={
          unreadCount > 0 ? (
            <button
              type="button"
              onClick={markAllAsRead}
              className="text-[12.5px] font-semibold text-primary hover:underline"
            >
              Marcar todas
            </button>
          ) : undefined
        }
      />

      {isLoading && allNotifications.length === 0 ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : allNotifications.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface px-5 py-12 text-center">
          <p className="text-sm text-muted">No tienes notificaciones aún.</p>
        </div>
      ) : (
        <>
          <NotificationsList
            items={allNotifications}
            onMarkAsRead={markAsRead}
            getHref={getHref}
            grouped
          />

          {allNotifications.length >= PAGE_SIZE * page ? (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={isLoading}
                className="inline-flex h-9 items-center rounded-lg border border-border bg-bg px-4 text-[12.5px] font-semibold text-text-sec transition-colors hover:text-text disabled:opacity-50"
              >
                Cargar más
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
