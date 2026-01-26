'use client';

import { createClient } from '@/lib/supabase/client';
import { canManageShifts, canManageOrg, canCreateRequests, canApproveRequests, type MembershipRow } from '@/lib/rbac';
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
 * - Cualquier usuario con membership: primera org de sus memberships.
 * - canManageShifts: si el usuario puede crear/editar/eliminar turnos (team_manager, org_admin, superadmin).
 */
export function useScheduleOrg(): UseScheduleOrgResult {
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
    const supabase = createClient();
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
    const first = list[0];
    const m: MembershipRow = { org_id: first.org_id, role: first.role as MembershipRow['role'] };
    setOrgId(first.org_id);
    setUserId(user.id);
    setCanEdit(canManageShifts(m));
    setCanManageOrgFlag(canManageOrg(m));
    setCanCreateReqs(canCreateRequests(m));
    setCanApproveReqs(canApproveRequests(m));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  return { orgId, userId, canManageShifts: canEdit, canManageOrg: canManageOrgFlag, canCreateRequests: canCreateReqs, canApproveRequests: canApproveReqs, isLoading, error, refetch: run };
}
