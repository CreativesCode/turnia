'use client';

/**
 * Modal de detalle de turno (al hacer clic en el calendario).
 * Muestra tipo, horario, asignado, estado; botones Editar y Eliminar si canManageShifts;
 * acciones Solicitar cambio: Dar de baja, Intercambiar (mi turno), Tomar turno (sin asignar).
 * @see project-roadmap.md Módulo 3.1, 4.1
 */

import type { ShiftWithType } from '@/components/calendar/ShiftCalendar';
import { GiveAwayRequestModal } from '@/components/requests/GiveAwayRequestModal';
import { SwapRequestModal } from '@/components/requests/SwapRequestModal';
import { TakeOpenRequestModal } from '@/components/requests/TakeOpenRequestModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Pill } from '@/components/ui/Pill';
import { Icons } from '@/components/ui/icons';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { getFocusableElements, trapFocusWithin } from '@/lib/a11y';
import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useRef, useState } from 'react';

type RequestModalType = 'give_away' | 'take_open' | 'swap' | null;

type Props = {
  open: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onDeleted: () => void;
  onRequestCreated?: () => void;
  shift: ShiftWithType | null;
  assignedName: string | null;
  canManageShifts: boolean;
  canCreateRequests: boolean;
  currentUserId: string | null;
};

export function ShiftDetailModal({
  open,
  onClose,
  onEdit,
  onDeleted,
  onRequestCreated,
  shift,
  assignedName,
  canManageShifts,
  canCreateRequests,
  currentUserId,
}: Props) {
  const { toast } = useToast();
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [requestModal, setRequestModal] = useState<RequestModalType>(null);

  const isMine = !!currentUserId && !!shift && shift.assigned_user_id === currentUserId;
  const isOpen = !!shift && !shift.assigned_user_id;
  const showRequestActions = canCreateRequests && currentUserId && (isMine || isOpen);

  const doDelete = useCallback(async () => {
    if (!shift) return;
    setDeleting(true);
    setDeleteError(null);
    const supabase = createClient();

    // Refrescar sesión para obtener un access_token válido (evita 401 Invalid JWT si expiró)
    const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr || !refreshData?.session?.access_token) {
      setDeleteError('Sesión expirada. Recarga la página e inicia sesión de nuevo.');
      toast({ variant: 'error', title: 'Sesión expirada', message: 'Recarga la página e inicia sesión de nuevo.' });
      setDeleting(false);
      setConfirmDelete(false);
      return;
    }

    const { error: fnErr } = await supabase.functions.invoke('delete-shift', {
      body: { id: shift.id },
    });
    setDeleting(false);
    setConfirmDelete(false);
    if (fnErr) {
      const msg = String((fnErr as Error)?.message || 'Error al eliminar.');
      setDeleteError(msg);
      toast({ variant: 'error', title: 'No se pudo eliminar', message: msg });
      return;
    }
    onDeleted();
    onClose();
    toast({ variant: 'success', title: 'Turno eliminado', message: 'El turno fue eliminado.' });
  }, [shift, onDeleted, onClose, toast]);

  const onEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        onClose();
        return;
      }
      const panel = panelRef.current;
      if (open && panel) trapFocusWithin(e, panel);
    },
    [open, onClose]
  );

  useEffect(() => {
    if (!open) {
      setRequestModal(null);
      return;
    }
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [open, onEscape]);

  useEffect(() => {
    if (open) {
      lastFocusedElementRef.current =
        (typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null) ?? null;
      const t = window.setTimeout(() => {
        const panel = panelRef.current;
        if (!panel) return;
        const focusables = getFocusableElements(panel);
        (focusables[0] ?? panel).focus();
      }, 0);
      return () => window.clearTimeout(t);
    }
    lastFocusedElementRef.current?.focus?.();
  }, [open]);

  if (!open || !shift) return null;

  const t = shift.organization_shift_types;
  const typeName = t?.name ?? '—';
  const typeLetter = t?.letter ?? '?';
  const typeColor = t?.color ?? '#6B7280';
  const start = new Date(shift.start_at);
  const end = new Date(shift.end_at);
  const validDates = !isNaN(start.getTime()) && !isNaN(end.getTime());
  const dateLabel = validDates
    ? start.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
  const timeLabel = validDates
    ? `${start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} — ${end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
    : '—';
  const durationHours = validDates ? Math.max(0, (end.getTime() - start.getTime()) / 3_600_000) : 0;
  const durationLabel = durationHours > 0 ? `${durationHours < 10 ? Math.round(durationHours * 10) / 10 : Math.round(durationHours)}h` : '—';
  const isPublished = shift.status === 'published';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 md:items-center md:justify-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shift-detail-title"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
        aria-label="Cerrar"
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative flex w-full max-h-[88dvh] max-w-none flex-col overflow-hidden rounded-t-2xl border border-b-0 border-border bg-bg shadow-lg focus:outline-none md:max-h-[90dvh] md:max-w-md md:rounded-2xl md:border-b"
      >
        {/* Asa drag (mobile) */}
        <div className="flex shrink-0 justify-center pt-1.5 md:hidden">
          <span className="h-1 w-10 rounded-full bg-border" aria-hidden />
        </div>

        {/* Top header */}
        <div className="flex shrink-0 items-center justify-between px-4 pb-1.5 pt-1.5 md:pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-subtle-2 text-text-sec hover:text-text"
            aria-label="Cerrar"
          >
            <Icons.x size={20} />
          </button>
          <h2 id="shift-detail-title" className="tn-h text-[14px] font-bold text-text">
            Detalle del turno
          </h2>
          <span className="h-10 w-10" aria-hidden />
        </div>

        {/* Body scrollable */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {/* Banner del tipo */}
          <div
            className="relative overflow-hidden rounded-[18px] p-5 text-white"
            style={{ backgroundColor: typeColor }}
          >
            <svg
              width="120"
              height="120"
              viewBox="0 0 100 100"
              className="pointer-events-none absolute -right-[30px] -top-[30px] opacity-[0.14]"
              aria-hidden
            >
              <circle cx="50" cy="50" r="40" stroke="#fff" strokeWidth="1" fill="none" />
              <circle cx="50" cy="50" r="22" fill="#fff" />
            </svg>

            <div className="relative flex items-center gap-3">
              <span
                className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-white/[0.22] text-[26px] font-extrabold"
                style={{ fontFamily: "var(--font-inter-tight), var(--font-inter), sans-serif" }}
                aria-hidden
              >
                {typeLetter}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] opacity-85">
                  {typeName}
                </p>
                <h3 className="tn-h mt-0.5 truncate text-[22px] font-bold tracking-[-0.02em]">
                  {typeName}
                </h3>
              </div>
            </div>

            {/* Bloque glassy con fecha · horario · horas */}
            <div className="relative mt-3.5 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 rounded-[14px] bg-white/[0.14] px-3.5 py-3 backdrop-blur">
              <div className="min-w-0">
                <p className="text-[11px] opacity-80">FECHA</p>
                <p className="mt-0.5 truncate text-[13.5px] font-semibold">{dateLabel}</p>
              </div>
              <span className="h-7 w-px bg-white/[0.28]" aria-hidden />
              <div className="min-w-0">
                <p className="text-[11px] opacity-80">HORARIO</p>
                <p className="mt-0.5 truncate text-[13.5px] font-semibold">{timeLabel}</p>
              </div>
              <span className="h-7 w-px bg-white/[0.28]" aria-hidden />
              <div className="min-w-0">
                <p className="text-[11px] opacity-80">HORAS</p>
                <p className="mt-0.5 text-[13.5px] font-semibold">{durationLabel}</p>
              </div>
            </div>
          </div>

          {/* Info rows */}
          <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-subtle">
            <DetailRow
              icon={<Icons.user size={18} />}
              label="Asignado"
              value={assignedName?.trim() || 'Sin asignar'}
              trailing={isMine ? <Pill tone="primary">Tu turno</Pill> : null}
            />
            {shift.location?.trim() ? (
              <DetailRow
                icon={<Icons.pin size={18} />}
                label="Ubicación"
                value={shift.location}
              />
            ) : null}
            <DetailRow
              icon={<Icons.cross size={18} />}
              label="Estado"
              value={isPublished ? 'Publicado' : 'Borrador'}
              trailing={
                isPublished ? (
                  <span className="text-[11px] font-semibold text-green">● Activo</span>
                ) : (
                  <span className="text-[11px] font-semibold text-muted">● Borrador</span>
                )
              }
              last
            />
          </div>

          {deleteError ? (
            <p className="mt-3 text-sm text-red">{deleteError}</p>
          ) : null}
        </div>

        {/* Action bar fija */}
        <div
          className="flex shrink-0 items-center gap-2.5 border-t border-border bg-bg px-5 py-3"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          {canManageShifts ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setConfirmDelete(true);
                }}
                className="inline-flex h-[50px] flex-1 items-center justify-center gap-1.5 rounded-[14px] border border-red/55 bg-bg text-[13.5px] font-semibold text-red"
              >
                <Icons.x size={16} /> Eliminar
              </button>
              <button
                type="button"
                onClick={onEdit ?? undefined}
                className="inline-flex h-[50px] flex-[1.3] items-center justify-center gap-1.5 rounded-[14px] bg-primary text-[13.5px] font-bold text-white shadow-[0_8px_22px_-10px_var(--primary)]"
              >
                <Icons.settings size={16} /> Editar
              </button>
            </>
          ) : showRequestActions && isMine ? (
            <>
              <button
                type="button"
                onClick={() => setRequestModal('give_away')}
                className="inline-flex h-[50px] flex-1 items-center justify-center gap-1.5 rounded-[14px] border border-border bg-bg text-[13.5px] font-semibold text-text"
              >
                <Icons.giveaway size={16} /> Ceder turno
              </button>
              <button
                type="button"
                onClick={() => setRequestModal('swap')}
                className="inline-flex h-[50px] flex-[1.3] items-center justify-center gap-1.5 rounded-[14px] bg-primary text-[13.5px] font-bold text-white shadow-[0_8px_22px_-10px_var(--primary)]"
              >
                <Icons.swap size={16} /> Intercambiar
              </button>
            </>
          ) : showRequestActions && isOpen ? (
            <button
              type="button"
              onClick={() => setRequestModal('take_open')}
              className="inline-flex h-[50px] w-full items-center justify-center gap-1.5 rounded-[14px] bg-primary text-[13.5px] font-bold text-white shadow-[0_8px_22px_-10px_var(--primary)]"
            >
              <Icons.takeOpen size={16} /> Tomar turno
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-[50px] w-full items-center justify-center rounded-[14px] border border-border bg-bg text-[13.5px] font-semibold text-text"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
      <GiveAwayRequestModal
        open={requestModal === 'give_away'}
        onClose={() => setRequestModal(null)}
        onSuccess={() => {
          onRequestCreated?.();
          setRequestModal(null);
        }}
        shift={shift}
        currentUserId={currentUserId}
      />
      <TakeOpenRequestModal
        open={requestModal === 'take_open'}
        onClose={() => setRequestModal(null)}
        onSuccess={() => {
          onRequestCreated?.();
          setRequestModal(null);
        }}
        shift={shift}
        currentUserId={currentUserId}
      />
      <SwapRequestModal
        open={requestModal === 'swap'}
        onClose={() => setRequestModal(null)}
        onSuccess={() => {
          onRequestCreated?.();
          setRequestModal(null);
        }}
        shift={shift}
        currentUserId={currentUserId}
      />
      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={doDelete}
        title="Eliminar turno"
        message="¿Eliminar este turno? No se puede deshacer."
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}

/**
 * Fila de información dentro del bloque de detalle del turno.
 * Diseño: ref docs/design/screens/mobile.jsx Row (línea 489).
 */
function DetailRow({
  icon,
  label,
  value,
  trailing,
  last,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  value: React.ReactNode;
  trailing?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={
        'flex items-center gap-3 px-4 py-3.5 ' +
        (last ? '' : 'border-b border-border')
      }
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-bg text-muted">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] font-medium text-muted">{label}</p>
        <p className="mt-0.5 truncate text-[14px] font-semibold text-text">{value}</p>
      </div>
      {trailing}
    </div>
  );
}
