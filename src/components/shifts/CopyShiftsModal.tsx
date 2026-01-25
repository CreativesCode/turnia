'use client';

/**
 * Modal para copiar turnos de un período a otro.
 * Período origen (source_from..source_to) → período destino (target_start en adelante, mismo desplazamiento en días).
 * Opción: copiar asignaciones o dejar sin asignar.
 * @see project-roadmap.md Módulo 3.3
 */

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orgId: string;
};

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function CopyShiftsModal({ open, onClose, onSuccess, orgId }: Props) {
  const [sourceFrom, setSourceFrom] = useState('');
  const [sourceTo, setSourceTo] = useState('');
  const [targetStart, setTargetStart] = useState('');
  const [copyAssignments, setCopyAssignments] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const base = new Date();
      const monday = new Date(base);
      monday.setDate(base.getDate() - base.getDay() + 1);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setSourceFrom(toDateString(monday));
      setSourceTo(toDateString(sunday));
      const nextMonday = new Date(monday);
      nextMonday.setDate(monday.getDate() + 7);
      setTargetStart(toDateString(nextMonday));
      setCopyAssignments(true);
      setError(null);
    }
  }, [open]);

  const handleSubmit = useCallback(async () => {
    if (!sourceFrom || !sourceTo || !targetStart) {
      setError('Completa las fechas.');
      return;
    }
    const srcFrom = new Date(sourceFrom + 'T00:00:00');
    const srcTo = new Date(sourceTo + 'T23:59:59.999');
    if (srcFrom > srcTo) {
      setError('La fecha fin origen debe ser posterior o igual a la de inicio.');
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr || !refreshData?.session?.access_token) {
      setError('Sesión expirada. Recarga e inicia sesión.');
      setLoading(false);
      return;
    }
    const { data, error: fnErr } = await supabase.functions.invoke('copy-shifts', {
      body: {
        org_id: orgId,
        source_from: srcFrom.toISOString(),
        source_to: srcTo.toISOString(),
        target_start: new Date(targetStart + 'T00:00:00').toISOString(),
        copy_assignments: copyAssignments,
      },
    });
    setLoading(false);
    const json = (data ?? {}) as { ok?: boolean; error?: string; copied?: number };
    if (fnErr || json.error) {
      setError(String(json.error || (fnErr as Error)?.message || 'Error al copiar'));
      return;
    }
    onSuccess();
    onClose();
  }, [orgId, sourceFrom, sourceTo, targetStart, copyAssignments, onSuccess, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Cerrar"
      />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-text-primary">Copiar período</h2>
        <p className="mt-1 text-sm text-muted">
          Copia los turnos del período origen al destino. El desplazamiento en días se aplica a cada turno.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary">Inicio período origen</label>
            <input
              type="date"
              value={sourceFrom}
              onChange={(e) => setSourceFrom(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary">Fin período origen</label>
            <input
              type="date"
              value={sourceTo}
              onChange={(e) => setSourceTo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary">Inicio período destino</label>
            <input
              type="date"
              value={targetStart}
              onChange={(e) => setTargetStart(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={copyAssignments}
              onChange={(e) => setCopyAssignments(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-sm text-text-primary">Copiar asignaciones de usuario</span>
          </label>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-subtle-bg"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="min-h-[44px] rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? 'Copiando…' : 'Copiar'}
          </button>
        </div>
      </div>
    </div>
  );
}
