import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';

export default function ViewerPage() {
  return (
    <div className="space-y-4">
      <DashboardDesktopHeader title="Viewer" subtitle="Solo lectura: horarios y reportes" />

      <div className="md:hidden">
        <h1 className="text-xl font-semibold text-text-primary">Viewer</h1>
        <p className="mt-2 text-text-secondary">Solo lectura: horarios y reportes.</p>
      </div>
    </div>
  );
}
