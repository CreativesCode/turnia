'use client';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export function ResetPasswordForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
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
    // Opcional: redirigir a login tras unos segundos.
    window.setTimeout(() => router.replace('/login'), 1200);
  };

  if (!ready) {
    return (
      <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
        <p className="text-center text-text-secondary">Cargando…</p>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-text-primary">Enlace inválido o expirado</h1>
        <p className="mt-3 text-sm text-text-secondary">
          Vuelve a solicitar un enlace de recuperación.
        </p>
        <div className="mt-6 text-center text-sm">
          <Link href="/forgot-password" className="font-medium text-primary-600 hover:text-primary-700">
            Recuperar contraseña
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-text-primary">Contraseña actualizada</h1>
        <p className="mt-3 text-sm text-text-secondary">Redirigiendo a inicio de sesión…</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-text-primary">Restablecer contraseña</h1>
      <p className="mt-3 text-sm text-text-secondary">Elige una nueva contraseña para tu cuenta.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <label htmlFor="reset-pass" className="text-sm font-medium text-text-primary">
            Nueva contraseña
          </label>
          <Input
            id="reset-pass"
            type="password"
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="reset-confirm" className="text-sm font-medium text-text-primary">
            Confirmar contraseña
          </label>
          <Input
            id="reset-confirm"
            type="password"
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button type="submit" loading={loading} className="w-full">
          Guardar contraseña
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

