import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { AdminPageMenu } from '@/components/dashboard/AdminPageMenu';

export default function AdminPage() {
  return (
    <div className="space-y-4">
      <DashboardDesktopHeader title="Panel de Administración" subtitle="Gestión de miembros, invitaciones y configuración" />
      <div className="space-y-1 md:hidden">
        <h1 className="text-xl font-semibold text-text-primary">Panel de Administración</h1>
        <p className="text-text-secondary">Gestión de miembros, invitaciones, tipos de turno, exportación y auditoría.</p>
      </div>

      <AdminPageMenu />
    </div>
  );
}
