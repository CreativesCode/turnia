import { AuthGuard } from '@/components/auth/AuthGuard';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { PushNotificationRegistrationLoader } from '@/components/notifications/PushNotificationRegistrationLoader';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <PushNotificationRegistrationLoader />
      <div className="min-h-screen bg-subtle-bg">
        <header className="border-b border-border bg-background px-4 py-3">
          <nav className="flex flex-wrap items-center gap-4 text-sm">
            <a href="/dashboard" className="font-medium text-text-primary hover:text-primary-600">Dashboard</a>
            <a href="/dashboard/admin" className="text-text-secondary hover:text-primary-600">Admin</a>
            <a href="/dashboard/admin/organizations" className="text-text-secondary hover:text-primary-600">Organizaciones</a>
            <a href="/dashboard/admin/members" className="text-text-secondary hover:text-primary-600">Miembros</a>
            <a href="/dashboard/admin/invite" className="text-text-secondary hover:text-primary-600">Invitar</a>
            <a href="/dashboard/admin/shift-types" className="text-text-secondary hover:text-primary-600">Tipos de turno</a>
            <a href="/dashboard/admin/exports" className="text-text-secondary hover:text-primary-600">Exportar</a>
            <a href="/dashboard/admin/reports" className="text-text-secondary hover:text-primary-600">Reportes</a>
            <a href="/dashboard/admin/audit" className="text-text-secondary hover:text-primary-600">Auditoría</a>
            <a href="/dashboard/manager" className="text-text-secondary hover:text-primary-600">Calendario</a>
            <a href="/dashboard/manager/shifts" className="text-text-secondary hover:text-primary-600">Lista de turnos</a>
            <a href="/dashboard/manager/requests" className="text-text-secondary hover:text-primary-600">Solicitudes</a>
            <a href="/dashboard/staff" className="text-text-secondary hover:text-primary-600">Staff</a>
            <a href="/dashboard/staff/my-requests" className="text-text-secondary hover:text-primary-600">Mis solicitudes</a>
            <a href="/dashboard/viewer" className="text-text-secondary hover:text-primary-600">Viewer</a>
            <a href="/dashboard/notifications" className="text-text-secondary hover:text-primary-600">Notificaciones</a>
            <span className="ml-auto flex items-center gap-2">
              <NotificationBell />
              <LogoutButton />
            </span>
          </nav>
        </header>
        <main className="p-4">{children}</main>
      </div>
    </AuthGuard>
  );
}
