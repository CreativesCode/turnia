'use client';

import { createClient } from '@/lib/supabase/client';
import { canManageShifts, canManageOrg, canCreateRequests, canApproveRequests, type MembershipRow } from '@/lib/rbac';
import { useSelectedOrg } from './useSelectedOrg';
import { useCallback, useEffect, useState } from 'react';

export type UseScheduleOrgResult = {
  orgId: string | null;
  userId: string | null;
  canManageShifts: boolean;
  canManageOrg: boolean;
  canCreateRequests: boolean;
  canApproveRequests: boolean;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};

/**
 * Obtiene la organización a usar para el calendario/lista de turnos.
 * Usa la organización seleccionada por el usuario (desde useSelectedOrg).
 * - Cualquier usuario con membership: organización seleccionada o primera org de sus memberships.
 * - canManageShifts: si el usuario puede crear/editar/eliminar turnos (team_manager, org_admin, superadmin).
 */
export function useScheduleOrg(): UseScheduleOrgResult {
  const { selectedOrgId, isLoading: isLoadingSelectedOrg } = useSelectedOrg();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [canManageOrgFlag, setCanManageOrgFlag] = useState(false);
  const [canCreateReqs, setCanCreateReqs] = useState(false);
  const [canApproveReqs, setCanApproveReqs] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    const supabase = createClient();
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setOrgId(null);
        setUserId(null);
        setCanEdit(false);
        setCanManageOrgFlag(false);
        setCanCreateReqs(false);
        setCanApproveReqs(false);
        setIsLoading(false);
        return;
      }
      const { data: accessible, error: err } = await supabase.rpc('get_my_accessible_organizations');

      if (err) {
        setError(err.message);
        setOrgId(null);
        setUserId(null);
        setCanEdit(false);
        setCanManageOrgFlag(false);
        setCanCreateReqs(false);
        setCanApproveReqs(false);
        setIsLoading(false);
        return;
      }
      const list = (accessible ?? []) as { id: string; role: string }[];
      if (list.length === 0) {
        setOrgId(null);
        setUserId(null);
        setCanEdit(false);
        setCanManageOrgFlag(false);
        setCanCreateReqs(false);
        setCanApproveReqs(false);
        setIsLoading(false);
        return;
      }

      // Usar la organización seleccionada si está en las accesibles (directa o hija), si no la primera
      const targetOrgId = selectedOrgId && list.some((o) => o.id === selectedOrgId) ? selectedOrgId : list[0]?.id;
      const targetRow = list.find((o) => o.id === targetOrgId) ?? list[0];

      if (!targetRow) {
        setOrgId(null);
        setUserId(null);
        setCanEdit(false);
        setCanManageOrgFlag(false);
        setCanCreateReqs(false);
        setCanApproveReqs(false);
        setIsLoading(false);
        return;
      }

      const m: MembershipRow = { org_id: targetRow.id, role: (targetRow.role ?? 'viewer') as MembershipRow['role'] };
      setOrgId(targetRow.id);
      setUserId(user.id);
      setCanEdit(canManageShifts(m));
      setCanManageOrgFlag(canManageOrg(m));
      setCanCreateReqs(canCreateRequests(m));
      setCanApproveReqs(canApproveRequests(m));
      setIsLoading(false);
    } catch (e) {
      const err = e as Error & { name?: string };
      if (err.name === 'AbortError') {
        // Supabase/goTrue lock aborted (por ejemplo, React Strict Mode): lo ignoramos.
        setIsLoading(false);
        return;
      }
      setError(err.message ?? 'No se pudo cargar la organización.');
      setOrgId(null);
      setUserId(null);
      setCanEdit(false);
      setCanManageOrgFlag(false);
      setCanCreateReqs(false);
      setCanApproveReqs(false);
      setIsLoading(false);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    // Esperar a que useSelectedOrg termine de cargar antes de ejecutar
    if (isLoadingSelectedOrg) return;
    run();
  }, [run, isLoadingSelectedOrg]);

  return { orgId, userId, canManageShifts: canEdit, canManageOrg: canManageOrgFlag, canCreateRequests: canCreateReqs, canApproveRequests: canApproveReqs, isLoading, error, refetch: run };
}
