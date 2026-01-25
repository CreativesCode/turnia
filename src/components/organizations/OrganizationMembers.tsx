'use client';

import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useState } from 'react';

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
  team_id: string | null;
  created_at: string;
  full_name: string | null;
  email: string | null;
  team_name: string | null;
};

type Props = {
  orgId: string;
  refreshKey?: number;
};

export function OrganizationMembers({ orgId, refreshKey = 0 }: Props) {
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { data: memberships, error: mErr } = await supabase
      .from('memberships')
      .select('id, user_id, role, team_id, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (mErr) {
      setError(mErr.message);
      setLoading(false);
      return;
    }

    const list = (memberships ?? []) as { id: string; user_id: string; role: string; team_id: string | null; created_at: string }[];
    if (list.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const userIds = [...new Set(list.map((m) => m.user_id))];
    const teamIds = [...new Set(list.map((m) => m.team_id).filter(Boolean))] as string[];

    const [profilesRes, teamsRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email').in('id', userIds),
      teamIds.length > 0
        ? supabase.from('teams').select('id, name').in('id', teamIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);

    const profiles = (profilesRes.data ?? []) as { id: string; full_name: string | null; email: string | null }[];
    const teams = (teamsRes.data ?? []) as { id: string; name: string }[];
    const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
    const teamMap = Object.fromEntries(teams.map((t) => [t.id, t.name]));

    const merged: MemberRow[] = list.map((m) => {
      const p = profileMap[m.user_id];
      return {
        ...m,
        full_name: p?.full_name ?? null,
        email: p?.email ?? null,
        team_name: m.team_id ? (teamMap[m.team_id] ?? null) : null,
      };
    });

    setRows(merged);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

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
            <th className="px-3 py-2.5 text-left font-medium text-text-primary">Equipo</th>
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
              <td className="px-3 py-2.5 text-muted">{r.team_name || 'Toda la org'}</td>
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
