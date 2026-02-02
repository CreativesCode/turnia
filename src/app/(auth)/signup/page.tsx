import { SignupForm } from '@/components/auth/SignupForm';
import { Suspense } from 'react';

export default function SignupPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-6xl items-stretch justify-center sm:min-h-[calc(100vh-3rem)]">
      <div className="flex w-full overflow-hidden bg-background lg:rounded-2xl lg:border lg:border-border lg:shadow-sm">
        <aside className="hidden w-[640px] flex-col justify-center bg-primary-600 p-12 text-white lg:flex">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Turnia" className="h-20 w-20 rounded-2xl bg-white/10 p-2" />
            <div>
              <p className="text-4xl font-bold leading-none">Turnia</p>
              <p className="mt-2 text-lg text-white/80">Gestión inteligente de turnos para tu equipo.</p>
            </div>
          </div>

          <ul className="mt-10 space-y-4 text-base text-white/80">
            <li>✓ Solicitudes de cambio y swaps</li>
            <li>✓ Disponibilidad del equipo</li>
            <li>✓ Notificaciones en la app</li>
          </ul>
        </aside>

        <main className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-[460px]">
            <Suspense fallback={<div className="rounded-xl border border-border bg-background p-6 text-text-secondary">Cargando…</div>}>
              <SignupForm />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
