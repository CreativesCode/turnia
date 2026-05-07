'use client';

import { AuthPasswordField } from '@/components/auth/AuthPasswordField';
import { AuthShellHeader } from '@/components/auth/AuthShell';
import { Field } from '@/components/ui/Field';
import { ArrowRightIcon, CheckIcon, MailIcon, UserIcon } from '@/components/ui/icons';
import { Spinner } from '@/components/ui/Spinner';
import { redirectAfterAuth } from '@/lib/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(true);
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
    if (!acceptTerms) {
      setError('Debes aceptar los Términos y la Política de privacidad.');
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
      <div className="flex flex-col">
        <AuthShellHeader
          title="Cuenta creada"
          subtitle="Revisa tu correo para confirmar. Si tu proyecto tiene confirmación desactivada, ya puedes iniciar sesión."
        />
        <div className="mt-8 flex flex-col items-center gap-4">
          <Link
            href="/login"
            className="flex h-[52px] w-full max-w-xs items-center justify-center gap-2 rounded-[14px] bg-primary text-[15.5px] font-bold text-white"
            style={{ boxShadow: '0 8px 22px -10px var(--color-primary)' }}
          >
            Ir a iniciar sesión <ArrowRightIcon size={18} stroke={2.4} />
          </Link>
          <p className="text-center text-xs text-muted">
            Para ser <strong>Org Admin</strong> de la primera organización, ejecuta el SQL de{' '}
            <code className="mx-1 rounded bg-subtle-bg px-1 text-text">docs/first-admin.md</code>{' '}
            en Supabase.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <AuthShellHeader
        title="Crea tu cuenta"
        subtitle="Únete al equipo y empieza a gestionar tus turnos."
      />

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3.5">
        {/* Mobile field layout */}
        <div className="lg:hidden">
          <Field
            variant="mobile"
            label="Nombre completo"
            type="text"
            placeholder="Ana Morales"
            leading={<UserIcon size={18} />}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>
        <div className="hidden lg:block">
          <Field
            variant="desktop"
            label="Nombre completo"
            type="text"
            placeholder="Ana Morales"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>

        <div className="lg:hidden">
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
        </div>
        <div className="hidden lg:block">
          <Field
            variant="desktop"
            label="Email"
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="lg:hidden">
          <AuthPasswordField
            label="Contraseña"
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <div className="hidden lg:block">
          <AuthPasswordField
            desktop
            label="Contraseña"
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        <label className="my-1 flex cursor-pointer items-start gap-2.5 text-[12.5px] leading-[1.5] text-text-sec">
          <button
            type="button"
            role="checkbox"
            aria-checked={acceptTerms}
            onClick={() => setAcceptTerms((v) => !v)}
            className="mt-0.5 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-[5px] transition-colors"
            style={{
              background: acceptTerms ? 'var(--color-primary)' : 'transparent',
              border: acceptTerms ? 'none' : '1.5px solid var(--color-border-strong)',
              color: '#fff',
            }}
          >
            {acceptTerms ? <CheckIcon size={11} stroke={3} /> : null}
          </button>
          <span>
            Acepto los <a className="font-semibold text-primary">Términos</a> y la{' '}
            <a className="font-semibold text-primary">Política de privacidad</a>.
          </span>
        </label>

        {error ? <p className="-mt-1 text-sm text-red">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="relative mt-2 flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-primary text-[15.5px] font-bold text-white transition-opacity disabled:opacity-60"
          style={{ boxShadow: '0 8px 22px -10px var(--color-primary)' }}
        >
          {loading ? (
            <Spinner aria-label="Cargando" />
          ) : (
            <>
              Crear cuenta <ArrowRightIcon size={18} stroke={2.4} />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 text-center text-[13px] text-muted">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="font-semibold text-primary">
          Iniciar sesión
        </Link>
      </div>
    </div>
  );
}
