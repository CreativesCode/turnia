'use client';

import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { InvitationsList } from '@/components/invitations/InvitationsList';
import { InviteUserForm } from '@/components/invitations/InviteUserForm';
import { useCurrentOrg } from '@/hooks/useCurrentOrg';
import Link from 'next/link';
import { useCallback, useState } from 'react';

export default function AdminInvitePage() {
  const { orgId, isLoading, error } = useCurrentOrg();
  const [refreshKey, setRefreshKey] = useState(0);

  const onInviteSuccess = useCallback(() => setRefreshKey((k) => k + 1), []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader
          title="Invitaciones"
          subtitle="Cargando…"
        />
        <div className="rounded-2xl border border-border bg-bg p-6 text-sm text-text-sec">Cargando…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Invitaciones" />
        <div className="rounded-2xl border border-border bg-bg p-6 text-sm text-red">{error}</div>
        <Link href="/dashboard/admin" className="text-sm text-primary">
          ← Admin
        </Link>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Invitaciones" />
        <div className="rounded-2xl border border-border bg-bg p-6 text-sm text-text-sec">
          No tienes permisos para invitar usuarios. Debes ser administrador de una organización.
        </div>
        <Link href="/dashboard/admin" className="text-sm text-primary">
          ← Admin
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <DashboardDesktopHeader
        title="Invitaciones"
        subtitle="Invita por correo y monitoriza las pendientes"
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_380px] lg:items-start">
        {/* Form principal */}
        <section>
          <h2 className="tn-h mb-3 text-[15px] font-bold">Nueva invitación</h2>
          <InviteUserForm orgId={orgId} onSuccess={onInviteSuccess} />
        </section>

        {/* Panel pendientes */}
        <section>
          <h2 className="tn-h mb-3 text-[15px] font-bold">Invitaciones</h2>
          <InvitationsList orgId={orgId} refreshKey={refreshKey} />
        </section>
      </div>
    </div>
  );
}
