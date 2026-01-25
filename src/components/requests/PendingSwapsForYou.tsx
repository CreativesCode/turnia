'use client';

/**
 * Lista de solicitudes de intercambio donde el usuario es target_user_id y están en submitted.
 * User B puede aceptar o rechazar desde aquí.
 * @see project-roadmap.md Módulo 4.4
 */

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AcceptSwapButton } from '@/components/requests/AcceptSwapButton';

type ShiftEmbed = {
  start_at: string;
  end_at: string;
  organization_shift_types: { name: string; letter: string } | { name: string; letter: string }[] | null;
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

function formatRange(start: string, end: string): string {
  const d1 = new Date(start);
  const d2 = new Date(end);
  return `${d1.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })} ${d1.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} – ${d2.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
}

function getTypeLetter(ot: ShiftEmbed['organization_shift_types']): string {
  if (!ot) return '?';
  const o = Array.isArray(ot) ? ot[0] : ot;
  return o?.letter ?? '?';
}

export function PendingSwapsForYou({ orgId, userId, refreshKey = 0, onResolved }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

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
         shift:shifts!shift_id(start_at, end_at, organization_shift_types(name, letter)),
         target_shift:shifts!target_shift_id(start_at, end_at, organization_shift_types(name, letter))`
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
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', reqIds);
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
    load();
  }, [load, refreshKey]);

  const handleResolved = useCallback(() => {
    load();
    onResolved?.();
  }, [load, onResolved]);

  if (!orgId || !userId) return null;

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-background p-4">
        <p className="text-sm text-muted">Cargando intercambios pendientes…</p>
      </div>
    );
  }

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
      <h2 className="text-base font-semibold text-text-primary">
        Intercambios pendientes de tu aceptación
      </h2>
      <p className="mt-1 text-sm text-muted">
        Te han propuesto intercambiar turnos. Acepta o rechaza para continuar.
      </p>
      <ul className="mt-4 space-y-4">
        {rows.map((r) => {
          const shift = r.shift;
          const target = r.target_shift;
          const letterA = shift ? getTypeLetter(shift.organization_shift_types) : '?';
          const letterB = target ? getTypeLetter(target.organization_shift_types) : '?';
          const rangeA = shift ? formatRange(shift.start_at, shift.end_at) : '—';
          const rangeB = target ? formatRange(target.start_at, target.end_at) : '—';
          const requesterName = names[r.requester_id] ?? r.requester_id.slice(0, 8);
          return (
            <li
              key={r.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium text-text-primary">
                  <span className="text-amber-700">{requesterName}</span> te propone intercambiar:
                </p>
                <p className="mt-1 text-text-secondary">
                  <span className="font-medium">{letterA}</span> {rangeA}
                  <span className="mx-2 text-muted">↔</span>
                  <span className="font-medium">{letterB}</span> {rangeB}
                </p>
                {r.comment && (
                  <p className="mt-1 text-muted">«{r.comment}»</p>
                )}
              </div>
              <div className="shrink-0">
                <AcceptSwapButton requestId={r.id} onSuccess={handleResolved} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
