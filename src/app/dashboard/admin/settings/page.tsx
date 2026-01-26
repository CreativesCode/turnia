'use client';

/**
 * Configuración de la organización: aprobaciones, descanso mínimo.
 * org_admin: su org. superadmin: selector de org.
 * @see project-roadmap.md Módulo 9.3
 */

import { OrgSettingsForm } from '@/components/organizations/OrgSettingsForm';
import { useCurrentOrg } from '@/hooks/useCurrentOrg';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type OrgOption = { id: string; name: string };

export default function AdminSettingsPage() {
  const { orgId, isSuperadmin, isLoading, error } = useCurrentOrg();
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
        if (list.length > 0 && !selectedOrgId) setSelectedOrgId(list[0].id);
      });
  }, [isSuperadmin, orgId]);

  const effectiveOrgId = isSuperadmin ? selectedOrgId : orgId;
  const canEdit = isSuperadmin || !!orgId;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-background p-6">
        <p className="text-sm text-muted">Cargando…</p>
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
        <p className="text-text-secondary">Solo org_admin y superadmin pueden acceder a la configuración.</p>
        <Link href="/dashboard/admin" className="mt-2 inline-block text-primary-600 hover:text-primary-700">
          ← Admin
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-xl font-semibold text-text-primary">Configuración de la organización</h1>
        <Link href="/dashboard/admin" className="text-sm text-primary-600 hover:text-primary-700">
          ← Admin
        </Link>
      </div>
      <p className="text-sm text-muted">
        Reglas de aprobación, descanso mínimo entre turnos y otras opciones. El descanso mínimo se usa al validar conflictos al crear o editar turnos.
      </p>

      {isSuperadmin && (
        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">Organización</label>
          <select
            value={selectedOrgId ?? ''}
            onChange={(e) => setSelectedOrgId(e.target.value || null)}
            disabled={orgsLoading}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"
          >
            <option value="">Seleccionar…</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {effectiveOrgId && (
        <OrgSettingsForm orgId={effectiveOrgId} canEdit={canEdit} />
      )}

      {isSuperadmin && orgs.length > 0 && !selectedOrgId && (
        <p className="text-sm text-muted">Selecciona una organización.</p>
      )}
    </div>
  );
}
