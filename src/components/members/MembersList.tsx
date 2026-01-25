'use client';

import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useState } from 'react';
import { EditMembershipForm } from './EditMembershipForm';
import { MemberDetails } from './MemberDetails';
import type { MemberForDetails } from './MemberDetails';
import { ROLE_LABELS } from './role-labels';

const ERROR_MESSAGES: Record<string, string> = {
  forbidden: 'No tienes permiso para realizar esta acción.',
  membership_not_found: 'No se encontró la membresía.',
  cannot_remove_superadmin: 'Solo un superadmin puede eliminar a un superadmin.',
  cannot_remove_last_admin: 'No se puede eliminar al último administrador de la organización.',
};

type Props = {
  orgId: string;
  refreshKey?: number;
  onRefresh?: () => void;
};

export function MembersList({ orgId, refreshKey = 0, onRefresh }: Props) {
  const [rows, setRows] = useState<MemberForDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailMember, setDetailMember] = useState<MemberForDetails | null>(null);
  const [editMember, setEditMember] = useState<MemberForDetails | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<MemberForDetails | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: memberships, error: mErr } = await supabase
      .from('memberships')
      .select('id, user_id, role, created_at, updated_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (mErr) {
      setError(mErr.message);
      setLoading(false);
      return;
    }

    const list = (memberships ?? []) as {
      id: string;
      user_id: string;
      role: string;
      created_at: string;
      updated_at: string | null;
    }[];
    if (list.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const userIds = [...new Set(list.map((m) => m.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);
    const profileMap = Object.fromEntries(
      ((profiles ?? []) as { id: string; full_name: string | null; email: string | null }[]).map(
        (p) => [p.id, p]
      )
    );

    const merged: MemberForDetails[] = list.map((m) => {
      const p = profileMap[m.user_id];
      return {
        ...m,
        updated_at: m.updated_at ?? undefined,
        full_name: p?.full_name ?? null,
        email: p?.email ?? null,
      };
    });

    setRows(merged);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const doRemove = useCallback(async () => {
    if (!confirmRemove) return;
    setRemoving(true);
    setRemoveError(null);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc('remove_from_org', {
      p_org_id: orgId,
      p_user_id: confirmRemove.user_id,
    });
    setRemoving(false);
    setConfirmRemove(null);
    if (rpcError) {
      setRemoveError(rpcError.message);
      return;
    }
    const res = data as { ok?: boolean; error?: string } | null;
    if (!res?.ok) {
      setRemoveError(ERROR_MESSAGES[res?.error ?? ''] ?? res?.error ?? 'Error al eliminar');
      return;
    }
    onRefresh?.();
    load();
  }, [orgId, confirmRemove, onRefresh, load]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-background p-4">
        <p className="text-sm text-muted">Cargando miembros…</p>
        <div className="mt-3 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded bg-subtle-bg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-background p-4">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-background p-4">
        <p className="text-sm text-muted">
          Aún no hay miembros en esta organización. Invita a alguien para comenzar.
        </p>
      </div>
    );
  }

  return (
    <>
      {removeError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {removeError}
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-border bg-background shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-subtle-bg">
              <th className="px-3 py-2.5 text-left font-medium text-text-primary">Usuario</th>
              <th className="px-3 py-2.5 text-left font-medium text-text-primary">Correo</th>
              <th className="px-3 py-2.5 text-left font-medium text-text-primary">Rol</th>
              <th className="px-3 py-2.5 text-left font-medium text-text-primary">Alta</th>
              <th className="px-3 py-2.5 text-right font-medium text-text-primary">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2.5 text-text-primary">
                  <button
                    type="button"
                    onClick={() => setDetailMember(r)}
                    className="text-left font-medium text-primary-600 hover:underline"
                  >
                    {r.full_name?.trim() || r.email || '—'}
                  </button>
                </td>
                <td className="px-3 py-2.5 text-muted">{r.email || '—'}</td>
                <td className="px-3 py-2.5 text-muted">{ROLE_LABELS[r.role] || r.role}</td>
                <td className="px-3 py-2.5 text-muted">
                  {new Date(r.created_at).toLocaleDateString()}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setDetailMember(r)}
                      className="min-h-[44px] min-w-[44px] rounded-lg px-2 py-1.5 text-sm text-primary-600 hover:bg-primary-50"
                    >
                      Ver
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditMember(r)}
                      className="min-h-[44px] min-w-[44px] rounded-lg px-2 py-1.5 text-sm text-primary-600 hover:bg-primary-50"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(r)}
                      className="min-h-[44px] min-w-[44px] rounded-lg px-2 py-1.5 text-sm text-red-600 hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detailMember && (
        <MemberDetails
          member={detailMember}
          onClose={() => setDetailMember(null)}
          onEditRole={() => {
            setDetailMember(null);
            setEditMember(detailMember);
          }}
        />
      )}

      {editMember && (
        <EditMembershipForm
          member={editMember}
          orgId={orgId}
          onSuccess={() => {
            onRefresh?.();
            load();
          }}
          onClose={() => setEditMember(null)}
        />
      )}

      <ConfirmModal
        open={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        onConfirm={doRemove}
        title="Eliminar miembro"
        message={
          confirmRemove
            ? `¿Eliminar a ${confirmRemove.full_name?.trim() || confirmRemove.email || 'este usuario'} de la organización? Dejará de tener acceso.`
            : ''
        }
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={removing}
      />
    </>
  );
}
