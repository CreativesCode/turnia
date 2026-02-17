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
      const { data: memberships, error: err } = await supabase
        .from('memberships')
        .select('org_id, role')
        .eq('user_id', user.id)
        .order('org_id', { ascending: true });

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
      const list = (memberships ?? []) as { org_id: string; role: string }[];
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

      // Usar la organización seleccionada si existe y el usuario tiene membership en ella,
      // de lo contrario usar la primera organización disponible
      const targetOrgId = selectedOrgId && list.some((m) => m.org_id === selectedOrgId) ? selectedOrgId : list[0]?.org_id;
      const targetMembership = list.find((m) => m.org_id === targetOrgId) ?? list[0];
      
      if (!targetMembership) {
        setOrgId(null);
        setUserId(null);
        setCanEdit(false);
        setCanManageOrgFlag(false);
        setCanCreateReqs(false);
        setCanApproveReqs(false);
        setIsLoading(false);
        return;
      }

      const m: MembershipRow = { org_id: targetMembership.org_id, role: targetMembership.role as MembershipRow['role'] };
      setOrgId(targetMembership.org_id);
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
