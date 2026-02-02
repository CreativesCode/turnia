'use client';

import Link from 'next/link';

export default function DashboardAdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-6">
      <h2 className="text-lg font-semibold text-text-primary">Algo salió mal</h2>
      <p className="mt-2 text-sm text-text-secondary">{error.message || 'Error inesperado'}</p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700"
        >
          Reintentar
        </button>
        <Link
          href="/dashboard/admin"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-text-secondary hover:bg-subtle-bg"
        >
          Volver a Admin
        </Link>
      </div>
    </div>
  );
}

