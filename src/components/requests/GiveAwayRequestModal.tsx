'use client';

/**
 * Modal para solicitar dar de baja un turno (give_away).
 * @see project-roadmap.md Módulo 4.1
 */

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Shift = { id: string; org_id: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  shift: Shift | null;
  currentUserId: string | null;
};

export function GiveAwayRequestModal({
  open,
  onClose,
  onSuccess,
  shift,
  currentUserId,
}: Props) {
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingExists, setPendingExists] = useState(false);

  const checkPending = useCallback(async () => {
    if (!open || !shift) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('shift_requests')
      .select('id')
      .eq('shift_id', shift.id)
      .eq('request_type', 'give_away')
      .in('status', ['submitted', 'accepted'])
      .limit(1);
    setPendingExists((data?.length ?? 0) > 0);
  }, [open, shift]);

  useEffect(() => {
    if (open) {
      setComment('');
      setError(null);
      checkPending();
    }
  }, [open, checkPending]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!shift || !currentUserId || loading || pendingExists) return;
      setLoading(true);
      setError(null);
      const supabase = createClient();
      const { data, error: err } = await supabase.functions.invoke('create-request', {
        body: { requestType: 'give_away', shiftId: shift.id, comment: comment.trim() || undefined },
      });
      setLoading(false);
      if (err) {
        setError(err.message);
        return;
      }
      const body = data as { error?: string } | undefined;
      if (body?.error) {
        setError(body.error);
        return;
      }
      onSuccess();
      onClose();
    },
    [shift, currentUserId, comment, loading, pendingExists, onSuccess, onClose]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="giveaway-title">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/50" aria-label="Cerrar" />
      <div className="relative w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-lg">
        <h2 id="giveaway-title" className="text-lg font-semibold text-text-primary">
          Dar de baja este turno
        </h2>
        <p className="mt-1 text-sm text-muted">
          Si la organización lo permite, se dará de baja al instante. Si no, un responsable lo revisará.
        </p>
        {pendingExists && (
          <p className="mt-3 text-sm text-amber-600">
            Ya tienes una solicitud pendiente para este turno.
          </p>
        )}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-text-primary">
            Comentario <span className="text-muted">(opcional)</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Motivo o sugerencia de reemplazo..."
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
              disabled={loading || pendingExists}
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
