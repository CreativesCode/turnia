'use client';

import { IconAutogenSlug } from '@/components/ui/IconAutogenSlug';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { createClient } from '@/lib/supabase/client';
import { generateSlug } from '@/lib/utils';
import { useCallback, useEffect, useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

/**
 * Modal para crear organización. Solo superadmin (RLS: orgs_insert_superadmin).
 * Compatible con SPA + Capacitor.
 */
export function CreateOrganizationModal({ open, onClose, onCreated }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setSlug('');
      setError(null);
    }
  }, [open]);

  const onEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && !loading) onClose();
    },
    [open, loading, onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [open, onEscape]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);
      const supabase = createClient();
      const { error: err } = await supabase.from('organizations').insert({
        name: name.trim(),
        slug: (slug.trim() || null) as string | null,
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
    [name, slug, onCreated, onClose, toast]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-org-modal-title"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
        aria-label="Cerrar"
      />
      <div className="relative w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-lg">
        <h2 id="create-org-modal-title" className="text-lg font-semibold text-text-primary">
          Crear organización
        </h2>
        <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
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
      </div>
    </div>
  );
}
