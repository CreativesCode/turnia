'use client';

import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useState } from 'react';
import { ROLE_LABELS, ROLES_EDITABLE } from './role-labels';
import type { MemberForDetails } from './MemberDetails';
import { Dialog } from '@/components/ui/Dialog';

type StaffPositionOption = { id: string; name: string };

type Props = {
  member: MemberForDetails;
  orgId: string;
  onSuccess: () => void;
  onClose: () => void;
};

const ERROR_MESSAGES: Record<string, string> = {
  forbidden: 'No tienes permiso para cambiar el rol.',
  invalid_role: 'Rol no válido.',
  invalid_staff_position: 'Puesto no válido.',
  membership_not_found: 'No se encontró la membresía.',
  cannot_change_superadmin: 'Solo un superadmin puede cambiar el rol de un superadmin.',
  cannot_remove_last_admin: 'No se puede quitar el último administrador de la organización.',
};

/**
 * Modal para cambiar el rol y puesto de un miembro. Llama a la RPC change_user_role.
 */
export function EditMembershipForm({ member, orgId, onSuccess, onClose }: Props) {
  const [role, setRole] = useState(member.role);
  const [staffPositionId, setStaffPositionId] = useState<string>(member.staff_position_id ?? '');
  const [staffPositions, setStaffPositions] = useState<StaffPositionOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    const supabase = createClient();
    supabase
      .from('organization_staff_positions')
      .select('id, name')
      .eq('org_id', orgId)
      .order('sort_order')
      .order('name')
      .then(({ data }) => setStaffPositions((data ?? []) as StaffPositionOption[]));
  }, [orgId]);

  useEffect(() => {
    setStaffPositionId(member.staff_position_id ?? '');
  }, [member.staff_position_id]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSaving(true);
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc('change_user_role', {
        p_org_id: orgId,
        p_user_id: member.user_id,
        p_new_role: role,
        p_staff_position_id: staffPositionId || null,
      });
      setSaving(false);
      if (rpcError) {
        setError(rpcError.message);
        return;
      }
      const res = data as { ok?: boolean; error?: string } | null;
      if (!res?.ok) {
        setError(ERROR_MESSAGES[res?.error ?? ''] ?? res?.error ?? 'Error al cambiar el rol');
        return;
      }
      onSuccess();
      onClose();
    },
    [orgId, member.user_id, role, staffPositionId, onSuccess, onClose]
  );

  return (
    <Dialog
      open
      onClose={onClose}
      closeOnEscape={!saving}
      title="Editar rol y puesto"
      panelClassName="max-w-sm"
    >
      <form onSubmit={submit}>
        <p className="mt-1 text-sm text-text-secondary">
          {member.full_name?.trim() || member.email || 'Usuario'}
        </p>
        <div className="mt-4">
          <label htmlFor="edit-role" className="block text-sm font-medium text-text-secondary">
            Rol
          </label>
          <select
            id="edit-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary focus:border-primary-500 focus:outline-none"
          >
            {ROLES_EDITABLE.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r] ?? r}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4">
          <label htmlFor="edit-staff-position" className="block text-sm font-medium text-text-secondary">
            Puesto
          </label>
          <select
            id="edit-staff-position"
            value={staffPositionId}
            onChange={(e) => setStaffPositionId(e.target.value)}
            className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary focus:border-primary-500 focus:outline-none"
          >
            <option value="">— Sin puesto —</option>
            {staffPositions.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="min-h-[44px] min-w-[44px] rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-subtle-bg disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] min-w-[44px] rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
