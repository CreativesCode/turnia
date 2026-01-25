'use client';

/**
 * Panel de operaciones en lote: asignar y desasignar múltiples turnos.
 * Se muestra cuando hay turnos seleccionados.
 * @see project-roadmap.md Módulo 3.3
 */

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type MemberOption = { user_id: string; full_name: string | null };

type Props = {
  orgId: string;
  selectedIds: string[];
  onSuccess: () => void;
  onClearSelection: () => void;
  disabled?: boolean;
};

export function BulkOperationsPanel({
  orgId,
  selectedIds,
  onSuccess,
  onClearSelection,
  disabled = false,
}: Props) {
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [loading, setLoading] = useState<'assign' | 'unassign' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    const supabase = createClient();
    supabase
      .from('memberships')
      .select('user_id')
      .eq('org_id', orgId)
      .then(({ data: m }) => {
        const ids = (m ?? []).map((r: { user_id: string }) => r.user_id);
        if (ids.length === 0) {
          setMembers([]);
          return;
        }
        supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', ids)
          .then(({ data }) => {
            setMembers(
              (data ?? []).map((p: { id: string; full_name: string | null }) => ({
                user_id: p.id,
                full_name: p.full_name,
              }))
            );
          });
      });
  }, [orgId]);

  const doBulk = useCallback(
    async (assignedUserId: string | null) => {
      if (selectedIds.length === 0) return;
      setError(null);
      setLoading(assignedUserId ? 'assign' : 'unassign');
      const supabase = createClient();
      const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr || !refreshData?.session?.access_token) {
        setError('Sesión expirada. Vuelve a iniciar sesión.');
        setLoading(null);
        return;
      }
      const { data, error: fnErr } = await supabase.functions.invoke('bulk-update-shifts', {
        body: { ids: selectedIds, assigned_user_id: assignedUserId },
      });
      setLoading(null);
      setAssignOpen(false);
      const json = (data ?? {}) as { ok?: boolean; error?: string };
      if (fnErr || json.error) {
        setError(String(json.error || (fnErr as Error)?.message || 'Error al actualizar'));
        return;
      }
      onSuccess();
    },
    [selectedIds, onSuccess]
  );

  const handleAssign = useCallback(
    (userId: string) => {
      doBulk(userId);
    },
    [doBulk]
  );

  const handleUnassign = useCallback(() => {
    doBulk(null);
  }, [doBulk]);

  if (selectedIds.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary-200 bg-primary-50/50 p-3">
      <span className="text-sm font-medium text-text-primary">
        {selectedIds.length} turno{selectedIds.length !== 1 ? 's' : ''} seleccionado{selectedIds.length !== 1 ? 's' : ''}
      </span>

      <div className="relative">
        <button
          type="button"
          onClick={() => setAssignOpen((o) => !o)}
          disabled={disabled || !!loading}
          className="min-h-[40px] rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-text-primary hover:bg-subtle-bg disabled:opacity-50"
        >
          {loading === 'assign' ? 'Asignando…' : 'Asignar a…'}
        </button>
        {assignOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-10"
              onClick={() => setAssignOpen(false)}
              aria-label="Cerrar"
            />
            <div className="absolute left-0 top-full z-20 mt-1 max-h-56 min-w-[200px] overflow-y-auto rounded-lg border border-border bg-background py-2 shadow-lg">
              {members.map((m) => (
                <button
                  key={m.user_id}
                  type="button"
                  onClick={() => handleAssign(m.user_id)}
                  className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-subtle-bg"
                >
                  {m.full_name?.trim() || m.user_id}
                </button>
              ))}
              {members.length === 0 && (
                <p className="px-4 py-2 text-sm text-muted">No hay miembros</p>
              )}
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={handleUnassign}
        disabled={disabled || !!loading}
        className="min-h-[40px] rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-text-secondary hover:bg-subtle-bg disabled:opacity-50"
      >
        {loading === 'unassign' ? 'Desasignando…' : 'Desasignar'}
      </button>

      <button
        type="button"
        onClick={onClearSelection}
        disabled={!!loading}
        className="min-h-[40px] rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-subtle-bg hover:text-text-secondary disabled:opacity-50"
      >
        Cancelar selección
      </button>

      {error && (
        <p className="w-full text-sm text-red-600">
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-2 text-primary-600 hover:underline"
          >
            Cerrar
          </button>
        </p>
      )}
    </div>
  );
}
