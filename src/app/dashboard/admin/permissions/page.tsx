'use client';

import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { PermissionsMatrix } from '@/components/permissions/PermissionsMatrix';

export default function AdminPermissionsPage() {
  return (
    <div className="space-y-4">
      <DashboardDesktopHeader
        title="Permisos por rol"
        subtitle="Qué puede hacer cada rol en la plataforma"
      />

      <p className="text-sm text-muted">
        Este resumen es informativo. Los permisos se aplican en tiempo real desde Supabase RLS según el rol asignado en
        la organización (Staff, Manager, OrgAdmin) o como Superadmin global.
      </p>

      <PermissionsMatrix />
    </div>
  );
}
