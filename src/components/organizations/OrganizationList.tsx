'use client';

import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type Row = {
  id: string;
  name: string;
  slug: string | null;
  created_at: string;
};

type Props = {
  refreshKey?: number;
};

export function OrganizationList({ refreshKey = 0 }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from('organizations')
      .select('id, name, slug, created_at')
      .order('name');
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setRows((data ?? []) as Row[]);
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const deleteOrg = useCallback(
    async (id: string) => {
      setDeletingId(id);
      const supabase = createClient();
      await supabase.from('organizations').delete().eq('id', id);
      setDeletingId(null);
      setConfirmId(null);
      load();
    },
    [load]
  );

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
        <div className="h-6 w-48 animate-pulse rounded bg-subtle-bg" />
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 w-full animate-pulse rounded bg-subtle-bg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
        <p className="text-text-secondary">No hay organizaciones.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-background shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead>
            <tr className="bg-subtle-bg">
              <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Nombre</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Slug</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Creada</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id} className="bg-background">
                <td className="px-4 py-3 text-sm text-text-primary">{r.name}</td>
                <td className="px-4 py-3 text-sm text-muted">{r.slug ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-muted">
                  {new Date(r.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right text-sm">
                  <Link
                    href={`/dashboard/admin/organizations?edit=${r.id}`}
                    className="font-medium text-primary-600 hover:text-primary-700"
                  >
                    Editar
                  </Link>
                  <button
                    type="button"
                    onClick={() => setConfirmId(r.id)}
                    className="ml-3 font-medium text-red-600 hover:text-red-700"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={() => confirmId && deleteOrg(confirmId)}
        title="Eliminar organización"
        message={
          confirmId
            ? `¿Eliminar "${rows.find((r) => r.id === confirmId)?.name ?? 'esta organización'}"? Se borrarán todos los equipos, miembros, turnos e invitaciones. No se puede deshacer.`
            : ''
        }
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={!!confirmId && deletingId === confirmId}
      />
    </div>
  );
}
