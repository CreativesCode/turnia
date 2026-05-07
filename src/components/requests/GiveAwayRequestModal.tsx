'use client';

/**
 * Modal-wizard de 3 pasos para solicitar ceder un turno (give_away).
 * Diseño: ref docs/design/screens/mobile.jsx MRequestSwap (línea 504) — adaptado a cesión.
 *
 * Pasos:
 *  1. Tu turno (revisión).
 *  2. Sugerir reemplazo (opcional).
 *  3. Mensaje + confirmar.
 */

import { Icons } from '@/components/ui/icons';
import { ShiftLetter } from '@/components/ui/ShiftLetter';
import { Skeleton } from '@/components/ui/Skeleton';
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

type MemberOption = { user_id: string; full_name: string; staffPosition?: string | null };

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

export function GiveAwayRequestModal({ open, onClose, onSuccess, shift, currentUserId }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [suggestId, setSuggestId] = useState('');
  const [comment, setComment] = useState('');
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loadMembers, setLoadMembers] = useState(true);
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

  const loadMembersList = useCallback(async () => {
    if (!shift?.org_id || !currentUserId) {
      setMembers([]);
      setLoadMembers(false);
      return;
    }
    setLoadMembers(true);
    const supabase = createClient();
    const { data: mRes } = await supabase
      .from('memberships')
      .select('user_id, staff_position')
      .eq('org_id', shift.org_id);
    const rows = (mRes ?? []) as { user_id: string; staff_position: string | null }[];
    const userIds = rows.map((r) => r.user_id).filter((id) => id !== currentUserId);
    if (userIds.length === 0) {
      setMembers([]);
      setLoadMembers(false);
      return;
    }
    const positionMap: Record<string, string | null> = {};
    rows.forEach((r) => {
      positionMap[r.user_id] = r.staff_position?.trim() || null;
    });
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);
    const list = ((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => ({
      user_id: p.id,
      full_name: p.full_name?.trim() || p.id.slice(0, 8),
      staffPosition: positionMap[p.id] ?? null,
    }));
    list.sort((a, b) => a.full_name.localeCompare(b.full_name));
    setMembers(list);
    setLoadMembers(false);
  }, [shift?.org_id, currentUserId]);

  useEffect(() => {
    if (open && shift) {
      setStep(1);
      setSuggestId('');
      setComment('');
      setError(null);
      void checkPending();
      void loadMembersList();
    }
  }, [open, shift, checkPending, loadMembersList]);

  const myType = useMemo(() => unwrapType(shift?.organization_shift_types ?? null), [shift]);
  const suggested = useMemo(() => members.find((m) => m.user_id === suggestId) ?? null, [members, suggestId]);

  const handleSubmit = useCallback(async () => {
    if (!shift || !currentUserId || loading || pendingExists) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const body: { requestType: string; shiftId: string; comment?: string; suggested_replacement_user_id?: string | null } = {
      requestType: 'give_away',
      shiftId: shift.id,
      comment: comment.trim() || undefined,
    };
    if (suggestId) body.suggested_replacement_user_id = suggestId;
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
    toast({ variant: 'success', title: 'Solicitud enviada', message: 'Tu cesión fue enviada correctamente.' });
  }, [shift, currentUserId, comment, suggestId, loading, pendingExists, onSuccess, onClose, toast]);

  if (!open || !shift) return null;

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
          <p className="tn-h text-[15px] font-bold text-text">Ceder turno</p>
          <div className="w-10 text-right text-[12px] text-muted">{step} / 3</div>
        </div>

        {/* Progress bar */}
        <div className="px-5 pb-3">
          <div className="flex gap-1.5">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-1 flex-1 rounded-full transition-colors"
                style={{ backgroundColor: n <= step ? 'var(--amber)' : 'var(--subtle-2)' }}
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
              backgroundColor: 'color-mix(in oklab, var(--amber) 16%, transparent)',
              color: 'var(--amber)',
            }}
          >
            <Icons.giveaway size={13} />
            Cesión de turno
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
              Ya tienes una solicitud de cesión pendiente para este turno.
            </div>
          ) : null}

          {step === 1 ? (
            <Step1 shift={shift} myType={myType} />
          ) : step === 2 ? (
            <Step2
              members={members}
              loading={loadMembers}
              suggestId={suggestId}
              onSelect={setSuggestId}
              disabled={pendingExists}
            />
          ) : (
            <Step3
              shift={shift}
              myType={myType}
              suggested={suggested}
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
            disabled={loading || pendingExists}
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
        ¿Quieres ceder este turno?
      </h2>
      <p className="mt-2 text-[13.5px] text-muted">
        Si la organización lo permite se cederá al instante; si no, un responsable lo revisará.
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
  members,
  loading,
  suggestId,
  onSelect,
  disabled,
}: {
  members: MemberOption[];
  loading: boolean;
  suggestId: string;
  onSelect: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <h2 className="tn-h text-[22px] font-bold leading-[1.2] tracking-[-0.02em] text-text">
        ¿Quieres sugerir un reemplazo?
      </h2>
      <p className="mt-2 text-[13.5px] text-muted">
        Es opcional. Si conoces a alguien que pueda cubrir tu turno, indícalo aquí.
      </p>

      <div className="mt-4 space-y-2.5">
        {/* Opción "no sugerir" */}
        <SuggestionOption
          name="No sugerir a nadie"
          sub="El responsable o el equipo decidirá."
          color="#A78BFA"
          letter="—"
          isInitials={false}
          selected={suggestId === ''}
          onSelect={() => onSelect('')}
          disabled={disabled}
        />

        {loading ? (
          <>
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </>
        ) : (
          members.map((m) => (
            <SuggestionOption
              key={m.user_id}
              name={m.full_name}
              sub={m.staffPosition ?? 'Compañero'}
              color={colorForUser(m.user_id)}
              letter={getInitials(m.full_name)}
              isInitials
              selected={suggestId === m.user_id}
              onSelect={() => onSelect(m.user_id)}
              disabled={disabled}
            />
          ))
        )}
      </div>
    </div>
  );
}

function SuggestionOption({
  name,
  sub,
  color,
  letter,
  isInitials,
  selected,
  onSelect,
  disabled,
}: {
  name: string;
  sub: string;
  color: string;
  letter: string;
  isInitials: boolean;
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl text-left transition-colors disabled:opacity-50',
        selected ? 'border-2' : 'border bg-bg'
      )}
      style={{
        borderColor: selected ? 'var(--primary)' : 'var(--border)',
        backgroundColor: selected ? 'color-mix(in oklab, var(--primary) 6%, transparent)' : undefined,
        padding: selected ? 13 : 14,
      }}
    >
      {isInitials ? (
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold"
          style={{ backgroundColor: color + '22', color }}
        >
          {letter}
        </span>
      ) : (
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: 'color-mix(in oklab, var(--muted) 14%, transparent)', color: 'var(--muted)' }}
        >
          <Icons.users size={16} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold text-text">{name}</p>
        <p className="mt-0.5 truncate text-[11.5px] text-muted">{sub}</p>
      </div>
      <span
        aria-hidden
        className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full"
        style={
          selected
            ? { backgroundColor: 'var(--primary)', color: '#fff' }
            : { border: '1.5px solid var(--border-strong, var(--border))' }
        }
      >
        {selected ? <Icons.check size={14} stroke={3 as unknown as number} /> : null}
      </span>
    </button>
  );
}

function Step3({
  shift,
  myType,
  suggested,
  comment,
  onCommentChange,
  disabled,
}: {
  shift: Shift;
  myType: { name: string; letter: string; color: string };
  suggested: MemberOption | null;
  comment: string;
  onCommentChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <h2 className="tn-h text-[22px] font-bold leading-[1.2] tracking-[-0.02em] text-text">
        Confirma e incluye un mensaje
      </h2>
      <p className="mt-2 text-[13.5px] text-muted">Revisa la cesión y añade un mensaje opcional.</p>

      {/* Tu turno */}
      <div className="mt-4 rounded-2xl border border-border bg-subtle-2/60 p-3">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted">Turno a ceder</p>
        <div className="mt-2 flex items-center gap-2.5">
          <ShiftLetter letter={myType.letter} color={myType.color} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-text">
              {myType.name} · {formatLongDay(shift.start_at)}
            </p>
            <p className="mt-0.5 truncate text-[11.5px] text-muted">
              {formatTimeRange(shift.start_at, shift.end_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Sugerido */}
      <div className="mt-3 rounded-2xl border border-border bg-subtle-2/60 p-3">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted">Sugerido</p>
        {suggested ? (
          <div className="mt-2 flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold"
              style={{ backgroundColor: colorForUser(suggested.user_id) + '22', color: colorForUser(suggested.user_id) }}
            >
              {getInitials(suggested.full_name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-text">{suggested.full_name}</p>
              <p className="mt-0.5 truncate text-[11.5px] text-muted">{suggested.staffPosition ?? 'Compañero'}</p>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-[12px] text-muted">Sin reemplazo sugerido.</p>
        )}
      </div>

      <div className="mt-4">
        <p className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">Mensaje (opcional)</p>
        <textarea
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          rows={3}
          disabled={disabled}
          placeholder="Motivo o notas adicionales…"
          className="block w-full resize-none rounded-2xl border border-border bg-bg px-3.5 py-3 text-[13.5px] leading-[1.45] text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
        />
      </div>
    </div>
  );
}
