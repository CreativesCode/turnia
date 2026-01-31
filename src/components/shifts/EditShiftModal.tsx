'use client';

/**
 * Modal para editar un turno. Solo se elige la fecha; la hora de inicio y fin se obtienen del tipo de turno.
 * Incluye botón Eliminar con confirmación.
 * @see project-roadmap.md Módulo 3.2
 */

import { createClient } from '@/lib/supabase/client';
import { formatShiftTypeSchedule } from '@/lib/utils';
import { useCallback, useEffect, useState } from 'react';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import type { ShiftWithType } from '@/components/calendar/ShiftCalendar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/toast/ToastProvider';

type ShiftTypeOption = { id: string; name: string; letter: string; start_time: string | null; end_time: string | null };
type MemberOption = { user_id: string; full_name: string | null };

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function buildStartEndISO(
  date: string,
  startTime: string | null,
  endTime: string | null
): { start_at: string; end_at: string } {
  const st = (startTime || '08:00').toString().substring(0, 5);
  const etRaw = (endTime || '16:00').toString().substring(0, 5);
  const start_at = new Date(`${date}T${st}:00`).toISOString();
  let endDate = date;
  let et = etRaw;
  if (etRaw === '24:00' || etRaw.startsWith('24:')) {
    endDate = addDays(date, 1);
    et = '00:00';
  } else if (etRaw < st) {
    endDate = addDays(date, 1);
    et = etRaw;
  }
  const end_at = new Date(`${endDate}T${et}:00`).toISOString();
  return { start_at, end_at };
}

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onDeleted: () => void;
  orgId: string;
  shift: ShiftWithType | null;
};

export function EditShiftModal({
  open,
  onClose,
  onSuccess,
  onDeleted,
  orgId,
  shift,
}: Props) {
  const { toast } = useToast();
  const [shiftTypes, setShiftTypes] = useState<ShiftTypeOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [date, setDate] = useState('');
  const [shiftTypeId, setShiftTypeId] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open && shift) {
      const d = new Date(shift.start_at);
      setDate(toDateString(isNaN(d.getTime()) ? new Date() : d));
      setShiftTypeId(shift.shift_type_id);
      setAssignedUserId(shift.assigned_user_id ?? '');
      setLocation(shift.location ?? '');
      setStatus(shift.status === 'published' ? 'published' : 'draft');
      setError(null);
    }
  }, [open, shift]);

  useEffect(() => {
    if (!open || !orgId) return;
    const supabase = createClient();
    Promise.all([
      supabase
        .from('organization_shift_types')
        .select('id, name, letter, start_time, end_time')
        .eq('org_id', orgId)
        .order('sort_order')
        .order('name'),
      supabase.from('memberships').select('user_id').eq('org_id', orgId),
    ]).then(([stRes, mRes]) => {
      setShiftTypes((stRes.data ?? []) as ShiftTypeOption[]);
      const userIds = (mRes.data ?? []).map((r: { user_id: string }) => r.user_id);
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
            (data ?? []).map((p: { id: string; full_name: string | null }) => ({
              user_id: p.id,
              full_name: p.full_name,
            }))
          );
        });
    });
  }, [open, orgId]);

  const onEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && !loading && !deleting) onClose();
    },
    [open, loading, deleting, onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [open, onEscape]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!shift) return;
      setError(null);
      if (!shiftTypeId) {
        setError('Selecciona un tipo de turno.');
        toast({ variant: 'error', title: 'Falta información', message: 'Selecciona un tipo de turno.' });
        return;
      }
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        setError('Selecciona una fecha.');
        toast({ variant: 'error', title: 'Falta información', message: 'Selecciona una fecha.' });
        return;
      }
      const st = shiftTypes.find((t) => t.id === shiftTypeId);
      const { start_at, end_at } = buildStartEndISO(
        date,
        st?.start_time ?? null,
        st?.end_time ?? null
      );

      // Validar conflictos (overlap, disponibilidad, descanso) si hay usuario asignado; min_rest_hours desde org_settings
      if (assignedUserId) {
        const supabase = createClient();
        const { data: os } = await supabase.from('org_settings').select('min_rest_hours').eq('org_id', orgId).maybeSingle();
        const minRest = (os as { min_rest_hours?: number } | null)?.min_rest_hours ?? 0;
        const { data: rpc, error: rpcErr } = await supabase.rpc('check_shift_conflicts', {
          p_user_id: assignedUserId,
          p_start_at: start_at,
          p_end_at: end_at,
          p_exclude_shift_id: shift.id,
          p_org_id: orgId,
          p_min_rest_hours: minRest,
        });
        if (!rpcErr) {
          const row = Array.isArray(rpc) ? rpc[0] : rpc;
          if (row?.has_conflict && row?.message) {
            setError(row.message);
            toast({ variant: 'error', title: 'Conflicto detectado', message: row.message });
            return;
          }
        }
      }

      setLoading(true);
      const supabase = createClient();

      // Refrescar sesión para obtener un access_token válido (evita 401 Invalid JWT si expiró)
      const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr || !refreshData?.session?.access_token) {
        setError('Sesión expirada. Recarga la página e inicia sesión de nuevo.');
        toast({ variant: 'error', title: 'Sesión expirada', message: 'Recarga la página e inicia sesión de nuevo.' });
        setLoading(false);
        return;
      }

      const { data, error: fnErr } = await supabase.functions.invoke('update-shift', {
        body: {
          id: shift.id,
          shift_type_id: shiftTypeId,
          start_at,
          end_at,
          assigned_user_id: assignedUserId || null,
          location: location.trim() || null,
          status,
        },
      });
      setLoading(false);
      const json = (data ?? {}) as { ok?: boolean; error?: string };
      if (fnErr || !json.ok) {
        const msg = String(json.error || (fnErr as Error)?.message || 'Error al guardar.');
        setError(msg);
        toast({ variant: 'error', title: 'No se pudo guardar', message: msg });
        return;
      }
      onSuccess();
      onClose();
      toast({ variant: 'success', title: 'Turno actualizado', message: 'Los cambios se guardaron.' });
    },
    [shift, shiftTypeId, date, shiftTypes, assignedUserId, location, status, onSuccess, onClose, toast]
  );

  const doDelete = useCallback(async () => {
    if (!shift) return;
    setDeleting(true);
    setError(null);
    const supabase = createClient();

    // Refrescar sesión para obtener un access_token válido (evita 401 Invalid JWT si expiró)
    const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr || !refreshData?.session?.access_token) {
      setError('Sesión expirada. Recarga la página e inicia sesión de nuevo.');
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
      setError(msg);
      toast({ variant: 'error', title: 'No se pudo eliminar', message: msg });
      return;
    }
    onDeleted();
    onClose();
    toast({ variant: 'success', title: 'Turno eliminado', message: 'El turno fue eliminado.' });
  }, [shift, onDeleted, onClose, toast]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-shift-title"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute inset-0 bg-black/50"
          aria-label="Cerrar"
        />
        <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-background p-6 shadow-lg">
          <h2 id="edit-shift-title" className="text-lg font-semibold text-text-primary">
            Editar turno
          </h2>
          <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
            <label className="block text-sm font-medium text-text-secondary">
              Fecha
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="mt-1.5"
              />
            </label>
            <label className="block text-sm font-medium text-text-secondary">
              Tipo de turno
              <Select
                value={shiftTypeId}
                onChange={(e) => setShiftTypeId(e.target.value)}
                required
                className="mt-1.5"
              >
                {shiftTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.letter})
                  </option>
                ))}
              </Select>
              {shiftTypeId && (() => {
                const t = shiftTypes.find((x) => x.id === shiftTypeId);
                const s = formatShiftTypeSchedule(t?.start_time ?? null, t?.end_time ?? null);
                return s !== '—' ? (
                  <p className="mt-1 text-xs text-muted">Horario: {s}</p>
                ) : (
                  <p className="mt-1 text-xs text-muted">Horario: 08:00–16:00 (por defecto)</p>
                );
              })()}
            </label>
            <label className="block text-sm font-medium text-text-secondary">
              Asignar a
              <Select
                value={assignedUserId}
                onChange={(e) => setAssignedUserId(e.target.value)}
                className="mt-1.5"
              >
                <option value="">Sin asignar</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.full_name?.trim() || m.user_id}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block text-sm font-medium text-text-secondary">
              Ubicación
              <Input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Opcional"
                className="mt-1.5"
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={status === 'published'}
                onChange={(e) => setStatus(e.target.checked ? 'published' : 'draft')}
                className="h-4 w-4 rounded border-border"
              />
              <span className="text-sm font-medium text-text-secondary">Publicado</span>
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmDelete(true)}
                  disabled={loading}
                  className="px-2 text-red-600 hover:bg-red-50"
                >
                  Eliminar turno
                </Button>
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={onClose} disabled={loading}>
                  Cancelar
                </Button>
                <Button type="submit" loading={loading}>
                  Guardar
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>

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
    </>
  );
}
