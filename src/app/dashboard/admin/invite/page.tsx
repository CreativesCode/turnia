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

  if (isLoading) return <p className="text-muted">Cargando…</p>;
  if (error) {
    return (
      <div>
        <p className="text-red-600">{error}</p>
        <Link href="/dashboard/admin" className="mt-2 inline-block text-primary-600 hover:text-primary-700">Volver a Admin</Link>
      </div>
    );
  }
  if (!orgId) {
    return (
      <div>
        <p className="text-text-secondary">No tienes permisos para invitar usuarios. Debes ser administrador de una organización.</p>
        <Link href="/dashboard/admin" className="mt-2 inline-block text-primary-600 hover:text-primary-700">Volver a Admin</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardDesktopHeader title="Invitar usuarios" subtitle="Crea invitaciones por correo y comparte el enlace" />

      <div className="md:hidden">
        <Link href="/dashboard/admin" className="text-sm text-primary-600 hover:text-primary-700">← Admin</Link>
        <h1 className="mt-2 text-xl font-semibold text-text-primary">Invitar usuarios</h1>
        <p className="mt-1 text-sm text-text-secondary">Crea invitaciones por correo y comparte el enlace. El enlace expira en 7 días.</p>
      </div>
      <InviteUserForm orgId={orgId} onSuccess={onInviteSuccess} />
      <div>
        <h2 className="mb-2 text-lg font-semibold text-text-primary">Invitaciones</h2>
        <InvitationsList orgId={orgId} refreshKey={refreshKey} />
      </div>
    </div>
  );
}
