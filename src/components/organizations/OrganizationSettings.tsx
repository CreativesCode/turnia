'use client';

import { InvitationsList } from '@/components/invitations/InvitationsList';
import { InviteUserForm } from '@/components/invitations/InviteUserForm';
import { OrganizationMembers } from '@/components/organizations/OrganizationMembers';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { IconAutogenSlug } from '@/components/ui/IconAutogenSlug';
import { createClient } from '@/lib/supabase/client';
import { generateSlug } from '@/lib/utils';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type Props = {
  orgId: string;
  backHref?: string;
  onDeleted?: () => void;
};

type Org = {
  id: string;
  name: string;
  slug: string | null;
  created_at: string;
  updated_at: string;
};

export function OrganizationSettings({ orgId, backHref, onDeleted }: Props) {
  const [org, setOrg] = useState<Org | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [inviteRefreshKey, setInviteRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from('organizations')
      .select('id, name, slug, created_at, updated_at')
      .eq('id', orgId)
      .single();
    setLoading(false);
    if (err || !data) {
      setError(err?.message ?? 'Organización no encontrada');
      return;
    }
    const o = data as Org;
    setOrg(o);
    setName(o.name);
    setSlug(o.slug ?? '');
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSuccess(null);
      setSaving(true);
      const supabase = createClient();
      const { error: err } = await supabase
        .from('organizations')
        .update({ name: name.trim(), slug: (slug.trim() || null) as string | null })
        .eq('id', orgId);
      setSaving(false);
      if (err) {
        setError(err.message);
        return;
      }
      setSuccess('Guardado');
      setTimeout(() => setSuccess(null), 2500);
      load();
    },
    [orgId, name, slug, load]
  );

  const doDelete = useCallback(async () => {
    if (!org) return;
    setDeleting(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from('organizations').delete().eq('id', orgId);
    setDeleting(false);
    setConfirmDelete(false);
    if (err) {
      setError(err.message);
      return;
    }
    onDeleted?.();
  }, [orgId, org, onDeleted]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
        <div className="h-6 w-48 animate-pulse rounded bg-subtle-bg" />
        <div className="mt-4 h-10 w-full animate-pulse rounded bg-subtle-bg" />
        <div className="mt-4 h-10 w-full animate-pulse rounded bg-subtle-bg" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
        <p className="text-red-600">{error ?? 'Organización no encontrada'}</p>
        {backHref && (
          <Link href={backHref} className="mt-2 inline-block text-sm text-primary-600 hover:text-primary-700">
            ← Volver
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
      {backHref && (
        <Link href={backHref} className="text-sm text-primary-600 hover:text-primary-700">
          ← Volver a Organizaciones
        </Link>
      )}
      <h2 className="mt-2 text-lg font-semibold text-text-primary">Configuración de la organización</h2>
      <p className="mt-1 text-sm text-text-secondary">
        Creada el {new Date(org.created_at).toLocaleDateString()}
      </p>

      <form onSubmit={save} className="mt-6 flex flex-col gap-4">
        <label className="block text-sm font-medium text-text-secondary">
          Nombre
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Mi Organización"
            className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </label>
        <label className="block text-sm font-medium text-text-secondary">
          Slug <span className="font-normal text-muted">(opcional, único en el sistema)</span>
          <div className="mt-1.5 flex gap-2">
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="mi-org"
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <button
              type="button"
              onClick={() => setSlug(generateSlug(name) || slug)}
              title="Autogenerar desde el nombre"
              aria-label="Autogenerar slug desde el nombre"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-subtle-bg text-muted hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600"
            >
              <IconAutogenSlug />
            </button>
          </div>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>

      <hr className="my-6 border-border" />

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Usuarios de la organización</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Miembros actuales e invitaciones pendientes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => document.getElementById('invite-form')?.scrollIntoView({ behavior: 'smooth' })}
            className="shrink-0 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
          >
            Invitar usuarios
          </button>
        </div>
        <div className="mt-3 space-y-4">
          <OrganizationMembers orgId={orgId} refreshKey={inviteRefreshKey} />
          <div id="invite-form">
            <h4 className="text-sm font-medium text-text-primary">Invitar usuarios</h4>
            <InviteUserForm
              orgId={orgId}
              onSuccess={() => setInviteRefreshKey((k) => k + 1)}
            />
            <div className="mt-4">
              <h4 className="mb-2 text-sm font-medium text-text-primary">Invitaciones</h4>
              <InvitationsList orgId={orgId} refreshKey={inviteRefreshKey} />
            </div>
          </div>
        </div>
      </div>

      <hr className="my-6 border-border" />
      <div>
        <h3 className="text-sm font-semibold text-text-primary">Zona de peligro</h3>
        <p className="mt-1 text-sm text-text-secondary">
Eliminar la organización borrará todos los miembros, turnos e invitaciones
        asociados. Esta acción no se puede deshacer.
        </p>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="mt-3 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          Eliminar organización
        </button>
      </div>

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={doDelete}
        title="Eliminar organización"
        message={`¿Eliminar "${org.name}"? Se borrarán todos los miembros, turnos e invitaciones. No se puede deshacer.`}
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
