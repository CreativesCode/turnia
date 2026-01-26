import { AuthGuard } from '@/components/auth/AuthGuard';
import { PushNotificationRegistrationLoader } from '@/components/notifications/PushNotificationRegistrationLoader';
import { DashboardNav } from '@/components/dashboard/DashboardNav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <PushNotificationRegistrationLoader />
      <div className="min-h-screen bg-subtle-bg">
        <DashboardNav />
        <main className="p-4 pb-24 md:pb-4">{children}</main>
      </div>
    </AuthGuard>
  );
}
