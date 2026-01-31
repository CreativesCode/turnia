'use client';

/**
 * Modal para solicitar tomar un turno sin asignar (take_open).
 * @see project-roadmap.md Módulo 4.1
 */

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/toast/ToastProvider';

type Shift = { id: string; org_id: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  shift: Shift | null;
  currentUserId: string | null;
};

export function TakeOpenRequestModal({
  open,
  onClose,
  onSuccess,
  shift,
  currentUserId,
}: Props) {
  const { toast } = useToast();
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
      .eq('request_type', 'take_open')
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
        body: { requestType: 'take_open', shiftId: shift.id, comment: comment.trim() || undefined },
      });
      setLoading(false);
      if (err) {
        setError(err.message);
        toast({ variant: 'error', title: 'No se pudo enviar', message: err.message });
        return;
      }
      const body = data as { error?: string } | undefined;
      if (body?.error) {
        setError(body.error);
        toast({ variant: 'error', title: 'No se pudo enviar', message: body.error });
        return;
      }
      onSuccess();
      onClose();
      toast({ variant: 'success', title: 'Solicitud enviada', message: 'Tu solicitud fue enviada correctamente.' });
    },
    [shift, currentUserId, comment, loading, pendingExists, onSuccess, onClose, toast]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="takeopen-title">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/50" aria-label="Cerrar" />
      <div className="relative w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-lg">
        <h2 id="takeopen-title" className="text-lg font-semibold text-text-primary">
          Tomar este turno
        </h2>
        <p className="mt-1 text-sm text-muted">
          Si la organización lo permite, te asignarán el turno al instante. Si no, un responsable lo revisará.
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
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="min-h-[90px]"
            placeholder="Motivo o disponibilidad..."
            disabled={pendingExists}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={loading} disabled={pendingExists}>
              Enviar solicitud
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
