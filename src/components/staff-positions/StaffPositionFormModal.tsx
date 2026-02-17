'use client';

import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';

export type StaffPositionRow = {
  id: string;
  org_id: string;
  name: string;
  sort_order: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orgId: string;
  editing: StaffPositionRow | null;
};

export function StaffPositionFormModal({
  open,
  onClose,
  onSuccess,
  orgId,
  editing,
}: Props) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name);
      } else {
        setName('');
      }
      setError(null);
    }
  }, [open, editing]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      const trimmed = name.trim();
      if (!trimmed) {
        setError('Escribe el nombre del puesto.');
        return;
      }
      setSaving(true);
      const supabase = createClient();
      if (editing) {
        const { error: err } = await supabase
          .from('organization_staff_positions')
          .update({ name: trimmed })
          .eq('id', editing.id)
          .eq('org_id', orgId);
        setSaving(false);
        if (err) {
          setError(err.message);
          return;
        }
      } else {
        const maxOrderRes = await supabase
          .from('organization_staff_positions')
          .select('sort_order')
          .eq('org_id', orgId)
          .order('sort_order', { ascending: false })
          .limit(1)
          .maybeSingle();
        const nextOrder =
          ((maxOrderRes.data as { sort_order?: number } | null)?.sort_order ?? -1) + 1;
        const { error: err } = await supabase.from('organization_staff_positions').insert({
          org_id: orgId,
          name: trimmed,
          sort_order: nextOrder,
        });
        setSaving(false);
        if (err) {
          setError(err.message);
          return;
        }
      }
      onSuccess();
      onClose();
    },
    [orgId, editing, name, onSuccess, onClose]
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      closeOnEscape={!saving}
      title={editing ? 'Editar puesto' : 'Nuevo puesto'}
      panelClassName="max-w-sm"
    >
      <form onSubmit={submit}>
        <div>
          <label htmlFor="staff-position-name" className="block text-sm font-medium text-text-secondary">
            Nombre
          </label>
          <input
            id="staff-position-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Médico Turnate, Médico de refuerzo"
            className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary focus:border-primary-500 focus:outline-none"
          />
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="min-h-[44px] min-w-[44px] rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-subtle-bg disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] min-w-[44px] rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
