'use client';

/**
 * Modal para crear un turno.
 * Solo se elige la fecha; la hora de inicio y fin se obtienen del tipo de turno (organization_shift_types).
 * @see project-roadmap.md Módulo 3.2
 */

import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { createClient } from '@/lib/supabase/client';
import { formatShiftTypeSchedule } from '@/lib/utils';
import { useCallback, useEffect, useState } from 'react';

type ShiftTypeOption = {
  id: string;
  name: string;
  letter: string;
  color: string;
  start_time: string | null;
  end_time: string | null;
};

type MemberOption = {
  user_id: string;
  full_name: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orgId: string;
  initialDate?: Date;
};

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

/**
 * Calcula start_at y end_at en ISO a partir de una fecha (YYYY-MM-DD) y el horario del tipo.
 * - 24:00 → fin al día siguiente 00:00
 * - overnight (end < start) → fin al día siguiente
 * - Si start/end son null → 08:00 y 16:00
 */
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

export function CreateShiftModal({
  open,
  onClose,
  onSuccess,
  orgId,
  initialDate,
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

  useEffect(() => {
    if (open) {
      const base = initialDate ? new Date(initialDate) : new Date();
      setDate(toDateString(base));
      setAssignedUserId('');
      setLocation('');
      setStatus('draft');
      setError(null);
    }
  }, [open, initialDate]);

  useEffect(() => {
    if (!open || !orgId) return;
    const supabase = createClient();
    Promise.all([
      supabase
        .from('organization_shift_types')
        .select('id, name, letter, color, start_time, end_time')
        .eq('org_id', orgId)
        .order('sort_order')
        .order('name'),
      supabase
        .from('memberships')
        .select('user_id')
        .eq('org_id', orgId),
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

  useEffect(() => {
    if (open && shiftTypes.length > 0 && !shiftTypeId) {
      setShiftTypeId(shiftTypes[0].id);
    }
  }, [open, shiftTypes, shiftTypeId]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
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
          p_exclude_shift_id: null,
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

      const { data, error: fnErr } = await supabase.functions.invoke('create-shift', {
        body: {
          org_id: orgId,
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
        const msg = String(json.error || (fnErr as Error)?.message || 'Error al crear el turno.');
        setError(msg);
        toast({ variant: 'error', title: 'No se pudo crear', message: msg });
        return;
      }
      onSuccess();
      onClose();
      toast({ variant: 'success', title: 'Turno creado', message: 'El turno se creó correctamente.' });
    },
    [shiftTypeId, date, shiftTypes, assignedUserId, location, status, orgId, onSuccess, onClose, toast]
  );

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      closeOnEscape={!loading}
      title="Nuevo turno"
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
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
            <option value="">— Selecciona —</option>
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
          <span className="text-sm font-medium text-text-secondary">Publicar (visible para todos)</span>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            Crear
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
