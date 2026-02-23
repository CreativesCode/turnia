'use client';

import { IconAutogenSlug } from '@/components/ui/IconAutogenSlug';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { createClient } from '@/lib/supabase/client';
import { generateSlug } from '@/lib/utils';
import { useCallback, useEffect, useState } from 'react';

type ParentOption = { id: string; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

/**
 * Modal para crear organización. Superadmin puede crear raíz o suborganización;
 * org_admin puede crear suborganización bajo una org que administra (2 niveles).
 */
export function CreateOrganizationModal({ open, onClose, onCreated }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [parentOptions, setParentOptions] = useState<ParentOption[]>([]);
  const [canCreateRoot, setCanCreateRoot] = useState(false);
  const [loadingParents, setLoadingParents] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setSlug('');
      setError(null);
      setParentId(null);
      const supabase = createClient();
      setLoadingParents(true);
      supabase
        .rpc('get_my_accessible_organizations')
        .then(({ data: rows }) => {
          const list = (rows ?? []) as { id: string; name: string; parent_id: string | null; role: string }[];
          const roots = list.filter((r) => !r.parent_id && ['org_admin', 'superadmin'].includes(r.role ?? ''));
          setParentOptions(roots.map((r) => ({ id: r.id, name: r.name })));
          setCanCreateRoot(list.some((r) => ['org_admin', 'superadmin'].includes(r.role ?? '')));
          if (roots.length > 0 && !list.some((r) => ['org_admin', 'superadmin'].includes(r.role ?? ''))) setParentId(roots[0]?.id ?? null);
        })
        .finally(() => setLoadingParents(false));
    }
  }, [open]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);
      const supabase = createClient();
      const { error: err } = await supabase.from('organizations').insert({
        name: name.trim(),
        slug: (slug.trim() || null) as string | null,
        parent_id: parentId || null,
      });
      setLoading(false);
      if (err) {
        setError(err.message);
        toast({ variant: 'error', title: 'No se pudo crear', message: err.message });
        return;
      }
      onCreated();
      onClose();
      toast({ variant: 'success', title: 'Organización creada', message: 'La organización se creó correctamente.' });
    },
    [name, slug, parentId, onCreated, onClose, toast]
  );

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Crear organización"
      closeOnEscape={!loading}
      panelClassName="max-w-sm"
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="block text-sm font-medium text-text-secondary">
          Nombre
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Mi Organización"
            className="mt-1.5"
          />
        </label>
        {(parentOptions.length > 0 || canCreateRoot) && (
          <label className="block text-sm font-medium text-text-secondary">
            Organización padre
            <select
              value={parentId ?? ''}
              onChange={(e) => setParentId(e.target.value || null)}
              disabled={loadingParents}
              className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary disabled:opacity-50"
            >
              {canCreateRoot && <option value="">Ninguna (organización raíz)</option>}
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-muted">
              Ninguna = organización raíz. O elige una para crear una suborganización.
            </span>
          </label>
        )}
        <label className="block text-sm font-medium text-text-secondary">
          Slug <span className="font-normal text-muted">(opcional, único)</span>
          <div className="mt-1.5 flex gap-2">
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="mi-org"
              className="min-w-0 flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => setSlug(generateSlug(name) || slug)}
              title="Autogenerar desde el nombre"
              aria-label="Autogenerar slug desde el nombre"
              className="h-11 w-11 bg-subtle-bg text-muted hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600"
            >
              <IconAutogenSlug />
            </Button>
          </div>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            Crear
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
