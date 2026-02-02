'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      setDone(true);
      setLoading(false);
    } catch (e2) {
      setError(String(e2));
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-text-primary">Revisa tu correo</h1>
        <p className="mt-3 text-sm text-text-secondary">
          Si existe una cuenta con <strong>{email}</strong>, te enviamos un enlace para restablecer la contraseña.
        </p>
        <div className="mt-6 text-center text-sm">
          <Link href="/login" className="font-medium text-primary-600 hover:text-primary-700">
            Volver a iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-text-primary">Recuperar contraseña</h1>
      <p className="mt-3 text-sm text-text-secondary">
        Te enviaremos un enlace para restablecer tu contraseña.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <label htmlFor="forgot-email" className="text-sm font-medium text-text-primary">
            Correo electrónico
          </label>
          <Input
            id="forgot-email"
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button type="submit" loading={loading} className="w-full">
          Enviar enlace
        </Button>
      </form>

      <div className="mt-5 text-center text-xs text-muted">
        <Link href="/login" className="text-primary-600 hover:text-primary-700">
          Volver
        </Link>
      </div>
    </div>
  );
}

