'use client';

/**
 * Callout amber con las solicitudes de intercambio donde el usuario es target.
 * Renderiza una card por solicitud con avatar + meta + 3 botones (Aceptar / Rechazar / Ver).
 * Diseño: ref docs/design/screens/mobile.jsx MMyRequests action-needed callout (línea 604).
 */

import { Icons } from '@/components/ui/icons';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { cn } from '@/lib/cn';
import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useState } from 'react';

type ShiftEmbed = {
  start_at: string;
  end_at: string;
  organization_shift_types: { name: string; letter: string; color: string } | { name: string; letter: string; color: string }[] | null;
};

type Row = {
  id: string;
  requester_id: string;
  comment: string | null;
  created_at: string;
  shift: ShiftEmbed | null;
  target_shift: ShiftEmbed | null;
};

type Props = {
  orgId: string | null;
  userId: string | null;
  refreshKey?: number;
  onResolved?: () => void;
};

const PALETTE = ['#0EA5E9', '#8B5CF6', '#14B8A6', '#F97316', '#F59E0B', '#A78BFA', '#EC4899', '#22C55E'];

function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase() || '?'
  );
}

function shortRange(start: string, end: string): string {
  const d = new Date(start);
  if (isNaN(d.getTime())) return '—';
  const dayShort = d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
  return capitalize(dayShort);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function PendingSwapsForYou({ orgId, userId, refreshKey = 0, onResolved }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ id: string; kind: 'accept' | 'decline' } | null>(null);

  const load = useCallback(async () => {
    if (!orgId || !userId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from('shift_requests')
      .select(
        `id, requester_id, comment, created_at,
         shift:shifts!shift_id(start_at, end_at, organization_shift_types(name, letter, color)),
         target_shift:shifts!target_shift_id(start_at, end_at, organization_shift_types(name, letter, color))`
      )
      .eq('org_id', orgId)
      .eq('target_user_id', userId)
      .eq('request_type', 'swap')
      .eq('status', 'submitted')
      .order('created_at', { ascending: false });

    if (err) {
      setRows([]);
      setLoading(false);
      return;
    }

    const list = ((data ?? []) as unknown) as Row[];
    setRows(list);

    const reqIds = [...new Set(list.map((r) => r.requester_id))];
    if (reqIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', reqIds);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: { id: string; full_name: string | null }) => {
        map[p.id] = p.full_name?.trim() || p.id.slice(0, 8);
      });
      setNames(map);
    } else {
      setNames({});
    }
    setLoading(false);
  }, [orgId, userId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const respond = useCallback(async (id: string, kind: 'accept' | 'decline') => {
    setPendingAction({ id, kind });
    const supabase = createClient();
    const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr || !refreshData?.session?.access_token) {
      toast({ variant: 'error', title: 'Sesión expirada', message: 'Recarga la página e inicia sesión de nuevo.' });
      setPendingAction(null);
      return;
    }
    const { data, error: fnErr } = await supabase.functions.invoke('respond-to-swap', {
      body: { requestId: id, response: kind },
    });
    const json = (data ?? {}) as { ok?: boolean; error?: string };
    setPendingAction(null);
    if (fnErr || !json.ok) {
      const msg = String(json.error || (fnErr as Error)?.message || 'Error al procesar.');
      toast({ variant: 'error', title: 'No se pudo procesar', message: msg });
      return;
    }
    toast({
      variant: 'success',
      title: kind === 'accept' ? 'Intercambio aceptado' : 'Intercambio rechazado',
      message: kind === 'accept' ? 'Falta la aprobación del manager.' : 'La solicitud quedó cancelada.',
    });
    void load();
    onResolved?.();
  }, [toast, load, onResolved]);

  if (!orgId || !userId) return null;

  if (loading) {
    return (
      <div className="rounded-2xl border bg-surface p-4" style={{ borderColor: 'color-mix(in oklab, var(--amber) 35%, transparent)' }}>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-10 w-full" />
        <Skeleton className="mt-3 h-10 w-full" />
      </div>
    );
  }

  if (rows.length === 0) return null;

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const requesterName = names[r.requester_id] ?? r.requester_id.slice(0, 8);
        const userColor = colorForUser(r.requester_id);
        const myShiftLabel = r.target_shift ? shortRange(r.target_shift.start_at, r.target_shift.end_at) : '—';
        const theirShiftLabel = r.shift ? shortRange(r.shift.start_at, r.shift.end_at) : '—';
        const expanded = expandedId === r.id;
        const isAccepting = pendingAction?.id === r.id && pendingAction.kind === 'accept';
        const isDeclining = pendingAction?.id === r.id && pendingAction.kind === 'decline';
        const isPending = isAccepting || isDeclining;
        return (
          <div
            key={r.id}
            className="rounded-2xl border bg-surface p-4"
            style={{
              borderColor: 'color-mix(in oklab, var(--amber) 55%, transparent)',
              borderWidth: 1.5,
            }}
          >
            <div className="flex items-center gap-2 text-amber">
              <Icons.bell size={13} />
              <span className="text-[11.5px] font-bold uppercase tracking-[0.06em]">Te piden un swap</span>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div
                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-[14px] font-extrabold"
                style={{ backgroundColor: userColor + '22', color: userColor }}
              >
                {getInitials(requesterName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-text">
                  {requesterName} quiere intercambiar
                </p>
                <p className="mt-0.5 truncate text-[12px] text-muted">
                  Tu {myShiftLabel} <span className="mx-1">⇄</span> su {theirShiftLabel}
                </p>
              </div>
            </div>

            {expanded && r.comment ? (
              <div className="mt-3 rounded-lg border border-border bg-subtle-2/60 p-3 text-[12.5px] leading-[1.5] text-text">
                «{r.comment}»
              </div>
            ) : null}

            <div className="mt-3.5 flex items-stretch gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => respond(r.id, 'accept')}
                className={cn(
                  'flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-text text-[13px] font-bold text-bg transition-transform hover:-translate-y-px disabled:opacity-50'
                )}
              >
                <Icons.check size={15} stroke={2.6 as unknown as number} />
                {isAccepting ? '…' : 'Aceptar'}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => respond(r.id, 'decline')}
                aria-label="Rechazar"
                className="flex h-10 w-12 items-center justify-center rounded-xl border border-border bg-subtle-2 text-muted transition-colors hover:text-red disabled:opacity-50"
              >
                {isDeclining ? <Icons.clock size={16} /> : <Icons.x size={16} />}
              </button>
              <button
                type="button"
                onClick={() => setExpandedId((id) => (id === r.id ? null : r.id))}
                aria-label={expanded ? 'Ocultar detalle' : 'Ver detalle'}
                className="flex h-10 w-12 items-center justify-center rounded-xl border border-border bg-subtle-2 text-muted transition-colors hover:text-text"
              >
                <Icons.eye size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
