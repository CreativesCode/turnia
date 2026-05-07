'use client';

import { AuthShell } from '@/components/auth/AuthShell';
import { Field } from '@/components/ui/Field';
import { ArrowRightIcon, MailIcon } from '@/components/ui/icons';
import { Spinner } from '@/components/ui/Spinner';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useState } from 'react';

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
      <AuthShell
        title="Revisa tu correo"
        subtitle={
          <>
            Si existe una cuenta con <strong className="text-text">{email}</strong>, te enviamos un enlace
            para restablecer la contraseña.
          </>
        }
        footer={
          <Link href="/login" className="font-semibold text-primary">
            Volver a iniciar sesión
          </Link>
        }
      >
        <div className="flex justify-center">
          <Link
            href="/login"
            className="flex h-[50px] items-center justify-center gap-2 rounded-xl bg-primary px-5 text-[14.5px] font-bold text-white"
            style={{ boxShadow: '0 10px 24px -12px var(--color-primary)' }}
          >
            Ir a iniciar sesión <ArrowRightIcon size={16} stroke={2.6} />
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="¿Olvidaste tu contraseña?"
      subtitle="Ingresa tu email y te enviaremos un enlace para restablecerla."
      footer={
        <>
          ¿Recordaste tu contraseña?{' '}
          <Link href="/login" className="font-semibold text-primary">
            Iniciar sesión
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <Field
          variant="mobile"
          label="Email"
          type="email"
          placeholder="tu@email.com"
          leading={<MailIcon size={18} />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
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
              Enviar enlace <ArrowRightIcon size={16} stroke={2.6} />
            </>
          )}
        </button>

        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-border bg-subtle-bg p-3.5 text-[12.5px] text-text-sec">
          <div className="mt-px flex-shrink-0 text-primary">
            <MailIcon size={16} />
          </div>
          <div>
            El enlace expira en <b className="text-text">30 min</b>. Revisa también la carpeta de spam.
          </div>
        </div>
      </form>
    </AuthShell>
  );
}
