'use client';

import { AuthPasswordField } from '@/components/auth/AuthPasswordField';
import { AuthShellHeader } from '@/components/auth/AuthShell';
import { Field } from '@/components/ui/Field';
import {
  ArrowRightIcon,
  CheckIcon,
  FingerprintIcon,
  LockIcon,
  MailIcon,
  ShieldIcon,
} from '@/components/ui/icons';
import { Spinner } from '@/components/ui/Spinner';
import { redirectAfterAuth } from '@/lib/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
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
    <div className="flex flex-col">
      {/* Mobile: logo + título grande */}
      <div className="lg:hidden">
        <AuthShellHeader
          title={
            <>
              Tu guardia,
              <br />
              en orden.
            </>
          }
          subtitle="Inicia sesión para ver tus turnos, solicitar cambios y gestionar tu disponibilidad."
          align="left"
        />
      </div>

      {/* Desktop: título sobrio */}
      <div className="hidden lg:block">
        <h1 className="tn-h text-[30px] font-bold leading-tight">Inicia sesión</h1>
        <p className="mt-1.5 text-sm text-muted">Bienvenido de vuelta. Empieza tu jornada.</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-9 flex flex-col gap-3.5 lg:mt-8">
        {/* Mobile: campos con label uppercase dentro */}
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
            placeholder="Tu contraseña"
            leading={<LockIcon size={18} />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <div className="hidden lg:block">
          <AuthPasswordField
            desktop
            label="Contraseña"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {/* Mobile: solo "olvidaste" alineado derecha */}
        <div className="flex justify-end lg:hidden">
          <Link
            href="/forgot-password"
            className="text-[13px] font-semibold text-primary"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        {/* Desktop: recordarme + olvidaste */}
        <div className="mt-1 hidden items-center justify-between lg:flex">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-text-sec">
            <button
              type="button"
              role="checkbox"
              aria-checked={remember}
              onClick={() => setRemember((r) => !r)}
              className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] transition-colors"
              style={{
                background: remember ? 'var(--color-primary)' : 'transparent',
                border: remember ? 'none' : '1.5px solid var(--color-border-strong)',
                color: '#fff',
              }}
            >
              {remember ? <CheckIcon size={12} stroke={3} /> : null}
            </button>
            Recordarme
          </label>
          <Link href="/forgot-password" className="text-[13px] font-semibold text-primary">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        {error ? <p className="-mt-1 text-sm text-red">{error}</p> : null}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="relative mt-3 flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-primary text-[15.5px] font-bold text-white transition-opacity disabled:opacity-60 lg:h-12 lg:rounded-xl lg:text-[14.5px]"
          style={{ boxShadow: '0 8px 22px -10px var(--color-primary)' }}
        >
          {loading ? (
            <Spinner aria-label="Cargando" />
          ) : (
            <>
              Iniciar sesión <ArrowRightIcon size={18} stroke={2.4} />
            </>
          )}
        </button>

        {/* Mobile: divisor + Face ID (estético, sin handler real) */}
        <div className="lg:hidden">
          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">
              O
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <button
            type="button"
            disabled
            title="Próximamente"
            className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[14px] border border-border bg-surface text-[14.5px] font-semibold text-text disabled:opacity-50"
          >
            <FingerprintIcon size={20} /> Acceder con Face ID
          </button>
        </div>

        {/* Desktop: banner 2FA */}
        <div className="mt-5 hidden items-start gap-2.5 rounded-xl border border-border bg-subtle-bg p-3.5 text-[12.5px] text-text-sec lg:flex">
          <div className="flex-shrink-0 text-primary">
            <ShieldIcon size={16} />
          </div>
          <div>
            <strong>Acceso seguro.</strong> Tu sesión está protegida con autenticación de dos factores.
          </div>
        </div>
      </form>

      {/* Footer link */}
      <div className="mt-8 text-center text-[13px] text-muted lg:mt-10">
        ¿Eres nuevo?{' '}
        <Link href="/signup" className="font-semibold text-primary">
          Acepta tu invitación
        </Link>
      </div>
    </div>
  );
}
