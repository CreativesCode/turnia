'use client';

/**
 * Modal-wizard de 3 pasos para solicitar tomar un turno abierto (take_open).
 * Diseño: ref docs/design/screens/mobile.jsx MRequestSwap (línea 504) — adaptado a tomar.
 *
 * Pasos:
 *  1. Turno disponible (revisión).
 *  2. Confirmar disponibilidad.
 *  3. Mensaje + confirmar.
 */

import { Icons } from '@/components/ui/icons';
import { ShiftLetter } from '@/components/ui/ShiftLetter';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { cn } from '@/lib/cn';
import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ShiftTypeEmbed =
  | { id?: string; name: string; letter: string; color?: string | null }
  | { id?: string; name: string; letter: string; color?: string | null }[]
  | null;

type Shift = {
  id: string;
  org_id: string;
  start_at?: string;
  end_at?: string;
  location?: string | null;
  organization_shift_types?: ShiftTypeEmbed;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  shift: Shift | null;
  currentUserId: string | null;
};

function unwrapType(t: ShiftTypeEmbed): { name: string; letter: string; color: string } {
  const o = Array.isArray(t) ? t[0] : t;
  return {
    name: o?.name ?? 'Turno',
    letter: o?.letter ?? '?',
    color: (o?.color as string) ?? '#14B8A6',
  };
}

function formatLongDay(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const s = d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatTimeRange(start?: string, end?: string): string {
  if (!start || !end) return '—';
  const d1 = new Date(start);
  const d2 = new Date(end);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return '—';
  const t1 = d1.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const t2 = d2.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `${t1} — ${t2}`;
}

function shiftDurationHours(start?: string, end?: string): number {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (!isFinite(s) || !isFinite(e) || e <= s) return 0;
  return Math.round(((e - s) / 3600000) * 10) / 10;
}

export function TakeOpenRequestModal({ open, onClose, onSuccess, shift, currentUserId }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [comment, setComment] = useState('');
  const [confirmed, setConfirmed] = useState(false);
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
    if (open && shift) {
      setStep(1);
      setComment('');
      setConfirmed(false);
      setError(null);
      void checkPending();
    }
  }, [open, shift, checkPending]);

  const myType = useMemo(() => unwrapType(shift?.organization_shift_types ?? null), [shift]);

  const handleSubmit = useCallback(async () => {
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
    toast({ variant: 'success', title: 'Solicitud enviada', message: 'Tu solicitud para tomar el turno fue enviada.' });
  }, [shift, currentUserId, comment, loading, pendingExists, onSuccess, onClose, toast]);

  if (!open || !shift) return null;

  const canContinue = step === 1 || (step === 2 && confirmed) || step === 3;

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center md:items-center md:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" aria-hidden onClick={onClose} />

      <div className="relative flex w-full flex-col bg-bg md:my-auto md:max-h-[92vh] md:max-w-md md:rounded-2xl md:border md:border-border md:shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+10px)] md:px-5 md:pt-4">
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-subtle-2 text-muted hover:text-text"
          >
            <Icons.x size={20} />
          </button>
          <p className="tn-h text-[15px] font-bold text-text">Tomar turno</p>
          <div className="w-10 text-right text-[12px] text-muted">{step} / 3</div>
        </div>

        {/* Progress bar */}
        <div className="px-5 pb-3">
          <div className="flex gap-1.5">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-1 flex-1 rounded-full transition-colors"
                style={{ backgroundColor: n <= step ? 'var(--primary)' : 'var(--subtle-2)' }}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {/* Chip operación */}
          <div
            className="mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-bold uppercase tracking-[0.06em]"
            style={{
              backgroundColor: 'color-mix(in oklab, var(--primary) 14%, transparent)',
              color: 'var(--primary)',
            }}
          >
            <Icons.takeOpen size={13} />
            Turno abierto
          </div>

          {pendingExists ? (
            <div
              className="mb-3 rounded-xl border p-3 text-[12.5px]"
              style={{
                borderColor: 'color-mix(in oklab, var(--amber) 40%, transparent)',
                backgroundColor: 'color-mix(in oklab, var(--amber) 8%, transparent)',
                color: 'var(--amber)',
              }}
            >
              Ya tienes una solicitud pendiente para este turno.
            </div>
          ) : null}

          {step === 1 ? (
            <Step1 shift={shift} myType={myType} />
          ) : step === 2 ? (
            <Step2
              shift={shift}
              myType={myType}
              confirmed={confirmed}
              onConfirmChange={setConfirmed}
              disabled={pendingExists}
            />
          ) : (
            <Step3
              shift={shift}
              myType={myType}
              comment={comment}
              onCommentChange={setComment}
              disabled={pendingExists}
            />
          )}

          {error ? <p className="mt-3 text-[12.5px] text-red-600">{error}</p> : null}
        </div>

        {/* Footer */}
        <div
          className="flex items-stretch gap-2 border-t border-border px-5 pt-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)' }}
        >
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s: 1 | 2 | 3) => (s === 3 ? 2 : 1))}
              aria-label="Atrás"
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-bg text-text-sec transition-colors hover:text-text"
            >
              <Icons.chevronL size={18} />
            </button>
          ) : null}
          <button
            type="button"
            disabled={!canContinue || loading || pendingExists}
            onClick={() => {
              if (step === 1) setStep(2);
              else if (step === 2) setStep(3);
              else void handleSubmit();
            }}
            className={cn(
              'flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-[14px] font-bold transition-transform',
              'bg-primary text-white hover:-translate-y-px disabled:opacity-50'
            )}
            style={{ boxShadow: '0 8px 22px -10px var(--primary)' }}
          >
            {step === 3 ? (
              <>
                {loading ? '…' : 'Enviar solicitud'}
                {!loading ? <Icons.send size={16} /> : null}
              </>
            ) : (
              <>
                Continuar <Icons.arrowR size={18} stroke={2.4 as unknown as number} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Step1({ shift, myType }: { shift: Shift; myType: { name: string; letter: string; color: string } }) {
  return (
    <div>
      <h2 className="tn-h text-[22px] font-bold leading-[1.2] tracking-[-0.02em] text-text">
        ¿Quieres tomar este turno?
      </h2>
      <p className="mt-2 text-[13.5px] text-muted">
        Si la organización lo permite, te asignarán el turno al instante. Si no, un responsable lo revisará.
      </p>

      <div className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-subtle-2/60 p-4">
        <ShiftLetter letter={myType.letter} color={myType.color} size={48} />
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted">Turno disponible</p>
          <p className="mt-0.5 truncate text-[14px] font-semibold text-text">
            {myType.name} · {formatLongDay(shift.start_at)}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-muted">
            {formatTimeRange(shift.start_at, shift.end_at)}
            {shift.location?.trim() ? ` · ${shift.location.trim()}` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

function Step2({
  shift,
  myType,
  confirmed,
  onConfirmChange,
  disabled,
}: {
  shift: Shift;
  myType: { name: string; letter: string; color: string };
  confirmed: boolean;
  onConfirmChange: (v: boolean) => void;
  disabled: boolean;
}) {
  const hours = shiftDurationHours(shift.start_at, shift.end_at);
  return (
    <div>
      <h2 className="tn-h text-[22px] font-bold leading-[1.2] tracking-[-0.02em] text-text">
        Verifica tu disponibilidad
      </h2>
      <p className="mt-2 text-[13.5px] text-muted">
        Confirma que estás disponible y que no tienes otros turnos solapados.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-border bg-subtle-2/40 p-3">
          <p className="text-[11px] font-semibold text-muted">Día</p>
          <p className="tn-h mt-1 text-[16px] font-bold tracking-[-0.015em] text-text">
            {formatLongDay(shift.start_at)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-subtle-2/40 p-3">
          <p className="text-[11px] font-semibold text-muted">Horario</p>
          <p className="tn-h mt-1 text-[16px] font-bold tracking-[-0.015em] text-text">
            {formatTimeRange(shift.start_at, shift.end_at)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-subtle-2/40 p-3">
          <p className="text-[11px] font-semibold text-muted">Duración</p>
          <p className="tn-h mt-1 text-[16px] font-bold tracking-[-0.015em] text-text">
            {hours > 0 ? `${hours}h` : '—'}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-subtle-2/40 p-3">
          <p className="text-[11px] font-semibold text-muted">Ubicación</p>
          <p className="mt-1 truncate text-[13px] font-semibold text-text">
            {shift.location?.trim() || 'No definida'}
          </p>
        </div>
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onConfirmChange(!confirmed)}
        aria-pressed={confirmed}
        className={cn(
          'mt-4 flex w-full items-start gap-3 rounded-2xl text-left transition-colors disabled:opacity-50',
          confirmed ? 'border-2' : 'border bg-bg'
        )}
        style={{
          borderColor: confirmed ? 'var(--primary)' : 'var(--border)',
          backgroundColor: confirmed ? 'color-mix(in oklab, var(--primary) 6%, transparent)' : undefined,
          padding: confirmed ? 13 : 14,
        }}
      >
        <span
          aria-hidden
          className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
          style={
            confirmed
              ? { backgroundColor: 'var(--primary)', color: '#fff' }
              : { border: '1.5px solid var(--border-strong, var(--border))' }
          }
        >
          {confirmed ? <Icons.check size={13} stroke={3 as unknown as number} /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold text-text">
            Confirmo que estoy disponible para este turno.
          </span>
          <span className="mt-0.5 block text-[11.5px] text-muted">
            No tengo otros turnos en ese horario y puedo asistir.
          </span>
        </span>
      </button>

      <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-subtle-2/30 p-3 text-[12px] text-muted">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg text-primary">
          <ShiftLetter letter={myType.letter} color={myType.color} size={24} className="text-[10px]" />
        </span>
        <span>
          Estás solicitando un{' '}
          <strong className="text-text">{myType.name}</strong>.
        </span>
      </div>
    </div>
  );
}

function Step3({
  shift,
  myType,
  comment,
  onCommentChange,
  disabled,
}: {
  shift: Shift;
  myType: { name: string; letter: string; color: string };
  comment: string;
  onCommentChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <h2 className="tn-h text-[22px] font-bold leading-[1.2] tracking-[-0.02em] text-text">
        Confirma e incluye un mensaje
      </h2>
      <p className="mt-2 text-[13.5px] text-muted">Revisa el turno y añade un mensaje opcional.</p>

      <div className="mt-4 rounded-2xl border border-border bg-subtle-2/60 p-3">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted">Turno a tomar</p>
        <div className="mt-2 flex items-center gap-2.5">
          <ShiftLetter letter={myType.letter} color={myType.color} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-text">
              {myType.name} · {formatLongDay(shift.start_at)}
            </p>
            <p className="mt-0.5 truncate text-[11.5px] text-muted">
              {formatTimeRange(shift.start_at, shift.end_at)}
              {shift.location?.trim() ? ` · ${shift.location.trim()}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">Mensaje (opcional)</p>
        <textarea
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          rows={3}
          disabled={disabled}
          placeholder="Motivo o disponibilidad…"
          className="block w-full resize-none rounded-2xl border border-border bg-bg px-3.5 py-3 text-[13.5px] leading-[1.45] text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
        />
      </div>
    </div>
  );
}
