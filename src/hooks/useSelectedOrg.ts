'use client';

import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useState } from 'react';

const SELECTED_ORG_KEY = 'turnia_selected_org_id';

export type OrganizationInfo = {
  id: string;
  name: string;
  role: string;
  /** Si existe, esta org es hija de otra (jerarquía 2 niveles). */
  parentId?: string | null;
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

      // RPC: organizaciones accesibles (membership directa + hijas de esas orgs)
      const { data: rows, error: err } = await supabase.rpc('get_my_accessible_organizations');

      if (err) {
        setError(err.message);
        setOrganizations([]);
        setSelectedOrgIdState(null);
        setIsLoading(false);
        return;
      }

      const orgs: OrganizationInfo[] = (rows ?? [])
        .map((r: { id: string; name: string; parent_id: string | null; role: string }) => {
          if (!r?.id || !r?.name) return null;
          return {
            id: r.id,
            name: r.name,
            role: r.role ?? 'viewer',
            parentId: r.parent_id ?? null,
          };
        })
        .filter((o: OrganizationInfo | null): o is OrganizationInfo => o !== null)
        .sort((a: OrganizationInfo, b: OrganizationInfo) => {
          // Raíces primero, luego por nombre; hijas después de su padre
          if (a.parentId && !b.parentId) return 1;
          if (!a.parentId && b.parentId) return -1;
          if (a.parentId && b.parentId && a.parentId !== b.parentId) return a.parentId.localeCompare(b.parentId) || a.name.localeCompare(b.name);
          return a.name.localeCompare(b.name);
        });

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
