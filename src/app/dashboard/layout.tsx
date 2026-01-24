import { AuthGuard } from '@/components/auth/AuthGuard';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-subtle-bg">
        <header className="border-b border-border bg-background px-4 py-3">
          <nav className="flex flex-wrap items-center gap-4 text-sm">
            <a href="/dashboard" className="font-medium text-text-primary hover:text-primary-600">Dashboard</a>
            <a href="/dashboard/admin" className="text-text-secondary hover:text-primary-600">Admin</a>
            <a href="/dashboard/manager" className="text-text-secondary hover:text-primary-600">Manager</a>
            <a href="/dashboard/staff" className="text-text-secondary hover:text-primary-600">Staff</a>
            <a href="/dashboard/viewer" className="text-text-secondary hover:text-primary-600">Viewer</a>
          </nav>
        </header>
        <main className="p-4">{children}</main>
      </div>
    </AuthGuard>
  );
}
