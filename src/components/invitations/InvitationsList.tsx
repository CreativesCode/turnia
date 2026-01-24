'use client';

import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useMemo, useState } from 'react';

const ROLE_LABELS: Record<string, string> = {
  org_admin: 'Admin org',
  team_manager: 'Gestor',
  user: 'Usuario',
  viewer: 'Solo lectura',
};

type Row = {
  id: string;
  email: string;
  role: string;
  team_id: string | null;
  status: string;
  expires_at: string;
  created_at: string;
  token: string;
};

type Props = {
  orgId: string;
  refreshKey: number;
};

export function InvitationsList({ orgId, refreshKey }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [extending, setExtending] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterExpires, setFilterExpires] = useState<string>('');

  const filteredRows = useMemo(() => {
    const now = Date.now();
    const in7 = now + 7 * 24 * 60 * 60 * 1000;
    return rows.filter((r) => {
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterRole && r.role !== filterRole) return false;
      const exp = new Date(r.expires_at).getTime();
      if (filterExpires === 'soon' && (exp < now || exp > in7)) return false;
      if (filterExpires === 'expired' && exp >= now) return false;
      return true;
    });
  }, [rows, filterStatus, filterRole, filterExpires]);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('organization_invitations')
      .select('id, email, role, team_id, status, expires_at, created_at, token')
      .eq('org_id', orgId)
      .in('status', ['pending', 'accepted', 'expired', 'cancelled'])
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) return;
    setRows((data ?? []) as Row[]);
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const cancel = useCallback(async (id: string) => {
    setCancelling(id);
    const supabase = createClient();
    await supabase.from('organization_invitations').update({ status: 'cancelled' }).eq('id', id);
    setCancelling(null);
    await load();
  }, [load]);

  const copyLink = useCallback(async (t: string, id: string) => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/invite?token=${encodeURIComponent(t)}` : '';
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, []);

  const resend = useCallback(async (id: string) => {
    setResending(id);
    const supabase = createClient();
    const { data: sess } = await supabase.auth.getSession();
    if (!sess?.session?.access_token) {
      setResending(null);
      return;
    }
    const { data, error } = await supabase.functions.invoke('resend-invitation', {
      body: { invitation_id: id },
    });
    setResending(null);
    if (!error && data?.ok) await load();
  }, [load]);

  const extend = useCallback(async (r: Row) => {
    if (r.status !== 'pending') return;
    setExtending(r.id);
    const supabase = createClient();
    const now = Date.now();
    const exp = new Date(r.expires_at).getTime();
    const base = exp > now ? exp : now;
    const newExp = new Date(base + 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('organization_invitations').update({ expires_at: newExp }).eq('id', r.id);
    setExtending(null);
    await load();
  }, [load]);

  if (loading) return <p className="text-sm text-muted">Cargando invitaciones…</p>;
  if (rows.length === 0) return <p className="text-sm text-muted">No hay invitaciones.</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-text-secondary">Filtrar:</span>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-text-primary"
        >
          <option value="">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="accepted">Aceptada</option>
          <option value="expired">Expirada</option>
          <option value="cancelled">Cancelada</option>
        </select>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-text-primary"
        >
          <option value="">Todos los roles</option>
          {Object.entries(ROLE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select
          value={filterExpires}
          onChange={(e) => setFilterExpires(e.target.value)}
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-text-primary"
        >
          <option value="">Cualquier fecha</option>
          <option value="soon">Expira en 7 días</option>
          <option value="expired">Ya expiradas</option>
        </select>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-background shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-subtle-bg">
            <th className="px-3 py-2.5 text-left font-medium text-text-primary">Correo</th>
            <th className="px-3 py-2.5 text-left font-medium text-text-primary">Rol</th>
            <th className="px-3 py-2.5 text-left font-medium text-text-primary">Estado</th>
            <th className="px-3 py-2.5 text-left font-medium text-text-primary">Expira</th>
            <th className="px-3 py-2.5 text-right font-medium text-text-primary">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.length === 0 ? (
            <tr><td colSpan={5} className="px-3 py-6 text-center text-muted">Ninguna invitación coincide con los filtros.</td></tr>
          ) : (
            filteredRows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2.5 text-text-secondary">{r.email}</td>
                <td className="px-3 py-2.5 text-text-secondary">{ROLE_LABELS[r.role] || r.role}</td>
                <td className="px-3 py-2.5">
                  <span
                    className={
                      r.status === 'pending'
                        ? 'text-primary-600 font-medium'
                        : r.status === 'accepted'
                          ? 'text-primary-700 font-medium'
                          : 'text-muted'
                    }
                  >
                    {r.status === 'pending' ? 'Pendiente' : r.status === 'accepted' ? 'Aceptada' : r.status === 'expired' ? 'Expirada' : 'Cancelada'}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-muted">
                  {new Date(r.expires_at).toLocaleDateString()}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {r.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => copyLink(r.token, r.id)}
                        className={copiedId === r.id ? 'font-medium text-green-600' : 'text-primary-600 hover:text-primary-700'}
                      >
                        {copiedId === r.id ? '¡Copiado!' : 'Copiar'}
                      </button>
                      <span className="mx-1.5 text-muted">·</span>
                      <button
                        type="button"
                        onClick={() => resend(r.id)}
                        disabled={resending === r.id}
                        className="text-primary-600 hover:text-primary-700 disabled:opacity-50"
                      >
                        {resending === r.id ? '…' : 'Reenviar'}
                      </button>
                      <span className="mx-1.5 text-muted">·</span>
                      <button
                        type="button"
                        onClick={() => extend(r)}
                        disabled={extending === r.id}
                        className="text-primary-600 hover:text-primary-700 disabled:opacity-50"
                      >
                        {extending === r.id ? '…' : '+7 días'}
                      </button>
                      <span className="mx-1.5 text-muted">·</span>
                      <button
                        type="button"
                        onClick={() => cancel(r.id)}
                        disabled={cancelling === r.id}
                        className="text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
