'use client';

import { Pill, type PillTone } from '@/components/ui/Pill';
import { CheckIcon, CopyIcon, MailIcon, RefreshIcon, XIcon } from '@/components/ui/icons';
import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';

const ROLE_LABELS: Record<string, string> = {
  org_admin: 'Admin org',
  team_manager: 'Gestor',
  user: 'Usuario',
  viewer: 'Solo lectura',
};

type Status = 'pending' | 'accepted' | 'expired' | 'cancelled';

type Row = {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
  token: string;
};

type Props = {
  orgId: string;
  refreshKey?: number;
};

const STATUS_TONES: Record<string, PillTone> = {
  pending: 'amber',
  accepted: 'green',
  expired: 'muted',
  cancelled: 'muted',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  expired: 'Expirada',
  cancelled: 'Cancelada',
};

async function fetchInvitations(orgId: string): Promise<Row[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('organization_invitations')
    .select('id, email, role, status, expires_at, created_at, token')
    .eq('org_id', orgId)
    .in('status', ['pending', 'accepted', 'expired', 'cancelled'])
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Row[];
}

function timeAgo(iso: string, now: number): string {
  const diff = now - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d}d`;
  const w = Math.floor(d / 7);
  if (w < 4) return `hace ${w} sem`;
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

function expiresIn(iso: string, now: number): { text: string; soon: boolean; expired: boolean } {
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return { text: 'expirada', soon: false, expired: true };
  const d = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (d < 1) {
    const h = Math.floor(diff / (60 * 60 * 1000));
    return { text: `expira en ${h}h`, soon: true, expired: false };
  }
  return { text: `expira en ${d}d`, soon: d <= 2, expired: false };
}

export function InvitationsList({ orgId, refreshKey = 0 }: Props) {
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [extending, setExtending] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('pending');
  const realtimeTimerRef = useRef<number | null>(null);

  const swrKey = useMemo(
    () => (orgId ? (['invitations', orgId, refreshKey] as const) : null),
    [orgId, refreshKey],
  );
  const { data: rows = [], error: swrError, isLoading, mutate } = useSWR(
    swrKey,
    () => fetchInvitations(orgId!),
    { revalidateOnFocus: true, revalidateOnReconnect: true, dedupingInterval: 2000 },
  );

  useEffect(() => {
    if (realtimeTimerRef.current !== null) window.clearTimeout(realtimeTimerRef.current);
    realtimeTimerRef.current = window.setTimeout(() => void mutate(), 250);
  }, [mutate]);

  useEffect(() => {
    if (!orgId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`invitations:${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'organization_invitations',
          filter: `org_id=eq.${orgId}`,
        },
        () => {
          if (realtimeTimerRef.current !== null) window.clearTimeout(realtimeTimerRef.current);
          realtimeTimerRef.current = window.setTimeout(() => void mutate(), 250);
        },
      )
      .subscribe();
    return () => {
      if (realtimeTimerRef.current !== null) window.clearTimeout(realtimeTimerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [orgId, mutate]);

  const counts = useMemo(() => {
    const c: Record<Status | 'all', number> = {
      all: rows.length,
      pending: 0,
      accepted: 0,
      expired: 0,
      cancelled: 0,
    };
    for (const r of rows) {
      const k = r.status as Status;
      if (k in c) c[k]++;
    }
    return c;
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (filterStatus === 'all') return rows;
    return rows.filter((r) => r.status === filterStatus);
  }, [rows, filterStatus]);

  const cancel = useCallback(
    async (id: string) => {
      setCancelling(id);
      const supabase = createClient();
      await supabase.from('organization_invitations').update({ status: 'cancelled' }).eq('id', id);
      setCancelling(null);
      void mutate();
    },
    [mutate],
  );

  const copyLink = useCallback(async (t: string, id: string) => {
    if (typeof window === 'undefined') return;
    const base = (process.env.NEXT_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, '');
    const url = `${base}/invite?token=${encodeURIComponent(t)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, []);

  const resend = useCallback(
    async (id: string) => {
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
      if (!error && data?.ok) void mutate();
    },
    [mutate],
  );

  const extend = useCallback(
    async (r: Row) => {
      if (r.status !== 'pending') return;
      setExtending(r.id);
      const supabase = createClient();
      const now = Date.now();
      const exp = new Date(r.expires_at).getTime();
      const base = exp > now ? exp : now;
      const newExp = new Date(base + 7 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('organization_invitations').update({ expires_at: newExp }).eq('id', r.id);
      setExtending(null);
      void mutate();
    },
    [mutate],
  );

  const tabs: ReadonlyArray<{ key: Status | 'all'; label: string }> = [
    { key: 'pending', label: 'Pendientes' },
    { key: 'accepted', label: 'Aceptadas' },
    { key: 'expired', label: 'Expiradas' },
    { key: 'cancelled', label: 'Canceladas' },
    { key: 'all', label: 'Todas' },
  ];

  if (swrError) {
    return (
      <div className="rounded-2xl border border-border bg-bg p-6 text-sm text-red">
        Error al cargar invitaciones.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-bg p-6 text-sm text-text-sec">
        Cargando invitaciones…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-bg p-8 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{
            background: 'color-mix(in oklab, var(--amber) 18%, transparent)',
            color: 'var(--amber)',
          }}
          aria-hidden
        >
          <MailIcon size={22} />
        </div>
        <p className="text-[13.5px] font-semibold text-text">Sin invitaciones todavía</p>
        <p className="text-[12.5px] text-muted">
          Las invitaciones que envíes aparecerán aquí con su estado.
        </p>
      </div>
    );
  }

  const now = Date.now();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((t) => {
          const active = filterStatus === t.key;
          const n = counts[t.key];
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilterStatus(t.key)}
              className={
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ' +
                (active ? 'bg-text text-bg' : 'bg-subtle-2 text-text-sec hover:bg-subtle')
              }
            >
              {t.label}
              {n > 0 ? <span className="text-[10px] font-bold opacity-70">·{n}</span> : null}
            </button>
          );
        })}
      </div>

      {filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-bg p-6 text-center text-sm text-muted">
          No hay invitaciones en este estado.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filteredRows.map((r) => {
            const exp = expiresIn(r.expires_at, now);
            const tone = STATUS_TONES[r.status] ?? 'muted';
            const isPending = r.status === 'pending';
            return (
              <li
                key={r.id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-bg p-3.5 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background: isPending
                        ? 'color-mix(in oklab, var(--amber) 18%, transparent)'
                        : 'color-mix(in oklab, var(--muted-color) 14%, transparent)',
                      color: isPending ? 'var(--amber)' : 'var(--muted-color)',
                    }}
                    aria-hidden
                  >
                    <MailIcon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold text-text">{r.email}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-muted">
                      <span>{ROLE_LABELS[r.role] || r.role}</span>
                      <span aria-hidden>·</span>
                      <span>enviada {timeAgo(r.created_at, now)}</span>
                      {isPending ? (
                        <>
                          <span aria-hidden>·</span>
                          <span style={{ color: exp.soon ? 'var(--red)' : exp.expired ? 'var(--red)' : undefined }}>
                            {exp.text}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <Pill tone={tone} dot>
                    {STATUS_LABELS[r.status] || r.status}
                  </Pill>
                  {isPending ? (
                    <>
                      <button
                        type="button"
                        onClick={() => copyLink(r.token, r.id)}
                        title="Copiar enlace"
                        aria-label="Copiar enlace"
                        className={
                          'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ' +
                          (copiedId === r.id
                            ? 'bg-green-soft text-green'
                            : 'bg-subtle-2 text-text-sec hover:bg-subtle')
                        }
                      >
                        {copiedId === r.id ? <CheckIcon size={14} stroke={2.6} /> : <CopyIcon size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => resend(r.id)}
                        disabled={resending === r.id}
                        title="Reenviar"
                        aria-label="Reenviar invitación"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-subtle-2 text-text-sec transition-colors hover:bg-subtle disabled:opacity-50"
                      >
                        <RefreshIcon size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => extend(r)}
                        disabled={extending === r.id}
                        title="Extender 7 días"
                        className="inline-flex h-8 items-center justify-center rounded-lg bg-subtle-2 px-2 text-[11px] font-semibold text-text-sec transition-colors hover:bg-subtle disabled:opacity-50"
                      >
                        +7d
                      </button>
                      <button
                        type="button"
                        onClick={() => cancel(r.id)}
                        disabled={cancelling === r.id}
                        title="Cancelar invitación"
                        aria-label="Cancelar invitación"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red transition-colors hover:bg-red-soft disabled:opacity-50"
                      >
                        <XIcon size={14} stroke={2.4} />
                      </button>
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
