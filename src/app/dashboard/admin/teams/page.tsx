'use client';

import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { TeamsList } from '@/components/teams/TeamsList';
import { useCurrentOrg } from '@/hooks/useCurrentOrg';
import Link from 'next/link';

export default function AdminTeamsPage() {
  const { orgId, isSuperadmin, isLoading, error } = useCurrentOrg();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Equipos" subtitle="Cargando…" />
        <div className="rounded-2xl border border-border bg-bg p-6 text-sm text-text-sec">Cargando…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Equipos" />
        <p className="rounded-2xl border border-border bg-bg p-6 text-sm text-red">{error}</p>
        <Link href="/dashboard/admin" className="text-sm text-primary">
          ← Admin
        </Link>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Equipos" />
        <p className="rounded-2xl border border-border bg-bg p-6 text-sm text-text-sec">
          No tienes permisos para gestionar equipos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <DashboardDesktopHeader
        title="Equipos"
        subtitle="Sub-organizaciones modeladas como equipos del centro"
        actions={
          <Link
            href="/dashboard/admin/organizations"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-semibold text-white shadow-[0_4px_12px_-6px_var(--color-primary)]"
          >
            + Nuevo equipo
          </Link>
        }
      />

      <p className="rounded-xl border border-border bg-subtle-bg p-3 text-[12.5px] text-text-sec">
        En Turnia los equipos se gestionan como sub-organizaciones. Crea o edita un equipo desde{' '}
        <Link href="/dashboard/admin/organizations" className="font-semibold text-primary">
          Organizaciones
        </Link>
        .
      </p>

      <TeamsList parentOrgId={orgId} isSuperadmin={isSuperadmin} />
    </div>
  );
}
