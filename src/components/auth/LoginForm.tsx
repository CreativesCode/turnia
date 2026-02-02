'use client';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { redirectAfterAuth } from '@/lib/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/dashboard';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    redirectAfterAuth(router, redirect);
  }

  return (
    <div className="flex flex-col gap-10">
      {/* Mobile header (según Login - Mobile) */}
      <div className="flex flex-col items-center gap-3 text-center lg:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Turnia" className="h-16 w-16 rounded-2xl" />
        <h1 className="text-3xl font-bold text-text-primary">Turnia</h1>
        <p className="text-sm text-text-secondary">Gestión inteligente de turnos</p>
      </div>

      {/* Desktop header (según Login - Desktop) */}
      <div className="hidden lg:block">
        <h1 className="text-3xl font-bold text-text-primary">Bienvenido de vuelta</h1>
        <p className="mt-2 text-sm text-text-secondary">Ingresa tus credenciales para continuar</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text-primary" htmlFor="login-email">
            Correo electrónico
          </label>
          <Input
            id="login-email"
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text-primary" htmlFor="login-password">
            Contraseña
          </label>
          <PasswordInput
            id="login-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <div className="-mt-1 flex justify-end">
          <Link href="/forgot-password" className="text-sm font-medium text-primary-600 hover:text-primary-700">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        {error ? <p className="-mt-1 text-sm text-red-600">{error}</p> : null}

        <Button type="submit" loading={loading} className="w-full">
          Iniciar sesión
        </Button>

        {/* Divider + Signup row (mobile) */}
        <div className="lg:hidden">
          <div className="my-2 flex items-center gap-4">
            <div className="h-px w-full bg-border" />
            <span className="text-sm text-muted">o</span>
            <div className="h-px w-full bg-border" />
          </div>
          <div className="flex items-center justify-center gap-2 text-sm">
            <span className="text-text-secondary">¿No tienes cuenta?</span>
            <Link href="/signup" className="font-semibold text-primary-600 hover:text-primary-700">
              Regístrate
            </Link>
          </div>
        </div>

        {/* Desktop signup row */}
        <div className="hidden items-center justify-center gap-2 text-sm lg:flex">
          <span className="text-text-secondary">¿No tienes cuenta?</span>
          <Link href="/signup" className="font-semibold text-primary-600 hover:text-primary-700">
            Regístrate gratis
          </Link>
        </div>
      </form>
    </div>
  );
}
