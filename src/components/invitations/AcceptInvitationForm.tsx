'use client';

import { AuthPasswordField } from '@/components/auth/AuthPasswordField';
import { AuthShell } from '@/components/auth/AuthShell';
import { getContrastTextColor } from '@/lib/colorContrast';
import { Field } from '@/components/ui/Field';
import { ArrowRightIcon, MailIcon, UserIcon } from '@/components/ui/icons';
import { Spinner } from '@/components/ui/Spinner';
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

const ORG_PALETTE = ['#0EA5E9', '#14B8A6', '#8B5CF6', '#F97316', '#22C55E', '#EC4899', '#F59E0B', '#A78BFA'];

function colorForOrg(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return ORG_PALETTE[Math.abs(hash) % ORG_PALETTE.length];
}

function orgInitials(name: string | null): string {
  const base = (name ?? '').trim();
  if (!base) return 'OR';
  const parts = base.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? '?';
  const b = parts[1]?.[0] ?? parts[0]?.[1] ?? '';
  return (a + b).toUpperCase();
}

function OrgCard({ invitation }: { invitation: InvitationData }) {
  const color = colorForOrg(invitation.org_id || invitation.org_name || invitation.email);
  const text = getContrastTextColor(color);
  const initials = orgInitials(invitation.org_name);
  return (
    <div className="mb-4 flex items-center gap-3.5 rounded-2xl border border-border bg-subtle-bg p-4">
      <div
        className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-[15px] font-extrabold"
        style={{ background: color, color: text }}
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14.5px] font-bold text-text">
          {invitation.org_name || 'Organización'}
        </div>
        <div className="mt-0.5 truncate text-xs text-muted">
          {ROLE_LABELS[invitation.role] || invitation.role}
          {invitation.invited_by_name ? <> · invitado por {invitation.invited_by_name}</> : null}
        </div>
      </div>
    </div>
  );
}

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
    const {
      data: { session },
    } = await supabase.auth.getSession();
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

    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/signup-and-accept-invitation`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      },
      body: JSON.stringify({ token, password, full_name: fullName }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };

    if (!res.ok) {
      setLoading(false);
      if (res.status === 409 && json.error === 'user_exists') {
        setError(json.message ?? 'Ya tienes cuenta con este correo. Inicia sesión.');
        return;
      }
      setError(json.message ?? json.error ?? 'Error al aceptar la invitación');
      return;
    }

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: invitation.email,
      password,
    });
    setLoading(false);
    if (signInErr) {
      setError(`Cuenta creada, pero no pude iniciar sesión: ${signInErr.message}.`);
      return;
    }

    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
    }
    redirectAfterAuth(router, '/dashboard');
  };

  /* Caso: sesión iniciada con correo distinto */
  if (isLoggedIn && !emailMatches) {
    return (
      <AuthShell
        title="Invitación para otro correo"
        subtitle={
          <>
            Has iniciado sesión como <strong className="text-text">{sessionUser?.email}</strong>.
            <br />
            Esta invitación es para <strong className="text-text">{invitation.email}</strong>.
          </>
        }
        footer={
          <>
            <Link
              href={`/login?redirect=${encodeURIComponent(`/invite?token=${encodeURIComponent(token)}`)}`}
              className="font-semibold text-primary"
            >
              Iniciar sesión con otro correo
            </Link>
            <span className="mx-2">·</span>
            <Link href="/" className="font-semibold text-primary">
              Volver
            </Link>
          </>
        }
      >
        <OrgCard invitation={invitation} />
      </AuthShell>
    );
  }

  /* Caso: sesión válida, solo confirmar */
  if (isLoggedIn && emailMatches) {
    return (
      <AuthShell
        title="Te invitaron a Turnia"
        subtitle={
          <>
            <b className="text-text">{invitation.org_name || 'Una organización'}</b> te invitó a unirte
            como <b className="text-primary">{ROLE_LABELS[invitation.role] || invitation.role}</b>.
          </>
        }
        footer={
          <Link href="/" className="font-semibold text-primary">
            Volver
          </Link>
        }
      >
        <OrgCard invitation={invitation} />

        {error ? <p className="mb-3 text-sm text-red">{error}</p> : null}

        <button
          type="button"
          onClick={acceptInvitation}
          disabled={loading}
          className="relative flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-primary text-[14.5px] font-bold text-white transition-opacity disabled:opacity-60"
          style={{ boxShadow: '0 10px 24px -12px var(--color-primary)' }}
        >
          {loading ? (
            <Spinner aria-label="Cargando" />
          ) : (
            <>
              Aceptar invitación <ArrowRightIcon size={16} stroke={2.6} />
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => router.push('/')}
          className="mt-2.5 h-11 w-full rounded-xl border border-border bg-transparent text-[13px] font-medium text-muted"
        >
          Rechazar invitación
        </button>
      </AuthShell>
    );
  }

  /* Caso: sin sesión (signup + accept) */
  return (
    <AuthShell
      title="Te invitaron a Turnia"
      subtitle={
        <>
          <b className="text-text">{invitation.org_name || 'Una organización'}</b> te invitó a unirte
          como <b className="text-primary">{ROLE_LABELS[invitation.role] || invitation.role}</b>.
        </>
      }
      footer={
        <Link
          href={`/login?redirect=${encodeURIComponent(`/invite?token=${encodeURIComponent(token)}`)}`}
          className="font-semibold text-primary"
        >
          ¿Ya tienes cuenta? Iniciar sesión
        </Link>
      }
    >
      <OrgCard invitation={invitation} />

      <form onSubmit={handleSignup} className="flex flex-col gap-3.5">
        <Field
          variant="mobile"
          label="Email"
          leading={<MailIcon size={18} />}
          value={invitation.email}
          readOnly
          className="opacity-80"
        />
        <Field
          variant="mobile"
          label="Tu nombre"
          type="text"
          placeholder="Ana Morales"
          leading={<UserIcon size={18} />}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          autoComplete="name"
        />
        <AuthPasswordField
          label="Contraseña"
          placeholder="Mínimo 8 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />

        {error ? <p className="text-sm text-red">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="relative mt-1 flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-primary text-[14.5px] font-bold text-white transition-opacity disabled:opacity-60"
          style={{ boxShadow: '0 10px 24px -12px var(--color-primary)' }}
        >
          {loading ? (
            <Spinner aria-label="Cargando" />
          ) : (
            <>
              Aceptar invitación <ArrowRightIcon size={16} stroke={2.6} />
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => router.push('/')}
          className="mt-1 h-11 w-full rounded-xl border border-border bg-transparent text-[13px] font-medium text-muted"
        >
          Rechazar invitación
        </button>
      </form>
    </AuthShell>
  );
}
