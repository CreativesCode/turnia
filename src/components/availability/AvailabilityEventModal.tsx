'use client';

/**
 * Modal para crear o editar un evento de disponibilidad (vacaciones, licencia, etc.).
 * Solo el propio usuario puede crear/editar/eliminar sus eventos (RLS).
 * @see project-roadmap.md Módulo 6.1
 */

import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useState } from 'react';

export type AvailabilityEventType = 'vacation' | 'sick_leave' | 'training' | 'unavailable';

export type AvailabilityEvent = {
  id: string;
  org_id: string;
  user_id: string;
  type: string;
  start_at: string;
  end_at: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};

const AVAILABILITY_TYPE_OPTIONS: { value: AvailabilityEventType; label: string }[] = [
  { value: 'vacation', label: 'Vacaciones' },
  { value: 'sick_leave', label: 'Licencia médica' },
  { value: 'training', label: 'Capacitación' },
  { value: 'unavailable', label: 'No disponible' },
];

const TYPE_COLORS: Record<string, string> = {
  vacation: '#22c55e',
  sick_leave: '#ef4444',
  training: '#3b82f6',
  unavailable: '#6b7280',
};

export function getTypeLabel(t: string): string {
  return AVAILABILITY_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;
}

export function getTypeColor(t: string): string {
  return TYPE_COLORS[t] ?? '#6b7280';
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDateLocal(isoDate: string): Date {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** start_at: 00:00:00 local del día; end_at: 23:59:59.999 local del día */
function toStartEndISO(startYmd: string, endYmd: string): { start_at: string; end_at: string } {
  const [sy, sm, sd] = startYmd.split('-').map(Number);
  const [ey, em, ed] = endYmd.split('-').map(Number);
  const start_at = new Date(sy, sm - 1, sd).toISOString();
  const end_at = new Date(ey, em - 1, ed, 23, 59, 59, 999).toISOString();
  return { start_at, end_at };
}

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orgId: string;
  userId: string;
  editEvent: AvailabilityEvent | null;
  initialStart?: Date;
};

export function AvailabilityEventModal({
  open,
  onClose,
  onSuccess,
  orgId,
  userId,
  editEvent,
  initialStart,
}: Props) {
  const [type, setType] = useState<AvailabilityEventType>('vacation');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isEdit = !!editEvent;

  useEffect(() => {
    if (open) {
      setError(null);
      setDeleting(false);
      if (editEvent) {
        setType((editEvent.type as AvailabilityEventType) || 'vacation');
        setStartDate(toDateString(parseDateLocal(editEvent.start_at)));
        setEndDate(toDateString(parseDateLocal(editEvent.end_at)));
        setNote(editEvent.note ?? '');
      } else {
        const base = initialStart ? new Date(initialStart) : new Date();
        const d = toDateString(base);
        setType('vacation');
        setStartDate(d);
        setEndDate(d);
        setNote('');
      }
    }
  }, [open, editEvent, initialStart]);

  const validate = useCallback((): boolean => {
    if (!startDate || !endDate) {
      setError('Indica fecha de inicio y fin.');
      return false;
    }
    const s = new Date(startDate).getTime();
    const e = new Date(endDate).getTime();
    if (e < s) {
      setError('La fecha de fin debe ser igual o posterior al inicio.');
      return false;
    }
    return true;
  }, [startDate, endDate]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!validate()) return;
      setLoading(true);
      const supabase = createClient();
      const { start_at, end_at } = toStartEndISO(startDate, endDate);

      if (isEdit) {
        const { error: err } = await supabase
          .from('availability_events')
          .update({ type, start_at, end_at, note: note.trim() || null, updated_at: new Date().toISOString() })
          .eq('id', editEvent.id);
        if (err) {
          setError(err.message);
          setLoading(false);
          return;
        }
      } else {
        const { error: err } = await supabase.from('availability_events').insert({
          org_id: orgId,
          user_id: userId,
          type,
          start_at,
          end_at,
          note: note.trim() || null,
        });
        if (err) {
          setError(err.message);
          setLoading(false);
          return;
        }
      }
      setLoading(false);
      onSuccess();
      onClose();
    },
    [isEdit, editEvent, orgId, userId, type, startDate, endDate, note, validate, onSuccess, onClose]
  );

  const handleDelete = useCallback(async () => {
    if (!editEvent || !confirm('¿Eliminar este evento de disponibilidad?')) return;
    setDeleting(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from('availability_events').delete().eq('id', editEvent.id);
    setDeleting(false);
    if (err) {
      setError(err.message);
      return;
    }
    onSuccess();
    onClose();
  }, [editEvent, onSuccess, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-lg">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-lg font-semibold text-text-primary">
            {isEdit ? 'Editar disponibilidad' : 'Agregar disponibilidad'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Tipo</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AvailabilityEventType)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary"
              required
            >
              {AVAILABILITY_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">Desde</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">Hasta</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Nota (opcional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary resize-none"
              placeholder="Ej. Vacaciones familiares"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="min-h-[44px] rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {loading ? 'Guardando…' : isEdit ? 'Guardar' : 'Agregar'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-subtle-bg"
            >
              Cancelar
            </button>
            {isEdit && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="min-h-[44px] ml-auto rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
              >
                {deleting ? 'Eliminando…' : 'Eliminar'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
