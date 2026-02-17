'use client';

/**
 * Página de historial de notificaciones.
 * Muestra todas las notificaciones del usuario con opción de marcar como leídas.
 */

import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { NotificationsList, type NotificationRow } from '@/components/notifications/NotificationsList';
import { Button } from '@/components/ui/Button';
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
      
      // Optimistic update
      setAllNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at || nowIso } : n)));
      
      const { error } = await supabase.from('notifications').update({ read_at: nowIso }).eq('id', id);
      if (error) {
        console.error('Error marking notification as read:', error);
        toast({ variant: 'error', title: 'Error', message: 'No se pudo marcar como leída' });
        // Revert optimistic update
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

    // Optimistic update
    setAllNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || nowIso })));

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: nowIso })
      .in('id', unreadIds);

    if (error) {
      console.error('Error marking all as read:', error);
      toast({ variant: 'error', title: 'Error', message: 'No se pudieron marcar todas como leídas' });
      void mutate();
    } else {
      toast({ variant: 'success', title: 'Éxito', message: `${unreadIds.length} notificaciones marcadas como leídas` });
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

  if (orgLoading) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Notificaciones" subtitle="Historial de todas tus notificaciones" />
        <div className="rounded-xl border border-border bg-background p-6">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="mt-2 h-4 w-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DashboardDesktopHeader title="Notificaciones" subtitle="Historial de todas tus notificaciones" />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-text-primary md:hidden">Notificaciones</h1>
          {unreadCount > 0 && (
            <span className="rounded-full bg-primary-100 px-3 py-1 text-sm font-medium text-primary-700">
              {unreadCount} sin leer
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button type="button" variant="secondary" size="sm" onClick={markAllAsRead}>
              Marcar todas como leídas
            </Button>
          )}
          <Button type="button" variant="secondary" size="sm" onClick={() => void mutate()}>
            Actualizar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-background p-6">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="mt-2 h-16 w-full" />
          <Skeleton className="mt-2 h-16 w-full" />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-background overflow-hidden">
          <NotificationsList
            items={allNotifications}
            onMarkAsRead={markAsRead}
            getHref={getHref}
            emptyMessage="No hay notificaciones."
          />
          {allNotifications.length >= PAGE_SIZE * page && (
            <div className="border-t border-border p-4 text-center">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPage((p) => p + 1)}
                disabled={isLoading}
              >
                Cargar más
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
