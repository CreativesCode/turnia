'use client';

import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { CreateOrganizationModal } from '@/components/organizations/CreateOrganizationModal';
import { OrganizationList } from '@/components/organizations/OrganizationList';
import { OrganizationSettings } from '@/components/organizations/OrganizationSettings';
import { useCurrentOrg } from '@/hooks/useCurrentOrg';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function AdminOrganizationsContent() {
  const { orgId, isSuperadmin, isLoading, error } = useCurrentOrg();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [listRefreshKey, setListRefreshKey] = useState(0);

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

  // Modo editar: ?edit=uuid (SPA, sin ruta dinámica; compatible con output: 'export')
  if (editId) {
    return (
      <div className="space-y-6">
        <DashboardDesktopHeader title="Editar organización" subtitle="Actualiza datos y configuración" />

        <div className="md:hidden">
          <Link href="/dashboard/admin/organizations" className="text-sm text-primary-600 hover:text-primary-700">
            ← Organizaciones
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-text-primary">Editar organización</h1>
        </div>
        <OrganizationSettings
          orgId={editId}
          backHref="/dashboard/admin/organizations"
          onDeleted={() => router.push('/dashboard/admin/organizations')}
        />
      </div>
    );
  }

  if (!orgId && !isSuperadmin) {
    return (
      <div>
        <p className="text-text-secondary">No tienes permisos para gestionar organizaciones.</p>
        <Link href="/dashboard/admin" className="mt-2 inline-block text-primary-600 hover:text-primary-700">
          ← Admin
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardDesktopHeader
        title="Organizaciones"
        subtitle={isSuperadmin ? 'Lista de todas las organizaciones' : 'Configuración de tu organización'}
      />

      <div className="md:hidden">
        <Link href="/dashboard/admin" className="text-sm text-primary-600 hover:text-primary-700">
          ← Admin
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-text-primary">Organizaciones</h1>
        <p className="mt-1 text-sm text-text-secondary">
          {isSuperadmin
            ? 'Lista de todas las organizaciones. Edita o elimina desde aquí.'
            : 'Configuración de tu organización.'}
        </p>
      </div>

      {isSuperadmin ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="min-h-[44px] rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
            >
              Crear organización
            </button>
          </div>
          <OrganizationList refreshKey={listRefreshKey} />
          <CreateOrganizationModal
            open={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onCreated={() => setListRefreshKey((k) => k + 1)}
          />
        </>
      ) : (
        orgId && (
          <OrganizationSettings
            orgId={orgId}
            onDeleted={() => router.push('/dashboard/admin')}
          />
        )
      )}
    </div>
  );
}

export default function AdminOrganizationsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-6 w-64 animate-pulse rounded bg-subtle-bg" />
        <div className="h-48 animate-pulse rounded-xl bg-subtle-bg" />
      </div>
    }>
      <AdminOrganizationsContent />
    </Suspense>
  );
}
