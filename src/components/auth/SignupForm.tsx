'use client';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { redirectAfterAuth } from '@/lib/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (data.session) {
      redirectAfterAuth(router, '/dashboard');
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-text-primary">Cuenta creada</h1>
        <p className="mt-3 text-sm text-text-secondary">
          Revisa tu correo para confirmar. Si tu proyecto tiene confirmación desactivada, ya puedes{' '}
          <Link href="/login" className="font-medium text-primary-600 hover:text-primary-700">
            iniciar sesión
          </Link>
          .
        </p>
        <p className="mt-4 text-xs text-text-secondary">
          Para ser <strong>Org Admin</strong> de la primera organización, ejecuta el SQL de{' '}
          <code className="mx-1 rounded bg-subtle-bg px-1 text-text-primary">docs/first-admin.md</code> en Supabase.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-muted">
          <Link href="/login" className="text-primary-600 hover:text-primary-700">
            Ir a inicio de sesión
          </Link>
          <span aria-hidden>·</span>
          <Link href="/" className="text-primary-600 hover:text-primary-700">
            Volver
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start gap-4">
        <Link
          href="/login"
          className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-subtle-bg lg:hidden"
          aria-label="Volver"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-text-primary">Crear cuenta</h1>
          <p className="mt-2 text-sm text-text-secondary">Completa tus datos para registrarte</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text-primary" htmlFor="signup-name">
            Nombre completo
          </label>
          <Input
            id="signup-name"
            type="text"
            placeholder="Juan Pérez"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text-primary" htmlFor="signup-email">
            Correo electrónico
          </label>
          <Input
            id="signup-email"
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text-primary" htmlFor="signup-password">
            Contraseña
          </label>
          <PasswordInput
            id="signup-password"
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text-primary" htmlFor="signup-confirm">
            Confirmar contraseña
          </label>
          <PasswordInput
            id="signup-confirm"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button type="submit" loading={loading} className="w-full">
          Crear cuenta
        </Button>
      </form>

      <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted">
        <span>¿Ya tienes cuenta?</span>
        <Link href="/login" className="text-primary-600 hover:text-primary-700">
          Entrar
        </Link>
        <span aria-hidden>·</span>
        <Link href="/" className="text-primary-600 hover:text-primary-700">
          Volver
        </Link>
      </div>
    </div>
  );
}
