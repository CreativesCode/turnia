'use client';

/**
 * Modal para solicitar intercambiar un turno (swap).
 * El usuario elige el turno de otro compañero con el que quiere intercambiar.
 * @see project-roadmap.md Módulo 4.1
 */

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Shift = { id: string; org_id: string; start_at: string };

type TargetShift = {
  id: string;
  start_at: string;
  end_at: string;
  assigned_user_id: string;
  organization_shift_types: { name: string; letter: string } | { name: string; letter: string }[] | null;
  assignedName?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  shift: Shift | null;
  currentUserId: string | null;
};

export function SwapRequestModal({
  open,
  onClose,
  onSuccess,
  shift,
  currentUserId,
}: Props) {
  const [targetId, setTargetId] = useState<string>('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadTargets, setLoadTargets] = useState(true);
  const [targets, setTargets] = useState<TargetShift[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingExists, setPendingExists] = useState(false);

  const fetchTargets = useCallback(async () => {
    if (!shift || !currentUserId) return;
    setLoadTargets(true);
    const supabase = createClient();
    const start = new Date(shift.start_at);
    const rangeStart = new Date(start);
    rangeStart.setDate(rangeStart.getDate() - 28);
    const rangeEnd = new Date(start);
    rangeEnd.setDate(rangeEnd.getDate() + 28);

    const { data: shifts, error: e1 } = await supabase
      .from('shifts')
      .select(
        'id, start_at, end_at, assigned_user_id, organization_shift_types ( name, letter )'
      )
      .eq('org_id', shift.org_id)
      .not('assigned_user_id', 'is', null)
      .neq('assigned_user_id', currentUserId)
      .neq('id', shift.id)
      .gte('start_at', rangeStart.toISOString())
      .lte('start_at', rangeEnd.toISOString())
      .order('start_at');

    if (e1) {
      setError(e1.message);
      setTargets([]);
      setLoadTargets(false);
      return;
    }

    const list = (shifts ?? []) as (TargetShift & { organization_shift_types: { name: string; letter: string } | null })[];
    const userIds = [...new Set(list.map((s) => s.assigned_user_id).filter(Boolean))] as string[];
    let names: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      names = Object.fromEntries(
        (profs ?? []).map((p: { id: string; full_name: string | null }) => [
          p.id,
          p.full_name?.trim() || p.id.slice(0, 8),
        ])
      );
    }

    setTargets(
      list.map((s) => ({
        ...s,
        assignedName: names[s.assigned_user_id] ?? '—',
      }))
    );
    setLoadTargets(false);
  }, [shift, currentUserId]);

  const checkPending = useCallback(async () => {
    if (!open || !shift) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('shift_requests')
      .select('id')
      .eq('shift_id', shift.id)
      .eq('request_type', 'swap')
      .in('status', ['submitted', 'accepted'])
      .limit(1);
    setPendingExists((data?.length ?? 0) > 0);
  }, [open, shift]);

  useEffect(() => {
    if (open && shift) {
      setTargetId('');
      setComment('');
      setError(null);
      checkPending();
      fetchTargets();
    }
  }, [open, shift, checkPending, fetchTargets]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!shift || !currentUserId || !targetId || loading || pendingExists) return;
      const target = targets.find((t) => t.id === targetId);
      if (!target) return;
      setLoading(true);
      setError(null);
      const supabase = createClient();
      const { error: err } = await supabase.from('shift_requests').insert({
        org_id: shift.org_id,
        request_type: 'swap',
        status: 'submitted',
        shift_id: shift.id,
        requester_id: currentUserId,
        target_shift_id: target.id,
        target_user_id: target.assigned_user_id,
        comment: comment.trim() || null,
      });
      setLoading(false);
      if (err) {
        setError(err.message);
        return;
      }
      onSuccess();
      onClose();
    },
    [shift, currentUserId, targetId, targets, comment, loading, pendingExists, onSuccess, onClose]
  );

  if (!open) return null;

  const formatRange = (s: string, e: string) => {
    const d1 = new Date(s);
    const d2 = new Date(e);
    return `${d1.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} ${d1.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} – ${d2.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="swap-title">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/50" aria-label="Cerrar" />
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-background p-6 shadow-lg">
        <h2 id="swap-title" className="text-lg font-semibold text-text-primary">
          Intercambiar este turno
        </h2>
        <p className="mt-1 text-sm text-muted">
          Elige el turno con el que quieres intercambiar. La otra persona y un responsable deberán aceptar.
        </p>
        {pendingExists && (
          <p className="mt-3 text-sm text-amber-600">
            Ya tienes una solicitud de intercambio pendiente para este turno.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-text-primary">
            Turno con el que intercambiar <span className="text-red-500">*</span>
          </label>
          {loadTargets ? (
            <p className="text-sm text-muted">Cargando turnos…</p>
          ) : targets.length === 0 ? (
            <p className="text-sm text-muted">No hay turnos de otros compañeros en las fechas cercanas.</p>
          ) : (
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              required
              disabled={pendingExists}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">Seleccionar…</option>
              {targets.map((t) => {
                const ot = t.organization_shift_types;
                const letter = (Array.isArray(ot) ? ot[0] : ot)?.letter ?? '?';
                return (
                  <option key={t.id} value={t.id}>
                    {letter} – {formatRange(t.start_at, t.end_at)} – {t.assignedName}
                  </option>
                );
              })}
            </select>
          )}

          <label className="block text-sm font-medium text-text-primary">
            Comentario <span className="text-muted">(opcional)</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Motivo del intercambio..."
            disabled={pendingExists}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-subtle-bg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || pendingExists || targets.length === 0}
              className="min-h-[44px] rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Enviando…' : 'Enviar solicitud'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
