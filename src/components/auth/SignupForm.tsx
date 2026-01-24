'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
      router.replace('/dashboard');
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
        <h1 className="mb-4 text-xl font-semibold text-text-primary">Cuenta creada</h1>
        <p className="mb-4 text-sm text-text-secondary">
          Revisa tu correo para confirmar. Si tu proyecto tiene confirmación desactivada, ya puedes
          <a href="/login" className="ml-1 text-primary-600 underline hover:text-primary-700">iniciar sesión</a>.
        </p>
        <p className="text-xs text-text-secondary">
          Para ser <strong>Org Admin</strong> de la primera organización, ejecuta el SQL de
          <code className="mx-1 rounded bg-subtle-bg px-1 text-text-primary">docs/first-admin.md</code> en Supabase.
        </p>
        <p className="mt-4 text-center text-xs text-muted">
          <a href="/login" className="text-primary-600 hover:text-primary-700">Ir a inicio de sesión</a> · <a href="/" className="text-primary-600 hover:text-primary-700">Volver</a>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
      <h1 className="mb-4 text-xl font-semibold text-text-primary">Crear cuenta</h1>
      <p className="mb-4 text-sm text-text-secondary">Regístrate para usar Turnia.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="Nombre completo"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
          {loading ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>
      <p className="mt-4 text-center text-xs text-muted">
        ¿Ya tienes cuenta? <a href="/login" className="text-primary-600 underline hover:text-primary-700">Entrar</a> · <a href="/" className="text-primary-600 hover:text-primary-700">Volver</a>
      </p>
    </div>
  );
}
