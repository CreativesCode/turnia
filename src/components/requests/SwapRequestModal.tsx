'use client';

/**
 * Modal-wizard de 3 pasos para solicitar intercambio de turno.
 * Diseño: ref docs/design/screens/mobile.jsx MRequestSwap (línea 504).
 *
 * Pasos:
 *  1. Tu turno (revisión).
 *  2. Elegir turno compatible (lista con radio).
 *  3. Mensaje + confirmar.
 */

import { Icons } from '@/components/ui/icons';
import { ShiftLetter } from '@/components/ui/ShiftLetter';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { cn } from '@/lib/cn';
import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ShiftTypeEmbed = { id?: string; name: string; letter: string; color?: string | null } | { id?: string; name: string; letter: string; color?: string | null }[] | null;

type Shift = {
  id: string;
  org_id: string;
  start_at: string;
  end_at?: string;
  location?: string | null;
  organization_shift_types?: ShiftTypeEmbed;
};

type TargetShift = {
  id: string;
  start_at: string;
  end_at: string;
  assigned_user_id: string;
  organization_shift_types: { name: string; letter: string; color?: string | null } | { name: string; letter: string; color?: string | null }[] | null;
  assignedName?: string;
  staffPosition?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  shift: Shift | null;
  currentUserId: string | null;
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

function unwrapType(t: ShiftTypeEmbed): { name: string; letter: string; color: string } {
  const o = Array.isArray(t) ? t[0] : t;
  return {
    name: o?.name ?? 'Turno',
    letter: o?.letter ?? '?',
    color: (o?.color as string) ?? '#14B8A6',
  };
}

function formatLongDay(iso: string): string {
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

export function SwapRequestModal({ open, onClose, onSuccess, shift, currentUserId }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
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
      .select('id, start_at, end_at, assigned_user_id, organization_shift_types ( name, letter, color )')
      .eq('org_id', shift.org_id)
      .not('assigned_user_id', 'is', null)
      .neq('assigned_user_id', currentUserId)
      .neq('id', shift.id)
      .gte('start_at', rangeStart.toISOString())
      .lte('start_at', rangeEnd.toISOString())
      .order('start_at');

    if (e1) {
      setError(e1.message);
      toast({ variant: 'error', title: 'No se pudieron cargar turnos', message: e1.message });
      setTargets([]);
      setLoadTargets(false);
      return;
    }

    const list = (shifts ?? []) as TargetShift[];
    const userIds = [...new Set(list.map((s) => s.assigned_user_id).filter(Boolean))] as string[];
    let names: Record<string, string> = {};
    let positions: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      names = Object.fromEntries(
        (profs ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name?.trim() || p.id.slice(0, 8)])
      );
      const { data: memberships } = await supabase
        .from('memberships')
        .select('user_id, staff_position')
        .eq('org_id', shift.org_id)
        .in('user_id', userIds);
      positions = Object.fromEntries(
        (memberships ?? [])
          .filter((m: { user_id: string; staff_position: string | null }) => m.staff_position?.trim())
          .map((m: { user_id: string; staff_position: string | null }) => [m.user_id, m.staff_position!.trim()])
      );
    }

    setTargets(
      list.map((s) => ({
        ...s,
        assignedName: names[s.assigned_user_id] ?? '—',
        staffPosition: positions[s.assigned_user_id] ?? null,
      }))
    );
    setLoadTargets(false);
  }, [shift, currentUserId, toast]);

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
      setStep(1);
      setTargetId('');
      setComment('');
      setError(null);
      void checkPending();
      void fetchTargets();
    }
  }, [open, shift, checkPending, fetchTargets]);

  const myType = useMemo(() => unwrapType(shift?.organization_shift_types ?? null), [shift]);
  const selectedTarget = useMemo(() => targets.find((t) => t.id === targetId) ?? null, [targets, targetId]);
  const selectedTargetType = useMemo(() => unwrapType(selectedTarget?.organization_shift_types ?? null), [selectedTarget]);

  const handleSubmit = useCallback(async () => {
    if (!shift || !currentUserId || !targetId || loading || pendingExists) return;
    if (!selectedTarget) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from('shift_requests').insert({
      org_id: shift.org_id,
      request_type: 'swap',
      status: 'submitted',
      shift_id: shift.id,
      requester_id: currentUserId,
      target_shift_id: selectedTarget.id,
      target_user_id: selectedTarget.assigned_user_id,
      comment: comment.trim() || null,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      toast({ variant: 'error', title: 'No se pudo enviar', message: err.message });
      return;
    }
    onSuccess();
    onClose();
    toast({ variant: 'success', title: 'Solicitud enviada', message: 'Tu solicitud de intercambio fue enviada.' });
  }, [shift, currentUserId, targetId, loading, pendingExists, selectedTarget, comment, onSuccess, onClose, toast]);

  if (!open || !shift) return null;

  const canContinue = step === 1 || (step === 2 && !!targetId) || step === 3;

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
          <p className="tn-h text-[15px] font-bold text-text">Intercambiar turno</p>
          <div className="w-10 text-right text-[12px] text-muted">{step} / 3</div>
        </div>

        {/* Progress bar */}
        <div className="px-5 pb-4">
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

        {/* Body scrollable */}
        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {pendingExists ? (
            <div
              className="mb-3 rounded-xl border p-3 text-[12.5px]"
              style={{
                borderColor: 'color-mix(in oklab, var(--amber) 40%, transparent)',
                backgroundColor: 'color-mix(in oklab, var(--amber) 8%, transparent)',
                color: 'var(--amber)',
              }}
            >
              Ya tienes una solicitud de intercambio pendiente para este turno.
            </div>
          ) : null}

          {step === 1 ? (
            <Step1
              shift={shift}
              myType={myType}
            />
          ) : step === 2 ? (
            <Step2
              shift={shift}
              myType={myType}
              targets={targets}
              loading={loadTargets}
              targetId={targetId}
              onSelect={setTargetId}
              disabled={pendingExists}
            />
          ) : (
            <Step3
              shift={shift}
              myType={myType}
              target={selectedTarget}
              targetType={selectedTargetType}
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
              if (step === 1) {
                setStep(2);
              } else if (step === 2) {
                setStep(3);
              } else {
                void handleSubmit();
              }
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
      <h2 className="tn-h text-[22px] font-bold leading-[1.2] tracking-[-0.02em] text-text">Revisemos tu turno</h2>
      <p className="mt-2 text-[13.5px] text-muted">
        Vas a pedir un intercambio para este turno. Continúa para elegir con qué turno quieres intercambiar.
      </p>

      <div className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-subtle-2/60 p-4">
        <ShiftLetter letter={myType.letter} color={myType.color} size={48} />
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted">Tu turno</p>
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
  targets,
  loading,
  targetId,
  onSelect,
  disabled,
}: {
  shift: Shift;
  myType: { name: string; letter: string; color: string };
  targets: TargetShift[];
  loading: boolean;
  targetId: string;
  onSelect: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <h2 className="tn-h text-[22px] font-bold leading-[1.2] tracking-[-0.02em] text-text">
        ¿Con qué turno quieres intercambiar?
      </h2>
      <p className="mt-2 text-[13.5px] text-muted">
        Tu turno es <span className="font-semibold text-text">{myType.name} · {formatLongDay(shift.start_at)}</span>.
      </p>

      {/* Tu turno mini */}
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-subtle-2/60 p-3">
        <ShiftLetter letter={myType.letter} color={myType.color} size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted">Tu turno</p>
          <p className="mt-0.5 truncate text-[13.5px] font-semibold text-text">
            {myType.name} · {formatLongDay(shift.start_at)}
          </p>
          <p className="mt-0.5 truncate text-[11.5px] text-muted">
            {formatTimeRange(shift.start_at, shift.end_at)}
          </p>
        </div>
      </div>

      {/* Divisor con swap2 central */}
      <div className="my-4 flex items-center gap-2.5">
        <div className="h-px flex-1 bg-border" />
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: 'color-mix(in oklab, var(--primary) 18%, transparent)', color: 'var(--primary)' }}
        >
          <Icons.swap2 size={18} />
        </div>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">Turnos compatibles</p>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : targets.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface px-4 py-8 text-center">
          <p className="text-[13px] font-semibold text-text">Sin turnos compatibles</p>
          <p className="mt-1 text-[12px] text-muted">No hay turnos de otros compañeros en las fechas cercanas.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {targets.map((t) => {
            const ot = unwrapType(t.organization_shift_types);
            const sel = targetId === t.id;
            const userColor = colorForUser(t.assigned_user_id);
            return (
              <button
                key={t.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(t.id)}
                aria-pressed={sel}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl p-3.5 text-left transition-colors disabled:opacity-50',
                  sel ? 'border-2' : 'border bg-bg',
                )}
                style={{
                  borderColor: sel ? 'var(--primary)' : 'var(--border)',
                  backgroundColor: sel ? 'color-mix(in oklab, var(--primary) 6%, transparent)' : undefined,
                  padding: sel ? 13 : 14,
                }}
              >
                <ShiftLetter letter={ot.letter} color={ot.color} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-text">
                    {t.assignedName ?? '—'}
                    {t.staffPosition ? <span className="ml-1.5 font-medium text-muted">· {t.staffPosition}</span> : null}
                  </p>
                  <p className="mt-0.5 truncate text-[11.5px] text-muted">
                    {formatLongDay(t.start_at)} · {formatTimeRange(t.start_at, t.end_at)}
                  </p>
                </div>
                <span
                  aria-hidden
                  className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full"
                  style={
                    sel
                      ? { backgroundColor: 'var(--primary)', color: '#fff' }
                      : { border: '1.5px solid var(--border-strong, var(--border))' }
                  }
                >
                  {sel ? <Icons.check size={14} stroke={3 as unknown as number} /> : null}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Step3({
  shift,
  myType,
  target,
  targetType,
  comment,
  onCommentChange,
  disabled,
}: {
  shift: Shift;
  myType: { name: string; letter: string; color: string };
  target: TargetShift | null;
  targetType: { name: string; letter: string; color: string };
  comment: string;
  onCommentChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <h2 className="tn-h text-[22px] font-bold leading-[1.2] tracking-[-0.02em] text-text">
        Confirma e incluye un mensaje
      </h2>
      <p className="mt-2 text-[13.5px] text-muted">
        Revisa el intercambio y escribe un mensaje opcional para la otra persona.
      </p>

      {/* Tu turno mini */}
      <div className="mt-4 rounded-2xl border border-border bg-subtle-2/60 p-3">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted">Tu turno</p>
        <div className="mt-2 flex items-center gap-2.5">
          <ShiftLetter letter={myType.letter} color={myType.color} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-text">
              {myType.name} · {formatLongDay(shift.start_at)}
            </p>
            <p className="mt-0.5 truncate text-[11.5px] text-muted">{formatTimeRange(shift.start_at, shift.end_at)}</p>
          </div>
        </div>
      </div>

      {/* Divisor swap2 */}
      <div className="my-3 flex items-center gap-2.5">
        <div className="h-px flex-1 bg-border" />
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: 'color-mix(in oklab, var(--primary) 18%, transparent)', color: 'var(--primary)' }}
        >
          <Icons.swap2 size={16} />
        </div>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Turno objetivo */}
      <div className="rounded-2xl border border-border bg-subtle-2/60 p-3">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted">Turno objetivo</p>
        {target ? (
          <div className="mt-2 flex items-center gap-2.5">
            <ShiftLetter letter={targetType.letter} color={targetType.color} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-text">
                {target.assignedName ?? '—'} · {targetType.name}
              </p>
              <p className="mt-0.5 truncate text-[11.5px] text-muted">
                {formatLongDay(target.start_at)} · {formatTimeRange(target.start_at, target.end_at)}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-[12px] text-muted">No has seleccionado un turno.</p>
        )}
      </div>

      {/* Mensaje */}
      <div className="mt-4">
        <p className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">Mensaje (opcional)</p>
        <textarea
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          rows={3}
          disabled={disabled}
          placeholder="Ej. ¡Hola! Tengo un imprevisto familiar el martes. ¿Te animas a cambiar?"
          className="block w-full resize-none rounded-2xl border border-border bg-bg px-3.5 py-3 text-[13.5px] leading-[1.45] text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
        />
      </div>
    </div>
  );
}
