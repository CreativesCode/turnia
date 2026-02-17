'use client';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { PENDING_INVITE_TOKEN_KEY } from '@/lib/invite';
import { redirectAfterAuth } from '@/lib/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

export type InvitationData = {
  ok: true;
  invitation_id: string;
  email: string;
  role: string;
  org_id: string;
  org_name: string | null;
  org_slug: string | null;
  invited_by_name: string | null;
  expires_at: string;
};

type SessionUser = { email?: string | null };

type Props = {
  invitation: InvitationData;
  sessionUser: SessionUser | null;
  token: string;
};

const ROLE_LABELS: Record<string, string> = {
  org_admin: 'Administrador de organización',
  team_manager: 'Gestor de equipo',
  user: 'Usuario',
  viewer: 'Solo lectura',
};

export function AcceptInvitationForm({ invitation, sessionUser, token }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');

  const invEmail = invitation.email.trim().toLowerCase();
  const userEmail = (sessionUser?.email ?? '').trim().toLowerCase();
  const isLoggedIn = !!sessionUser?.email;
  const emailMatches = isLoggedIn && userEmail === invEmail;

  const acceptInvitation = useCallback(async () => {
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setError('Sesión expirada. Recarga la página e inicia sesión de nuevo.');
      setLoading(false);
      return;
    }
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/accept-invitation`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ token }),
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(json.error || 'Error al aceptar la invitación');
      return;
    }
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
    }
    redirectAfterAuth(router, '/dashboard');
  }, [token, router]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const redirectToInvite = origin ? `${origin}/invite?token=${encodeURIComponent(token)}` : undefined;
    const { data, error: err } = await supabase.auth.signUp({
      email: invitation.email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: redirectToInvite,
      },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (data.session) {
      await acceptInvitation();
      return;
    }
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(PENDING_INVITE_TOKEN_KEY, token);
    }
    setError(
      'Revisa tu correo para confirmar la cuenta. Al hacer clic en el enlace del correo llegarás aquí para aceptar la invitación.'
    );
  };

  if (isLoggedIn && !emailMatches) {
    return (
      <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Turnia" className="mx-auto h-20 w-20" />
        <h1 className="mt-5 text-center text-2xl font-bold text-text-primary">Invitación para otro correo</h1>
        <p className="mt-3 text-center text-sm text-text-secondary">
          Has iniciado sesión como <strong>{sessionUser?.email}</strong>. Esta invitación es para{' '}
          <strong>{invitation.email}</strong>.
        </p>
        <p className="mt-3 text-center text-sm text-text-secondary">
          Cierra sesión e inicia con {invitation.email}, o crea una cuenta nueva con ese correo.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
          <Link
            href={`/login?redirect=${encodeURIComponent(`/invite?token=${encodeURIComponent(token)}`)}`}
            className="font-medium text-primary-600 hover:text-primary-700"
          >
            Iniciar sesión con otro correo
          </Link>
          <span className="text-muted" aria-hidden>
            ·
          </span>
          <Link href="/" className="font-medium text-primary-600 hover:text-primary-700">
            Volver
          </Link>
        </div>
      </div>
    );
  }

  if (isLoggedIn && emailMatches) {
    return (
      <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Turnia" className="mx-auto h-20 w-20" />

        <div className="mt-5 text-center">
          <h1 className="text-2xl font-bold text-text-primary">¡Te han invitado!</h1>
          <p className="mt-2 text-sm text-text-secondary">Has sido invitado a unirte a</p>
          <p className="mt-2 text-lg font-semibold text-primary-600">{invitation.org_name || 'la organización'}</p>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-subtle-bg p-5">
          <p className="text-sm font-semibold text-text-secondary">Detalles de la invitación</p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted">Rol</span>
              <span className="font-medium text-text-primary">{ROLE_LABELS[invitation.role] || invitation.role}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted">Correo</span>
              <span className="font-medium text-text-primary">{invitation.email}</span>
            </div>
            {invitation.invited_by_name ? (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted">Invitado por</span>
                <span className="font-medium text-text-primary">{invitation.invited_by_name}</span>
              </div>
            ) : null}
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <div className="mt-5">
          <Button type="button" onClick={acceptInvitation} loading={loading} className="w-full">
            Aceptar invitación
          </Button>
        </div>

        <div className="mt-5 text-center text-xs text-muted">
          <Link href="/" className="text-primary-600 hover:text-primary-700">
            Volver
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Turnia" className="mx-auto h-20 w-20" />

      <div className="mt-5 text-center">
        <h1 className="text-2xl font-bold text-text-primary">¡Te han invitado!</h1>
        <p className="mt-2 text-sm text-text-secondary">Has sido invitado a unirte a</p>
        <p className="mt-2 text-lg font-semibold text-primary-600">{invitation.org_name || 'la organización'}</p>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-subtle-bg p-5">
        <p className="text-sm font-semibold text-text-secondary">Detalles de la invitación</p>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted">Rol</span>
            <span className="font-medium text-text-primary">{ROLE_LABELS[invitation.role] || invitation.role}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted">Correo</span>
            <span className="font-medium text-text-primary">{invitation.email}</span>
          </div>
          {invitation.invited_by_name ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted">Invitado por</span>
              <span className="font-medium text-text-primary">{invitation.invited_by_name}</span>
            </div>
          ) : null}
        </div>
      </div>

      <form onSubmit={handleSignup} className="mt-6 flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text-primary" htmlFor="invite-email">
            Correo
          </label>
          <Input id="invite-email" type="email" value={invitation.email} readOnly className="bg-subtle-bg text-muted" />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text-primary" htmlFor="invite-name">
            Tu nombre
          </label>
          <Input
            id="invite-name"
            type="text"
            placeholder="Ingresa tu nombre"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text-primary" htmlFor="invite-pass">
            Crear contraseña
          </label>
          <PasswordInput
            id="invite-pass"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button type="submit" loading={loading} className="w-full">
          Aceptar invitación
        </Button>
      </form>

      <div className="mt-5 text-center text-xs text-muted">
        <Link
          href={`/login?redirect=${encodeURIComponent(`/invite?token=${encodeURIComponent(token)}`)}`}
          className="text-primary-600 hover:text-primary-700"
        >
          ¿Ya tienes cuenta? Iniciar sesión
        </Link>
      </div>
    </div>
  );
}
