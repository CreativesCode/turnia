'use client';

/**
 * Formulario de configuraciones de la organización: aprobaciones, descanso mínimo, etc.
 * Solo org_admin y superadmin pueden guardar (RLS).
 * @see project-roadmap.md Módulo 9.3
 */

import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useState } from 'react';

export type OrgSettingsRow = {
  org_id: string;
  allow_self_assign_open_shifts: boolean;
  require_approval_for_swaps: boolean;
  require_approval_for_give_aways: boolean;
  min_rest_hours: number;
  settings_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

const DEFAULTS: Omit<OrgSettingsRow, 'org_id' | 'created_at' | 'updated_at'> = {
  allow_self_assign_open_shifts: true,
  require_approval_for_swaps: true,
  require_approval_for_give_aways: true,
  min_rest_hours: 0,
  settings_json: {},
};

type Props = {
  orgId: string;
  canEdit: boolean;
  onSaved?: () => void;
};

export function OrgSettingsForm({ orgId, canEdit, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [allowSelfAssign, setAllowSelfAssign] = useState(DEFAULTS.allow_self_assign_open_shifts);
  const [requireApprovalSwaps, setRequireApprovalSwaps] = useState(DEFAULTS.require_approval_for_swaps);
  const [requireApprovalGiveAways, setRequireApprovalGiveAways] = useState(DEFAULTS.require_approval_for_give_aways);
  const [minRestHours, setMinRestHours] = useState(DEFAULTS.min_rest_hours);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from('org_settings')
      .select('allow_self_assign_open_shifts, require_approval_for_swaps, require_approval_for_give_aways, min_rest_hours')
      .eq('org_id', orgId)
      .maybeSingle();
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    const row = data as Partial<OrgSettingsRow> | null;
    if (row) {
      setAllowSelfAssign(row.allow_self_assign_open_shifts ?? DEFAULTS.allow_self_assign_open_shifts);
      setRequireApprovalSwaps(row.require_approval_for_swaps ?? DEFAULTS.require_approval_for_swaps);
      setRequireApprovalGiveAways(row.require_approval_for_give_aways ?? DEFAULTS.require_approval_for_give_aways);
      setMinRestHours(typeof row.min_rest_hours === 'number' ? row.min_rest_hours : DEFAULTS.min_rest_hours);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canEdit) return;
      setError(null);
      setSuccess(null);
      setSaving(true);
      const supabase = createClient();
      const { error: err } = await supabase
        .from('org_settings')
        .upsert(
          {
            org_id: orgId,
            allow_self_assign_open_shifts: allowSelfAssign,
            require_approval_for_swaps: requireApprovalSwaps,
            require_approval_for_give_aways: requireApprovalGiveAways,
            min_rest_hours: Math.max(0, minRestHours),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'org_id' }
        );
      setSaving(false);
      if (err) {
        setError(err.message);
        return;
      }
      setSuccess('Configuración guardada.');
      setTimeout(() => setSuccess(null), 2500);
      onSaved?.();
    },
    [orgId, canEdit, allowSelfAssign, requireApprovalSwaps, requireApprovalGiveAways, minRestHours, onSaved]
  );

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-background p-6">
        <p className="text-sm text-muted">Cargando configuración…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800" role="status">
          {success}
        </div>
      )}

      <div className="rounded-xl border border-border bg-background p-4 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Solicitudes y asignación</h3>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={allowSelfAssign}
            onChange={(e) => setAllowSelfAssign(e.target.checked)}
            disabled={!canEdit}
            className="h-4 w-4 rounded border-border"
          />
          <span className="text-sm text-text-primary">Permitir autoasignarse turnos abiertos (take open sin aprobación previa)</span>
        </label>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={requireApprovalSwaps}
            onChange={(e) => setRequireApprovalSwaps(e.target.checked)}
            disabled={!canEdit}
            className="h-4 w-4 rounded border-border"
          />
          <span className="text-sm text-text-primary">Requerir aprobación del manager para intercambios (swap)</span>
        </label>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={requireApprovalGiveAways}
            onChange={(e) => setRequireApprovalGiveAways(e.target.checked)}
            disabled={!canEdit}
            className="h-4 w-4 rounded border-border"
          />
          <span className="text-sm text-text-primary">Requerir aprobación del manager para dar de baja un turno (give away)</span>
        </label>
      </div>

      <div className="rounded-xl border border-border bg-background p-4 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Reglas de descanso</h3>
        <div>
          <label htmlFor="min_rest_hours" className="mb-1 block text-sm font-medium text-text-secondary">
            Descanso mínimo entre turnos (horas)
          </label>
          <input
            id="min_rest_hours"
            type="number"
            min={0}
            max={48}
            value={minRestHours}
            onChange={(e) => setMinRestHours(parseInt(e.target.value, 10) || 0)}
            disabled={!canEdit}
            className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary disabled:opacity-60"
          />
          <p className="mt-1 text-xs text-muted">Se usará al validar conflictos al crear o editar turnos. 0 = no comprobar.</p>
        </div>
      </div>

      {canEdit && (
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      )}

      {!canEdit && (
        <p className="text-sm text-muted">Solo org_admin y superadmin pueden editar la configuración.</p>
      )}
    </form>
  );
}
