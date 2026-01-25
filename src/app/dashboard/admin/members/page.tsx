'use client';

import { MembersList } from '@/components/members/MembersList';
import { useCurrentOrg } from '@/hooks/useCurrentOrg';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

type OrgOption = { id: string; name: string };

function AdminMembersContent() {
  const { orgId, isSuperadmin, isLoading, error } = useCurrentOrg();
  const searchParams = useSearchParams();
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [listRefreshKey, setListRefreshKey] = useState(0);

  // Para superadmin: cargar organizaciones y elegir org. Para org_admin: selectedOrgId = orgId.
  useEffect(() => {
    if (!isSuperadmin) {
      setOrgs([]);
      setSelectedOrgId(orgId);
      return;
    }
    setOrgsLoading(true);
    const supabase = createClient();
    supabase
      .from('organizations')
      .select('id, name')
      .order('name')
      .then(({ data, error: err }) => {
        setOrgsLoading(false);
        if (err) return;
        const list = (data ?? []) as OrgOption[];
        setOrgs(list);
        const fromUrl = searchParams.get('org');
        if (fromUrl && list.some((o) => o.id === fromUrl)) {
          setSelectedOrgId(fromUrl);
        } else if (list.length > 0) {
          setSelectedOrgId(list[0].id);
        }
      });
  }, [isSuperadmin, orgId, searchParams]);

  const onRefresh = useCallback(() => setListRefreshKey((k) => k + 1), []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-64 animate-pulse rounded bg-subtle-bg" />
        <div className="h-48 animate-pulse rounded-xl bg-subtle-bg" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <p className="text-red-600">{error}</p>
        <Link href="/dashboard/admin" className="mt-2 inline-block text-primary-600 hover:text-primary-700">
          ← Admin
        </Link>
      </div>
    );
  }

  if (!orgId && !isSuperadmin) {
    return (
      <div>
        <p className="text-text-secondary">No tienes permisos para gestionar miembros.</p>
        <Link href="/dashboard/admin" className="mt-2 inline-block text-primary-600 hover:text-primary-700">
          ← Admin
        </Link>
      </div>
    );
  }

  // Superadmin: hay que elegir org. Si no hay orgs o aún cargando, mensaje o skeleton.
  if (isSuperadmin) {
    if (orgsLoading || (orgs.length === 0 && selectedOrgId === null)) {
      return (
        <div className="space-y-6">
          <div className="h-6 w-64 animate-pulse rounded bg-subtle-bg" />
          <div className="h-48 animate-pulse rounded-xl bg-subtle-bg" />
        </div>
      );
    }
    if (orgs.length === 0) {
      return (
        <div>
          <p className="text-text-secondary">No hay organizaciones. Crea una desde Organizaciones.</p>
          <Link href="/dashboard/admin/organizations" className="mt-2 inline-block text-primary-600 hover:text-primary-700">
            ← Organizaciones
          </Link>
        </div>
      );
    }
    if (!selectedOrgId) {
      return (
        <div className="space-y-6">
          <div className="h-6 w-64 animate-pulse rounded bg-subtle-bg" />
          <div className="h-48 animate-pulse rounded-xl bg-subtle-bg" />
        </div>
      );
    }
  }

  const effectiveOrgId = isSuperadmin ? selectedOrgId : orgId;
  if (!effectiveOrgId) return null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/admin" className="text-sm text-primary-600 hover:text-primary-700">
          ← Admin
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-text-primary">Miembros</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Lista de miembros de la organización. Puedes cambiar roles o eliminar miembros.
        </p>
      </div>

      {isSuperadmin && orgs.length > 1 && (
        <div>
          <label htmlFor="org-select" className="block text-sm font-medium text-text-secondary">
            Organización
          </label>
          <select
            id="org-select"
            value={selectedOrgId ?? ''}
            onChange={(e) => setSelectedOrgId(e.target.value || null)}
            className="mt-1.5 block w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/admin/invite"
          className="min-h-[44px] rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          Invitar usuarios
        </Link>
      </div>

      <MembersList orgId={effectiveOrgId} refreshKey={listRefreshKey} onRefresh={onRefresh} />
    </div>
  );
}

export default function AdminMembersPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-6 w-64 animate-pulse rounded bg-subtle-bg" />
          <div className="h-48 animate-pulse rounded-xl bg-subtle-bg" />
        </div>
      }
    >
      <AdminMembersContent />
    </Suspense>
  );
}
