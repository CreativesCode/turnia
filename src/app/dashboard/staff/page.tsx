import Link from 'next/link';

export default function StaffPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-text-primary">Staff</h1>
      <p className="text-text-secondary">
        Mis turnos, equipo, solicitudes (dar turno, swap, tomar abierto).
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard/staff/my-requests"
          className="min-h-[44px] rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          Mis solicitudes
        </Link>
        <Link
          href="/dashboard/staff/availability"
          className="min-h-[44px] rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-subtle-bg"
        >
          Mi disponibilidad
        </Link>
        <Link
          href="/dashboard/manager"
          className="min-h-[44px] rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-subtle-bg"
        >
          Ver calendario
        </Link>
      </div>
    </div>
  );
}
