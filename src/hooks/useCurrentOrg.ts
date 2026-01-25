'use client';

import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useState } from 'react';

export type UseCurrentOrgResult = {
  orgId: string | null;
  isSuperadmin: boolean;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};

/**
 * Para páginas de admin: obtiene la org actual (org_admin) o indica superadmin.
 * - org_admin: orgId = su organización, isSuperadmin = false
 * - superadmin: orgId = null, isSuperadmin = true (debe listar todas las orgs)
 * - sin permisos: orgId = null, isSuperadmin = false
 */
export function useCurrentOrg(): UseCurrentOrgResult {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
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
      setIsSuperadmin(false);
      setIsLoading(false);
      return;
    }
    const { data: memberships, error: err } = await supabase
      .from('memberships')
      .select('org_id, role')
      .eq('user_id', user.id)
      .in('role', ['org_admin', 'superadmin']);
    if (err) {
      setError(err.message);
      setOrgId(null);
      setIsSuperadmin(false);
      setIsLoading(false);
      return;
    }
    const hasSuperadmin = (memberships ?? []).some((m) => m.role === 'superadmin');
    setIsSuperadmin(hasSuperadmin);
    if (hasSuperadmin) {
      setOrgId(null);
    } else {
      const admin = (memberships ?? []).find((m) => m.role === 'org_admin');
      setOrgId(admin?.org_id ?? null);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  return { orgId, isSuperadmin, isLoading, error, refetch: run };
}
