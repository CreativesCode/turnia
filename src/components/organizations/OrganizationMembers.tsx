'use client';

import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import useSWR from 'swr';

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Superadmin',
  org_admin: 'Admin org',
  team_manager: 'Gestor',
  user: 'Usuario',
  viewer: 'Solo lectura',
};

type MemberRow = {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  full_name: string | null;
  email: string | null;
};

type Props = {
  orgId: string;
  refreshKey?: number;
};

export function OrganizationMembers({ orgId, refreshKey = 0 }: Props) {
  const swrKey = useMemo(() => ['organizationMembers', orgId] as const, [orgId]);
  const fetcher = useCallback(async (): Promise<MemberRow[]> => {
    const supabase = createClient();

    const { data: memberships, error: mErr } = await supabase
      .from('memberships')
      .select('id, user_id, role, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (mErr) throw new Error(mErr.message);

    const list = (memberships ?? []) as { id: string; user_id: string; role: string; created_at: string }[];
    if (list.length === 0) return [];

    const userIds = [...new Set(list.map((m) => m.user_id))];
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', userIds);
    const profileMap = Object.fromEntries(((profiles ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((p) => [p.id, p]));

    const merged: MemberRow[] = list.map((m) => {
      const p = profileMap[m.user_id];
      return {
        ...m,
        full_name: p?.full_name ?? null,
        email: p?.email ?? null,
      };
    });

    return merged;
  }, [orgId]);

  const { data: rows = [], error: swrError, isLoading, isValidating, mutate } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
  });

  useEffect(() => {
    // Trigger revalidate desde padre
    void mutate();
  }, [refreshKey, mutate]);

  const realtimeTimerRef = useRef<number | null>(null);
  const scheduleRealtimeRefresh = useCallback(() => {
    if (realtimeTimerRef.current) window.clearTimeout(realtimeTimerRef.current);
    realtimeTimerRef.current = window.setTimeout(() => void mutate(), 250);
  }, [mutate]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`turnia:membershipsOrg:${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'memberships', filter: `org_id=eq.${orgId}` },
        () => scheduleRealtimeRefresh()
      )
      .subscribe();

    return () => {
      if (realtimeTimerRef.current) {
        window.clearTimeout(realtimeTimerRef.current);
        realtimeTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [orgId, scheduleRealtimeRefresh]);

  const loading = isLoading || (isValidating && rows.length === 0);
  const error = swrError ? String((swrError as Error).message ?? swrError) : null;

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-background p-4">
        <p className="text-sm text-muted">Cargando usuarios…</p>
        <div className="mt-3 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded bg-subtle-bg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-background p-4">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-background p-4">
        <p className="text-sm text-muted">Aún no hay usuarios en esta organización. Invita a alguien para comenzar.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-background shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-subtle-bg">
            <th className="px-3 py-2.5 text-left font-medium text-text-primary">Usuario</th>
            <th className="px-3 py-2.5 text-left font-medium text-text-primary">Correo</th>
            <th className="px-3 py-2.5 text-left font-medium text-text-primary">Rol</th>
            <th className="px-3 py-2.5 text-left font-medium text-text-primary">Alta</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border last:border-0">
              <td className="px-3 py-2.5 text-text-primary">
                {r.full_name?.trim() || r.email || '—'}
              </td>
              <td className="px-3 py-2.5 text-muted">{r.email || '—'}</td>
              <td className="px-3 py-2.5 text-muted">{ROLE_LABELS[r.role] || r.role}</td>
              <td className="px-3 py-2.5 text-muted">
                {new Date(r.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
