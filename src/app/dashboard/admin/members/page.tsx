'use client';

/**
 * Admin · Miembros: stats row 4 columnas + lista de miembros con avatar y Pills.
 * Diseño: ref docs/design/screens/extras.jsx DAdminMembers (línea 413).
 */

import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { MembersList, type RoleCounts } from '@/components/members/MembersList';
import { Icons } from '@/components/ui/icons';
import { Skeleton } from '@/components/ui/Skeleton';
import { Stat } from '@/components/ui/Stat';
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
  const [counts, setCounts] = useState<RoleCounts | null>(null);
  const [search, setSearch] = useState('');

  // Para superadmin: cargar organizaciones; para org_admin: usar orgId actual.
  useEffect(() => {
    if (!isSuperadmin) {
      setOrgs([]);
      setSelectedOrgId(orgId);
      return;
    }
    setOrgsLoading(true);
    const supabase = createClient();
    void supabase
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
  const handleCountsChange = useCallback((c: RoleCounts) => setCounts(c), []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Miembros" subtitle="Gestiona roles y membresías" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Miembros" subtitle="Gestiona roles y membresías" />
        <div className="rounded-2xl border border-border bg-surface p-6">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!orgId && !isSuperadmin) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Miembros" subtitle="Gestiona roles y membresías" />
        <div className="rounded-2xl border border-border bg-surface p-6">
          <p className="text-sm text-muted">No tienes permisos para gestionar miembros.</p>
        </div>
      </div>
    );
  }

  if (isSuperadmin) {
    if (orgsLoading || (orgs.length === 0 && selectedOrgId === null)) {
      return (
        <div className="space-y-4">
          <DashboardDesktopHeader title="Miembros" subtitle="Gestiona roles y membresías" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      );
    }
    if (orgs.length === 0) {
      return (
        <div className="space-y-4">
          <DashboardDesktopHeader title="Miembros" subtitle="Gestiona roles y membresías" />
          <div className="rounded-2xl border border-border bg-surface p-6">
            <p className="text-sm text-muted">No hay organizaciones. Crea una desde Organizaciones.</p>
            <Link href="/dashboard/admin/organizations" className="mt-2 inline-block text-[12.5px] font-semibold text-primary hover:underline">
              Ir a organizaciones →
            </Link>
          </div>
        </div>
      );
    }
  }

  const effectiveOrgId = isSuperadmin ? selectedOrgId : orgId;
  if (!effectiveOrgId) return null;

  const adminCount = (counts?.org_admin ?? 0) + (counts?.superadmin ?? 0);
  const managerCount = counts?.team_manager ?? 0;
  const userCount = counts?.user ?? 0;
  const viewerCount = counts?.viewer ?? 0;

  return (
    <div className="space-y-4">
      <DashboardDesktopHeader
        title="Miembros"
        subtitle="Gestiona roles y membresías"
        actions={
          <Link
            href="/dashboard/admin/invite"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[12.5px] font-semibold text-white transition-transform hover:-translate-y-px"
            style={{ boxShadow: '0 6px 16px -8px var(--primary)' }}
          >
            <Icons.send size={14} /> Invitar
          </Link>
        }
      />

      {/* Selector de org (sólo superadmin con varias orgs) */}
      {isSuperadmin && orgs.length > 1 ? (
        <div className="rounded-2xl border border-border bg-surface p-3">
          <label htmlFor="org-select" className="mb-1 block text-[11.5px] font-semibold text-text-sec">
            Organización
          </label>
          <select
            id="org-select"
            value={selectedOrgId ?? ''}
            onChange={(e) => setSelectedOrgId(e.target.value || null)}
            className="block w-full max-w-xs rounded-lg border border-border bg-bg px-3 py-2 text-[13px] text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {/* Stats row 4 columnas */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Stat
          label="Total"
          value={String(counts?.total ?? '—')}
          icon={<Icons.users size={14} />}
          accent="var(--primary)"
        />
        <Stat
          label="Admins"
          value={String(adminCount)}
          icon={<Icons.shield size={14} />}
          accent="var(--red)"
          sub={counts?.superadmin ? `${counts.superadmin} superadmin` : undefined}
        />
        <Stat
          label="Managers"
          value={String(managerCount)}
          icon={<Icons.briefcase size={14} />}
          accent="var(--violet)"
        />
        <Stat
          label="Staff"
          value={String(userCount + viewerCount)}
          icon={<Icons.user size={14} />}
          accent="var(--blue)"
          sub={viewerCount ? `${viewerCount} viewers` : undefined}
        />
      </div>

      {/* Search */}
      <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-subtle-2 px-3 text-[13px] text-muted focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
        <Icons.search size={15} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o email…"
          className="h-full w-full bg-transparent text-text outline-none placeholder:text-muted"
        />
      </label>

      <MembersList
        orgId={effectiveOrgId}
        refreshKey={listRefreshKey}
        onRefresh={onRefresh}
        onCountsChange={handleCountsChange}
      />
    </div>
  );
}

export default function AdminMembersPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      }
    >
      <AdminMembersContent />
    </Suspense>
  );
}
