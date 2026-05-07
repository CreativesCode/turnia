'use client';

import { Switch } from '@/components/ui/Switch';
import { Spinner } from '@/components/ui/Spinner';
import { CheckIcon } from '@/components/ui/icons';
import { createClient } from '@/lib/supabase/client';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';

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

const REST_PRESETS = [0, 8, 10, 12, 14, 16] as const;

export type SettingsSection = 'approvals' | 'rest' | 'notifications' | 'integrations' | 'security' | 'billing';

type Props = {
  orgId: string;
  canEdit: boolean;
  section?: SettingsSection;
  onSaved?: () => void;
};

export function OrgSettingsForm({ orgId, canEdit, section = 'approvals', onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const [allowSelfAssign, setAllowSelfAssign] = useState(DEFAULTS.allow_self_assign_open_shifts);
  const [requireApprovalSwaps, setRequireApprovalSwaps] = useState(DEFAULTS.require_approval_for_swaps);
  const [requireApprovalGiveAways, setRequireApprovalGiveAways] = useState(DEFAULTS.require_approval_for_give_aways);
  const [minRestHours, setMinRestHours] = useState(DEFAULTS.min_rest_hours);

  const swrKey = useMemo(() => ['orgSettings', orgId] as const, [orgId]);
  const fetcher = useCallback(async (): Promise<Partial<OrgSettingsRow> | null> => {
    if (!orgId) return null;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('org_settings')
      .select(
        'allow_self_assign_open_shifts, require_approval_for_swaps, require_approval_for_give_aways, min_rest_hours',
      )
      .eq('org_id', orgId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as Partial<OrgSettingsRow> | null) ?? null;
  }, [orgId]);

  const { data, error: swrError, isLoading, isValidating, mutate } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
  });

  useEffect(() => {
    const row = data;
    if (!row) {
      setAllowSelfAssign(DEFAULTS.allow_self_assign_open_shifts);
      setRequireApprovalSwaps(DEFAULTS.require_approval_for_swaps);
      setRequireApprovalGiveAways(DEFAULTS.require_approval_for_give_aways);
      setMinRestHours(DEFAULTS.min_rest_hours);
      return;
    }
    setAllowSelfAssign(row.allow_self_assign_open_shifts ?? DEFAULTS.allow_self_assign_open_shifts);
    setRequireApprovalSwaps(row.require_approval_for_swaps ?? DEFAULTS.require_approval_for_swaps);
    setRequireApprovalGiveAways(row.require_approval_for_give_aways ?? DEFAULTS.require_approval_for_give_aways);
    setMinRestHours(typeof row.min_rest_hours === 'number' ? row.min_rest_hours : DEFAULTS.min_rest_hours);
  }, [orgId, data]);

  const realtimeTimerRef = useRef<number | null>(null);
  const scheduleRealtimeRefresh = useCallback(() => {
    if (realtimeTimerRef.current) window.clearTimeout(realtimeTimerRef.current);
    realtimeTimerRef.current = window.setTimeout(() => void mutate(), 250);
  }, [mutate]);

  useEffect(() => {
    if (!orgId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`turnia:org_settings:${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'org_settings', filter: `org_id=eq.${orgId}` },
        () => scheduleRealtimeRefresh(),
      )
      .subscribe();
    return () => {
      if (realtimeTimerRef.current) {
        window.clearTimeout(realtimeTimerRef.current);
        realtimeTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [orgId, scheduleRealtimeRefresh]);

  const save = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!canEdit) return;
      setSuccess(null);
      setSaving(true);
      const supabase = createClient();
      const { error: err } = await supabase.from('org_settings').upsert(
        {
          org_id: orgId,
          allow_self_assign_open_shifts: allowSelfAssign,
          require_approval_for_swaps: requireApprovalSwaps,
          require_approval_for_give_aways: requireApprovalGiveAways,
          min_rest_hours: Math.max(0, minRestHours),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'org_id' },
      );
      setSaving(false);
      if (err) {
        await mutate();
        return;
      }
      setSuccess('Configuración guardada.');
      setTimeout(() => setSuccess(null), 2500);
      onSaved?.();
    },
    [
      orgId,
      canEdit,
      allowSelfAssign,
      requireApprovalSwaps,
      requireApprovalGiveAways,
      minRestHours,
      onSaved,
      mutate,
    ],
  );

  const loading = isLoading || (isValidating && data == null);
  const error = swrError ? String((swrError as Error).message ?? swrError) : null;

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-bg p-6">
        <p className="text-sm text-text-sec">Cargando configuración…</p>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {error && (
        <div className="rounded-xl border border-border bg-subtle-bg p-3 text-[13px] text-red" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div
          className="flex items-center gap-2 rounded-xl border p-3 text-[13px] text-green"
          style={{
            background: 'color-mix(in oklab, var(--green) 10%, transparent)',
            borderColor: 'color-mix(in oklab, var(--green) 30%, var(--color-border))',
          }}
          role="status"
        >
          <CheckIcon size={14} stroke={2.6} /> {success}
        </div>
      )}

      {section === 'approvals' ? (
        <div className="rounded-2xl border border-border bg-bg p-5">
          <h3 className="tn-h text-[15px] font-bold">Aprobaciones</h3>
          <p className="mt-1 text-[12.5px] text-muted">
            Define qué solicitudes requieren aprobación del manager antes de aplicarse.
          </p>
          <div className="mt-4 divide-y divide-border">
            <RuleRow
              title="Autoasignar turnos abiertos"
              description="Permitir que los miembros tomen turnos abiertos sin aprobación previa."
              checked={allowSelfAssign}
              disabled={!canEdit}
              onChange={setAllowSelfAssign}
            />
            <RuleRow
              title="Aprobación para intercambios"
              description="Requerir validación del manager antes de procesar un swap."
              checked={requireApprovalSwaps}
              disabled={!canEdit}
              onChange={setRequireApprovalSwaps}
            />
            <RuleRow
              title="Aprobación para cesiones"
              description="Requerir validación del manager para ceder un turno (give away)."
              checked={requireApprovalGiveAways}
              disabled={!canEdit}
              onChange={setRequireApprovalGiveAways}
            />
          </div>
        </div>
      ) : null}

      {section === 'rest' ? (
        <div className="rounded-2xl border border-border bg-bg p-5">
          <h3 className="tn-h text-[15px] font-bold">Descanso mínimo entre turnos</h3>
          <p className="mt-1 text-[12.5px] text-muted">
            Se usará al validar conflictos al crear o editar turnos. Selecciona <b>Sin regla</b> para no comprobar.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {REST_PRESETS.map((h) => {
              const active = minRestHours === h;
              return (
                <button
                  type="button"
                  key={h}
                  disabled={!canEdit}
                  onClick={() => setMinRestHours(h)}
                  className={
                    'h-12 rounded-xl text-[13px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ' +
                    (active
                      ? 'bg-primary text-white shadow-[0_4px_12px_-6px_var(--color-primary)]'
                      : 'border border-border bg-bg text-text hover:bg-subtle-2')
                  }
                >
                  {h === 0 ? 'Sin regla' : `${h}h`}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-xl bg-subtle-bg p-3">
            <label htmlFor="min_rest_custom" className="text-[12.5px] font-semibold text-text-sec">
              Personalizado
            </label>
            <input
              id="min_rest_custom"
              type="number"
              min={0}
              max={48}
              value={minRestHours}
              onChange={(e) => setMinRestHours(Math.max(0, parseInt(e.target.value, 10) || 0))}
              disabled={!canEdit}
              className="h-9 w-20 rounded-lg border border-border bg-bg px-2 text-center text-sm text-text disabled:opacity-60"
            />
            <span className="text-[12.5px] text-muted">horas</span>
          </div>
        </div>
      ) : null}

      {section === 'notifications' ? (
        <PlaceholderSection
          title="Notificaciones"
          description="Control de qué eventos disparan notificaciones por email y push."
          items={[
            'Resumen diario al manager',
            'Aviso de turno vacante (24h antes)',
            'Recordatorio de turno propio',
            'Cambios pendientes de aprobación',
          ]}
        />
      ) : null}

      {section === 'integrations' ? (
        <PlaceholderSection
          title="Integraciones"
          description="Conexión con calendarios externos y herramientas del equipo."
          items={['Google Calendar', 'Outlook / Microsoft 365', 'Slack', 'Webhooks']}
        />
      ) : null}

      {section === 'security' ? (
        <PlaceholderSection
          title="Seguridad"
          description="Política de contraseñas, doble factor y sesiones activas."
          items={['2FA obligatorio para admins', 'Tiempo de sesión máximo', 'Bloqueo por intentos fallidos']}
        />
      ) : null}

      {section === 'billing' ? (
        <PlaceholderSection
          title="Facturación"
          description="Plan, miembros activos y método de pago."
          items={['Plan actual: Starter', 'Cambiar plan', 'Facturas y recibos']}
        />
      ) : null}

      {(section === 'approvals' || section === 'rest') && canEdit ? (
        <div className="flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={saving}
            className="relative inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-[14px] font-bold text-white shadow-[0_8px_22px_-10px_var(--color-primary)] transition-opacity disabled:opacity-60"
          >
            {saving ? <Spinner aria-label="Guardando" /> : null}
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      ) : null}

      {!canEdit && (section === 'approvals' || section === 'rest') ? (
        <p className="text-[12.5px] text-muted">Solo org_admin y superadmin pueden editar la configuración.</p>
      ) : null}
    </form>
  );
}

function RuleRow({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold text-text">{title}</div>
        <div className="mt-0.5 text-[12px] leading-snug text-muted">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} ariaLabel={title} />
    </div>
  );
}

function PlaceholderSection({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-bg p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="tn-h text-[15px] font-bold">{title}</h3>
        <span className="rounded-full bg-subtle-2 px-2.5 py-0.5 text-[10.5px] font-bold uppercase text-text-sec">
          Próximamente
        </span>
      </div>
      <p className="mt-1 text-[12.5px] text-muted">{description}</p>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2 text-[13px] text-text-sec">
            <span className="h-1.5 w-1.5 rounded-full bg-muted/50" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
