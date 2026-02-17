'use client';

import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useState } from 'react';

const SELECTED_ORG_KEY = 'turnia_selected_org_id';

export type OrganizationInfo = {
  id: string;
  name: string;
  role: string;
};

export type UseSelectedOrgResult = {
  selectedOrgId: string | null;
  organizations: OrganizationInfo[];
  isLoading: boolean;
  error: string | null;
  setSelectedOrgId: (orgId: string | null) => void;
  refetch: () => void;
};

/**
 * Hook para manejar la organización seleccionada por el usuario.
 * Persiste la selección en localStorage y carga todas las organizaciones del usuario.
 */
export function useSelectedOrg(): UseSelectedOrgResult {
  const [selectedOrgId, setSelectedOrgIdState] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrganizations = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    const supabase = createClient();
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setOrganizations([]);
        setSelectedOrgIdState(null);
        setIsLoading(false);
        return;
      }

      // Obtener todas las memberships del usuario con información de la organización
      const { data: memberships, error: err } = await supabase
        .from('memberships')
        .select('org_id, role, organizations(id, name)')
        .eq('user_id', user.id)
        .order('org_id', { ascending: true });

      if (err) {
        setError(err.message);
        setOrganizations([]);
        setSelectedOrgIdState(null);
        setIsLoading(false);
        return;
      }

      const orgs: OrganizationInfo[] = (memberships ?? [])
        .map((m) => {
          // Supabase puede devolver organizations como objeto o array dependiendo de la relación
          const orgData = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations;
          const org = orgData as { id: string; name: string } | null | undefined;
          if (!org || !org.id || !org.name) return null;
          return {
            id: org.id,
            name: org.name,
            role: m.role,
          };
        })
        .filter((o): o is OrganizationInfo => o !== null);

      setOrganizations(orgs);

      // Si no hay organizaciones, no hay nada que seleccionar
      if (orgs.length === 0) {
        setSelectedOrgIdState(null);
        setIsLoading(false);
        return;
      }

      // Intentar cargar la organización seleccionada desde localStorage
      const storedOrgId = typeof window !== 'undefined' ? localStorage.getItem(SELECTED_ORG_KEY) : null;
      const validStoredOrgId = storedOrgId && orgs.some((o) => o.id === storedOrgId);

      // Si hay una organización válida guardada, usarla; si no, usar la primera
      const initialOrgId = validStoredOrgId ? storedOrgId : orgs[0]?.id ?? null;
      setSelectedOrgIdState(initialOrgId);

      // Guardar en localStorage si no estaba guardada o si cambió
      if (typeof window !== 'undefined' && initialOrgId && initialOrgId !== storedOrgId) {
        localStorage.setItem(SELECTED_ORG_KEY, initialOrgId);
      }

      setIsLoading(false);
    } catch (e) {
      const err = e as Error & { name?: string };
      if (err.name === 'AbortError') {
        setIsLoading(false);
        return;
      }
      setError(err.message ?? 'No se pudieron cargar las organizaciones.');
      setOrganizations([]);
      setSelectedOrgIdState(null);
      setIsLoading(false);
    }
  }, []);

  const setSelectedOrgId = useCallback(
    (orgId: string | null) => {
      setSelectedOrgIdState(orgId);
      if (typeof window !== 'undefined') {
        if (orgId) {
          localStorage.setItem(SELECTED_ORG_KEY, orgId);
        } else {
          localStorage.removeItem(SELECTED_ORG_KEY);
        }
      }
    },
    []
  );

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  return {
    selectedOrgId,
    organizations,
    isLoading,
    error,
    setSelectedOrgId,
    refetch: loadOrganizations,
  };
}
