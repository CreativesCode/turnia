'use client';

/**
 * Modal para solicitar permiso (días no trabajar, fraccionar turno).
 * Flujo tipo wizard:
 * 1. Tipo de permiso (días / fraccionar turno)
 * 2. Organización(es)
 * 3. Tipo de solicitud
 * 4. Rango de fechas
 * 5. Motivo
 */

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/toast/ToastProvider';

export type PermissionScopeType = 'days' | 'fraction_shift';
export type PermissionRequestType =
  | 'administrativo'
  | 'capacitacion'
  | 'descanso_compensatorio'
  | 'descanso_reparatorio'
  | 'licencia_medica'
  | 'no_disponible'
  | 'permisos_especiales'
  | 'vacaciones';

export const PERMISSION_SCOPE_OPTIONS: { value: PermissionScopeType; label: string }[] = [
  { value: 'days', label: 'Por unos o varios días' },
  { value: 'fraction_shift', label: 'Fraccionar un turno específico' },
];

export const PERMISSION_REQUEST_TYPE_OPTIONS: { value: PermissionRequestType; label: string }[] = [
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'capacitacion', label: 'Capacitación' },
  { value: 'descanso_compensatorio', label: 'Descanso compensatorio' },
  { value: 'descanso_reparatorio', label: 'Descanso reparatorio' },
  { value: 'licencia_medica', label: 'Licencia médica' },
  { value: 'no_disponible', label: 'No disponible' },
  { value: 'permisos_especiales', label: 'Permisos especiales' },
  { value: 'vacaciones', label: 'Vacaciones' },
];

type OrgOption = { id: string; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentUserId: string | null;
};

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toStartEndISO(startYmd: string, endYmd: string): { start_at: string; end_at: string } {
  const [sy, sm, sd] = startYmd.split('-').map(Number);
  const [ey, em, ed] = endYmd.split('-').map(Number);
  const start_at = new Date(sy, sm - 1, sd).toISOString();
  const end_at = new Date(ey, em - 1, ed, 23, 59, 59, 999).toISOString();
  return { start_at, end_at };
}

export function PermissionRequestModal({ open, onClose, onSuccess, currentUserId }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [permissionScopeType, setPermissionScopeType] = useState<PermissionScopeType>('days');
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([]);
  const [requestType, setRequestType] = useState<PermissionRequestType>('vacaciones');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalSteps = 5;

  const resetForm = useCallback(() => {
    setStep(1);
    setPermissionScopeType('days');
    setSelectedOrgIds([]);
    setRequestType('vacaciones');
    const today = new Date();
    const d = toDateString(today);
    setStartDate(d);
    setEndDate(d);
    setReason('');
    setError(null);
  }, []);

  useEffect(() => {
    if (open) resetForm();
  }, [open, resetForm]);

  // Cargar organizaciones del usuario
  useEffect(() => {
    if (!open || !currentUserId) {
      setOrgs([]);
      return;
    }
    const supabase = createClient();
    supabase
      .from('memberships')
      .select('org_id')
      .eq('user_id', currentUserId)
      .in('role', ['user', 'team_manager', 'org_admin', 'superadmin'])
      .then(({ data: memberships }) => {
        const orgIds = ((memberships ?? []) as { org_id: string }[]).map((m) => m.org_id);
        if (orgIds.length === 0) {
          setOrgs([]);
          return;
        }
        supabase
          .from('organizations')
          .select('id, name')
          .in('id', orgIds)
          .then(({ data }) => {
            setOrgs(
              ((data ?? []) as { id: string; name: string }[]).map((o) => ({
                id: o.id,
                name: o.name ?? 'Sin nombre',
              }))
            );
          });
      });
  }, [open, currentUserId]);

  const toggleOrg = useCallback((orgId: string) => {
    setSelectedOrgIds((prev) =>
      prev.includes(orgId) ? prev.filter((id) => id !== orgId) : [...prev, orgId]
    );
  }, []);

  const validateStep = useCallback((): boolean => {
    switch (step) {
      case 1:
        return true;
      case 2:
        if (selectedOrgIds.length === 0) {
          setError('Selecciona al menos una organización.');
          return false;
        }
        return true;
      case 3:
        return true;
      case 4:
        if (!startDate || !endDate) {
          setError('Indica el rango de fechas.');
          return false;
        }
        const s = new Date(startDate).getTime();
        const e = new Date(endDate).getTime();
        if (e < s) {
          setError('La fecha de fin debe ser igual o posterior al inicio.');
          return false;
        }
        return true;
      case 5:
        if (!reason.trim()) {
          setError('Indica el motivo del permiso.');
          return false;
        }
        return true;
      default:
        return true;
    }
  }, [step, selectedOrgIds, startDate, endDate, reason]);

  const handleNext = useCallback(() => {
    setError(null);
    if (!validateStep()) return;
    if (step < totalSteps) setStep((s) => s + 1);
  }, [step, validateStep]);

  const handleBack = useCallback(() => {
    setError(null);
    if (step > 1) setStep((s) => s - 1);
  }, [step]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!validateStep() || !currentUserId) return;
      setLoading(true);
      const supabase = createClient();
      const { start_at, end_at } = toStartEndISO(startDate, endDate);

      try {
        const inserts = selectedOrgIds.map((org_id) => ({
          org_id,
          requester_id: currentUserId,
          permission_scope_type: permissionScopeType,
          request_type: requestType,
          start_at,
          end_at,
          reason: reason.trim(),
        }));

        const { error: err } = await supabase.from('permission_requests').insert(inserts);

        if (err) {
          setError(err.message);
          toast({ variant: 'error', title: 'Error', message: err.message });
          setLoading(false);
          return;
        }

        toast({
          variant: 'success',
          title: 'Solicitud enviada',
          message: `Se enviaron ${inserts.length} solicitud(es) de permiso correctamente.`,
        });
        onSuccess();
        onClose();
      } catch (ex) {
        const msg = ex instanceof Error ? ex.message : 'Error inesperado';
        setError(msg);
        toast({ variant: 'error', title: 'Error', message: msg });
      } finally {
        setLoading(false);
      }
    },
    [
      currentUserId,
      selectedOrgIds,
      permissionScopeType,
      requestType,
      startDate,
      endDate,
      reason,
      validateStep,
      onSuccess,
      onClose,
      toast,
    ]
  );

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      zIndex={60}
      closeOnEscape={!loading}
      title="Solicitar permiso"
      description="Indica el tipo de permiso, organizaciones, tipo de solicitud, fechas y motivo."
      panelClassName="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Indicador de pasos */}
        <div className="flex gap-1" aria-label={`Paso ${step} de ${totalSteps}`}>
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i + 1 <= step ? 'bg-primary-600' : 'bg-border'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        {/* Paso 1: Tipo de permiso */}
        {step === 1 && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-text-primary">
              Tipo de permiso
            </label>
            <div className="flex flex-col gap-2">
              {PERMISSION_SCOPE_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 hover:bg-subtle-bg has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50"
                >
                  <input
                    type="radio"
                    name="permissionScopeType"
                    value={o.value}
                    checked={permissionScopeType === o.value}
                    onChange={() => setPermissionScopeType(o.value)}
                    className="h-4 w-4 text-primary-600"
                  />
                  <span className="text-sm text-text-primary">{o.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Paso 2: Organizaciones */}
        {step === 2 && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-text-primary">
              Organización(es) donde solicitas el permiso
            </label>
            {orgs.length === 0 ? (
              <p className="text-sm text-muted">No tienes organizaciones disponibles.</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                {orgs.map((o) => (
                  <label
                    key={o.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 hover:bg-subtle-bg has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedOrgIds.includes(o.id)}
                      onChange={() => toggleOrg(o.id)}
                      className="h-4 w-4 rounded border-border text-primary-600"
                    />
                    <span className="text-sm text-text-primary">{o.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Paso 3: Tipo de solicitud */}
        {step === 3 && (
          <div className="space-y-2">
            <label htmlFor="requestType" className="block text-sm font-medium text-text-primary">
              Tipo de solicitud
            </label>
            <Select
              id="requestType"
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as PermissionRequestType)}
              className="w-full"
            >
              {PERMISSION_REQUEST_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        )}

        {/* Paso 4: Rango de fechas */}
        {step === 4 && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="mb-1 block text-sm font-medium text-text-secondary">
                Desde
              </label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary"
                required
              />
            </div>
            <div>
              <label htmlFor="endDate" className="mb-1 block text-sm font-medium text-text-secondary">
                Hasta
              </label>
              <input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary"
                required
              />
            </div>
          </div>
        )}

        {/* Paso 5: Motivo */}
        {step === 5 && (
          <div className="space-y-2">
            <label htmlFor="reason" className="block text-sm font-medium text-text-primary">
              Motivo del permiso
            </label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="min-h-[100px]"
              placeholder="Describe el motivo de la solicitud..."
              required
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={step === 1 ? onClose : handleBack}>
            {step === 1 ? 'Cancelar' : 'Atrás'}
          </Button>
          {step < totalSteps ? (
            <Button type="button" onClick={handleNext}>
              Siguiente
            </Button>
          ) : (
            <Button type="submit" loading={loading} disabled={loading || selectedOrgIds.length === 0}>
              Enviar solicitud
            </Button>
          )}
        </div>
      </form>
    </Dialog>
  );
}
