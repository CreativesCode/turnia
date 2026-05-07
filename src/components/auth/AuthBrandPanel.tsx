'use client';

import { CrossIcon } from '@/components/ui/icons';

/**
 * Panel de branding (50% izquierdo) usado en Login/Signup desktop.
 * Gradiente teal con patrón de puntos + círculos concéntricos + testimonial.
 */
export function AuthBrandPanel() {
  return (
    <aside
      className="relative hidden flex-1 overflow-hidden p-12 text-white lg:flex lg:items-center lg:justify-center"
      style={{
        background:
          'linear-gradient(155deg, var(--color-primary-700) 0%, var(--color-primary-500) 100%)',
      }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full opacity-[0.16]"
        aria-hidden
      >
        <defs>
          <pattern id="auth-dots" width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="0.4" fill="#fff" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#auth-dots)" />
      </svg>
      <svg
        width="520"
        height="520"
        viewBox="0 0 100 100"
        className="absolute -right-30 -top-30 opacity-[0.18]"
        style={{ right: '-120px', top: '-120px' }}
        aria-hidden
      >
        <circle cx="50" cy="50" r="48" stroke="#fff" strokeWidth=".4" fill="none" />
        <circle cx="50" cy="50" r="36" stroke="#fff" strokeWidth=".4" fill="none" />
        <circle cx="50" cy="50" r="22" stroke="#fff" strokeWidth=".4" fill="none" />
        <circle cx="50" cy="50" r="10" stroke="#fff" strokeWidth=".4" fill="none" />
      </svg>

      <div className="relative max-w-[460px]">
        <div className="mb-9 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md">
            <CrossIcon size={22} stroke={2.4} />
          </div>
          <div className="tn-h text-[26px] font-extrabold">Turnia</div>
        </div>

        <div className="tn-h text-[44px] font-bold leading-[1.05]">
          La gestión<br />
          de guardias,<br />
          <span className="mt-2 inline-block rounded-[10px] bg-white/[.18] px-3">al fin clara.</span>
        </div>

        <p className="mt-6 max-w-[420px] text-base leading-[1.5] opacity-[0.92]">
          Calendarios, intercambios, disponibilidades. Diseñado con y para los profesionales sanitarios.
        </p>

        <div className="mt-10 flex items-center gap-3.5 rounded-2xl border border-white/[.18] bg-white/[.12] p-5 backdrop-blur-md">
          <div
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white text-[14px] font-extrabold"
            style={{ color: 'var(--color-primary-700)' }}
          >
            LP
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-[1.5]">
              «Resolvemos los swaps en minutos. Antes era una discusión por WhatsApp.»
            </p>
            <p className="mt-1.5 text-xs opacity-80">Dra. Lucía Pereira · Jefa de Guardia, UCI</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
