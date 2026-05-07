'use client';

import { AuthPasswordField } from '@/components/auth/AuthPasswordField';
import { AuthShell } from '@/components/auth/AuthShell';
import { CheckIcon, XIcon } from '@/components/ui/icons';
import { Spinner } from '@/components/ui/Spinner';
import { redirectAfterAuth } from '@/lib/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type Requirement = { label: string; ok: boolean };

function buildRequirements(value: string): Requirement[] {
  return [
    { label: 'Al menos 8 caracteres', ok: value.length >= 8 },
    { label: 'Una mayúscula', ok: /[A-Z]/.test(value) },
    { label: 'Un número', ok: /\d/.test(value) },
    { label: 'Un símbolo', ok: /[^A-Za-z0-9]/.test(value) },
  ];
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const requirements = useMemo(() => buildRequirements(password), [password]);
  const allOk = requirements.every((r) => r.ok);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setReady(true);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!allOk) {
      setError('La contraseña no cumple todos los requisitos.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDone(true);
    window.setTimeout(() => redirectAfterAuth(router, '/login'), 1200);
  };

  if (!ready) {
    return (
      <AuthShell title="Cargando…">
        <div className="flex justify-center py-6 text-text-sec">
          <Spinner />
        </div>
      </AuthShell>
    );
  }

  if (!hasSession) {
    return (
      <AuthShell
        title="Enlace inválido o expirado"
        subtitle="Vuelve a solicitar un enlace de recuperación."
        footer={
          <Link href="/login" className="font-semibold text-primary">
            Volver
          </Link>
        }
      >
        <div className="flex justify-center">
          <Link
            href="/forgot-password"
            className="flex h-[50px] items-center justify-center gap-2 rounded-xl bg-primary px-5 text-[14.5px] font-bold text-white"
            style={{ boxShadow: '0 10px 24px -12px var(--color-primary)' }}
          >
            Recuperar contraseña
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell
        title="Contraseña actualizada"
        subtitle="Te estamos redirigiendo a inicio de sesión…"
      >
        <div className="flex justify-center py-2 text-primary">
          <Spinner />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Nueva contraseña"
      subtitle="Elige una contraseña segura para tu cuenta."
      footer={
        <Link href="/login" className="font-semibold text-primary">
          Volver
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <AuthPasswordField
          label="Nueva contraseña"
          placeholder="Mínimo 8 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
        <AuthPasswordField
          label="Confirmar contraseña"
          placeholder="Repite la contraseña"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />

        <div className="mt-1">
          <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-muted">
            Requisitos
          </p>
          <ul className="flex flex-col gap-1.5">
            {requirements.map((r) => (
              <li
                key={r.label}
                className="flex items-center gap-2 text-[12.5px] transition-colors"
                style={{ color: r.ok ? 'var(--color-green)' : 'var(--color-muted)' }}
              >
                <span
                  className="flex h-4 w-4 items-center justify-center rounded-full"
                  style={{
                    background: r.ok ? 'var(--color-green-soft)' : 'var(--color-subtle)',
                  }}
                >
                  {r.ok ? <CheckIcon size={11} stroke={3} /> : <XIcon size={10} stroke={3} />}
                </span>
                {r.label}
              </li>
            ))}
          </ul>
        </div>

        {error ? <p className="text-sm text-red">{error}</p> : null}

        <button
          type="submit"
          disabled={loading || !allOk || password !== confirm}
          className="relative mt-2 flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-primary text-[14.5px] font-bold text-white transition-opacity disabled:opacity-50"
          style={{ boxShadow: '0 10px 24px -12px var(--color-primary)' }}
        >
          {loading ? <Spinner aria-label="Cargando" /> : 'Actualizar contraseña'}
        </button>
      </form>
    </AuthShell>
  );
}
