import Link from 'next/link';

export default function AdminPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-text-primary">Org Admin / Superadmin</h1>
      <p className="mt-2 text-text-secondary">
        Gestión de organizaciones, equipos y asignación de roles.
      </p>
      <div className="mt-6 flex flex-wrap gap-4">
        <Link
          href="/dashboard/admin/organizations"
          className="rounded-lg border border-primary-600 bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Organizaciones
        </Link>
        <Link
          href="/dashboard/admin/invite"
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-text-primary hover:bg-subtle-bg"
        >
          Invitar usuarios
        </Link>
      </div>
    </div>
  );
}
