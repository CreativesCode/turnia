import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { AdminPageMenu } from '@/components/dashboard/AdminPageMenu';

export default function AdminPage() {
  return (
    <div className="space-y-5">
      <DashboardDesktopHeader
        title="Panel de Administración"
        subtitle="Gestiona miembros, equipos, configuración y reportes"
      />

      {/* Encabezado mobile */}
      <div className="space-y-1 md:hidden">
        <h1 className="tn-h text-[22px] font-bold tracking-[-0.02em] text-text">Administración</h1>
        <p className="text-[13px] text-muted">
          Miembros, invitaciones, tipos de turno, exportación y auditoría.
        </p>
      </div>

      <AdminPageMenu />
    </div>
  );
}
