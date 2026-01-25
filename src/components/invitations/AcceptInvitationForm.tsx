'use client';

import { createClient } from '@/lib/supabase/client';
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
  const [signupMode, setSignupMode] = useState<'choice' | 'signup'>('choice');
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
    router.replace('/dashboard');
  }, [token, router]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.signUp({
      email: invitation.email,
      password,
      options: { data: { full_name: fullName } },
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
    setError('Revisa tu correo para confirmar la cuenta. Luego inicia sesión y vuelve a esta página para aceptar la invitación.');
  };

  if (isLoggedIn && !emailMatches) {
    return (
      <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
        <h1 className="mb-4 text-xl font-semibold text-text-primary">Invitación para otro correo</h1>
        <p className="mb-4 text-sm text-text-secondary">
          Has iniciado sesión como <strong>{sessionUser?.email}</strong>. Esta invitación es para{' '}
          <strong>{invitation.email}</strong>.
        </p>
        <p className="mb-4 text-sm text-text-secondary">
          Cierra sesión e inicia con {invitation.email}, o crea una cuenta nueva con ese correo.
        </p>
        <p className="flex flex-wrap gap-2 text-sm">
          <a
            href={`/login?redirect=${encodeURIComponent(`/invite?token=${encodeURIComponent(token)}`)}`}
            className="text-primary-600 underline hover:text-primary-700"
          >
            Iniciar sesión con otro correo
          </a>
          <span className="text-muted">·</span>
          <a href="/" className="text-primary-600 hover:text-primary-700">
            Volver
          </a>
        </p>
      </div>
    );
  }

  if (isLoggedIn && emailMatches) {
    return (
      <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
        <h1 className="mb-4 text-xl font-semibold text-text-primary">Aceptar invitación</h1>
        <div className="mb-4 rounded-lg border border-border bg-subtle-bg p-3 text-sm text-text-secondary">
          <p className="font-medium text-text-primary">{invitation.org_name || 'Organización'}</p>
          <p>Rol: {ROLE_LABELS[invitation.role] || invitation.role}</p>
          {invitation.invited_by_name && <p className="mt-1 text-muted">Invitado por {invitation.invited_by_name}</p>}
        </div>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <button
          type="button"
          onClick={acceptInvitation}
          disabled={loading}
          className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? 'Aceptando…' : 'Aceptar invitación'}
        </button>
        <p className="mt-4 text-center text-xs text-muted">
          <a href="/" className="text-primary-600 hover:text-primary-700">Volver</a>
        </p>
      </div>
    );
  }

  if (signupMode === 'signup') {
    return (
      <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
        <h1 className="mb-4 text-xl font-semibold text-text-primary">Crear cuenta y aceptar</h1>
        <p className="mb-4 text-sm text-text-secondary">
          Te unirás a <strong>{invitation.org_name || 'la organización'}</strong> como{' '}
          <strong>{ROLE_LABELS[invitation.role] || invitation.role}</strong>.
        </p>
        <form onSubmit={handleSignup} className="flex flex-col gap-4">
          <input
            type="email"
            value={invitation.email}
            readOnly
            className="rounded-lg border border-border bg-subtle-bg px-3 py-2.5 text-sm text-muted"
          />
          <input
            type="text"
            placeholder="Nombre completo"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <input
            type="password"
            placeholder="Contraseña (mín. 6 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? 'Creando…' : 'Crear cuenta y aceptar'}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-muted">
          <button
            type="button"
            onClick={() => { setSignupMode('choice'); setError(null); }}
            className="text-primary-600 hover:text-primary-700"
          >
            ¿Ya tienes cuenta? Iniciar sesión
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
      <h1 className="mb-4 text-xl font-semibold text-text-primary">Invitación a Turnia</h1>
      <div className="mb-4 rounded-lg border border-border bg-subtle-bg p-3 text-sm text-text-secondary">
        <p className="font-medium text-text-primary">{invitation.org_name || 'Organización'}</p>
        <p>Te invitan como: {ROLE_LABELS[invitation.role] || invitation.role}</p>
        <p className="mt-1">Correo: {invitation.email}</p>
        {invitation.invited_by_name && <p className="text-muted">Invitado por {invitation.invited_by_name}</p>}
      </div>
      <p className="mb-4 text-sm text-text-secondary">Elige cómo continuar:</p>
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setSignupMode('signup')}
          className="rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-subtle-bg focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          Crear cuenta con {invitation.email}
        </button>
        <a
          href={`/login?redirect=${encodeURIComponent(`/invite?token=${encodeURIComponent(token)}`)}`}
          className="rounded-lg bg-primary-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-primary-700"
        >
          Ya tengo cuenta · Iniciar sesión
        </a>
      </div>
      <p className="mt-4 text-center text-xs text-muted">
        <a href="/" className="text-primary-600 hover:text-primary-700">Volver</a>
      </p>
    </div>
  );
}
