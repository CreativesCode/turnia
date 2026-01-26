'use client';

/**
 * Página de visualización del audit log. Solo org_admin y superadmin.
 * @see project-roadmap.md Módulo 8.1
 */

import { AuditLogList } from '@/components/audit/AuditLogList';
import { useCurrentOrg } from '@/hooks/useCurrentOrg';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type OrgOption = { id: string; name: string };

function AdminAuditContent() {
  const { orgId, isSuperadmin, isLoading, error } = useCurrentOrg();
  const searchParams = useSearchParams();
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

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
        <p className="text-text-secondary">No tienes permisos para ver el registro de auditoría.</p>
        <Link href="/dashboard/admin" className="mt-2 inline-block text-primary-600 hover:text-primary-700">
          ← Admin
        </Link>
      </div>
    );
  }

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
          <p className="text-text-secondary">No hay organizaciones.</p>
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
        <h1 className="mt-2 text-xl font-semibold text-text-primary">Registro de auditoría</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Eventos de solicitudes, miembros e invitaciones. Filtra por entidad, actor, acción y rango de fechas.
        </p>
      </div>

      {isSuperadmin && orgs.length > 1 && (
        <div>
          <label htmlFor="org-select-audit" className="block text-sm font-medium text-text-secondary">
            Organización
          </label>
          <select
            id="org-select-audit"
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

      <AuditLogList orgId={effectiveOrgId} />
    </div>
  );
}

export default function AdminAuditPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-6 w-64 animate-pulse rounded bg-subtle-bg" />
          <div className="h-48 animate-pulse rounded-xl bg-subtle-bg" />
        </div>
      }
    >
      <AdminAuditContent />
    </Suspense>
  );
}
