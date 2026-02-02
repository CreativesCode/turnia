import { AuthGuard } from '@/components/auth/AuthGuard';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { PushNotificationRegistrationLoader } from '@/components/notifications/PushNotificationRegistrationLoader';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard - Turnia',
  description: 'Panel principal de gestión de turnos',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <PushNotificationRegistrationLoader />
      <div className="min-h-screen bg-subtle-bg">
        {/* Mobile navigation */}
        <div className="md:hidden">
          <DashboardNav />
        </div>

        {/* Desktop layout (inspirado en frames Desktop del .pen) */}
        <div className="hidden min-h-screen md:flex">
          <DashboardSidebar />
          <div className="min-w-0 flex-1">
            <main className="p-8">{children}</main>
          </div>
        </div>

        {/* Mobile content */}
        <main className="p-4 pb-24 md:hidden">{children}</main>
      </div>
    </AuthGuard>
  );
}
