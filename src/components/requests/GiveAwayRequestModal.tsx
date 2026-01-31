'use client';

/**
 * Modal para solicitar dar de baja un turno (give_away).
 * Opción opcional: sugerir un compañero como reemplazo.
 * @see project-roadmap.md Módulo 4.1
 */

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/toast/ToastProvider';

type Shift = { id: string; org_id: string };

type MemberOption = { user_id: string; full_name: string | null };

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
  const { toast } = useToast();
  const [comment, setComment] = useState('');
  const [suggestedReplacementUserId, setSuggestedReplacementUserId] = useState('');
  const [members, setMembers] = useState<MemberOption[]>([]);
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
      setSuggestedReplacementUserId('');
      setError(null);
      checkPending();
    }
  }, [open, checkPending]);

  // Cargar miembros de la org (excluyendo al usuario actual) para sugerir reemplazo
  useEffect(() => {
    if (!open || !shift?.org_id || !currentUserId) {
      setMembers([]);
      return;
    }
    const supabase = createClient();
    supabase
      .from('memberships')
      .select('user_id')
      .eq('org_id', shift.org_id)
      .then(({ data: mRes }) => {
        const userIds = ((mRes ?? []) as { user_id: string }[])
          .map((r) => r.user_id)
          .filter((id) => id !== currentUserId);
        if (userIds.length === 0) {
          setMembers([]);
          return;
        }
        supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds)
          .then(({ data }) => {
            setMembers(
              ((data ?? []) as { id: string; full_name: string | null }[]).map((p) => ({
                user_id: p.id,
                full_name: p.full_name,
              }))
            );
          });
      });
  }, [open, shift?.org_id, currentUserId]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!shift || !currentUserId || loading || pendingExists) return;
      setLoading(true);
      setError(null);
      const supabase = createClient();
      const body: { requestType: string; shiftId: string; comment?: string; suggested_replacement_user_id?: string | null } = {
        requestType: 'give_away',
        shiftId: shift.id,
        comment: comment.trim() || undefined,
      };
      if (suggestedReplacementUserId) body.suggested_replacement_user_id = suggestedReplacementUserId;
      const { data, error: err } = await supabase.functions.invoke('create-request', { body });
      setLoading(false);
      if (err) {
        setError(err.message);
        toast({ variant: 'error', title: 'No se pudo enviar', message: err.message });
        return;
      }
      const res = data as { error?: string } | undefined;
      if (res?.error) {
        setError(res.error);
        toast({ variant: 'error', title: 'No se pudo enviar', message: res.error });
        return;
      }
      onSuccess();
      onClose();
      toast({ variant: 'success', title: 'Solicitud enviada', message: 'Tu solicitud fue enviada correctamente.' });
    },
    [shift, currentUserId, comment, suggestedReplacementUserId, loading, pendingExists, onSuccess, onClose, toast]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="giveaway-title">
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
          {members.length > 0 && (
            <div>
              <label htmlFor="giveaway-suggest" className="block text-sm font-medium text-text-primary">
                Sugerir reemplazo <span className="text-muted">(opcional)</span>
              </label>
              <Select
                id="giveaway-suggest"
                value={suggestedReplacementUserId}
                onChange={(e) => setSuggestedReplacementUserId(e.target.value)}
                className="mt-1"
                disabled={pendingExists}
              >
                <option value="">No sugerir a nadie</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.full_name?.trim() || m.user_id.slice(0, 8)}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <label className="block text-sm font-medium text-text-primary">
            Comentario <span className="text-muted">(opcional)</span>
          </label>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="min-h-[90px]"
            placeholder="Motivo o notas adicionales..."
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
