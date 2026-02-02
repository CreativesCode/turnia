import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur pt-safe">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:h-20 sm:px-6 lg:px-20">
          <Link href="/" className="flex items-center gap-2 sm:gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Turnia" className="h-10 w-10 sm:h-12 sm:w-12" />
            <span className="text-xl font-bold text-primary-600 sm:text-2xl">Turnia</span>
          </Link>

          <div className="hidden items-center gap-10 text-sm font-medium text-text-secondary md:flex">
            <a href="#features" className="hover:text-primary-600">Funcionalidades</a>
            <a href="#how" className="hover:text-primary-600">Cómo funciona</a>
            <a href="#pricing" className="hover:text-primary-600">Precios</a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="text-sm font-medium text-primary-600 hover:text-primary-700">
              Iniciar sesión
            </Link>
            <Link
              href="/signup"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 sm:px-6"
            >
              Comenzar gratis
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="bg-linear-to-b from-primary-50 to-background">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-10 px-6 py-16 text-center lg:px-20 lg:py-24">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700">
            <SparklesIcon />
            <span>Gestión de turnos simplificada</span>
          </div>

          <h1 className="max-w-4xl text-4xl font-bold leading-tight text-text-primary sm:text-5xl lg:text-6xl">
            Organiza los turnos de tu equipo
            <br />
            sin complicaciones
          </h1>

          <p className="max-w-3xl text-lg leading-relaxed text-text-secondary sm:text-xl">
            Turnia es la plataforma que simplifica la planificación de turnos, solicitudes de cambio e intercambios
            entre empleados. Todo en un solo lugar.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-primary-600 px-8 text-base font-semibold text-white hover:bg-primary-700"
            >
              Comenzar gratis <ArrowRightIcon />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-14 items-center justify-center gap-2 rounded-xl border border-border bg-background px-8 text-base font-medium text-text-primary hover:bg-subtle-bg"
            >
              <PlayIcon /> Ver demo
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20 lg:px-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary-600">FUNCIONALIDADES</p>
          <h2 className="mt-4 text-3xl font-bold leading-tight text-text-primary sm:text-4xl">
            Todo lo que necesitas para
            <br />
            gestionar tu equipo
          </h2>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          <FeatureCard
            title="Planificación visual"
            description="Vista de calendario intuitiva para ver y gestionar todos los turnos de tu equipo de un vistazo."
          />
          <FeatureCard
            title="Intercambios fáciles"
            description="Los empleados pueden solicitar cambios e intercambios de turno directamente desde la app."
          />
          <FeatureCard
            title="Notificaciones en tiempo real"
            description="Recibe alertas instantáneas sobre nuevos turnos, cambios aprobados y más."
          />
        </div>
      </section>

      {/* How */}
      <section id="how" className="bg-subtle-bg">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold tracking-[0.2em] text-primary-600">CÓMO FUNCIONA</p>
            <h2 className="mt-4 text-3xl font-bold text-text-primary sm:text-4xl">Una solución para cada rol</h2>
            <p className="mt-4 text-base text-text-secondary sm:text-lg">
              Turnia se adapta a las necesidades de administradores, managers y empleados
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            <HowCard
              badge="Admin"
              title="Control total"
              items={[
                'Gestiona organizaciones y miembros',
                'Define tipos de turno y reglas',
                'Exporta y audita cambios',
              ]}
              badgeClassName="bg-primary-100 text-primary-700"
            />
            <HowCard
              badge="Manager"
              title="Planificación eficiente"
              items={[
                'Crea y asigna turnos en calendario',
                'Aprueba solicitudes del equipo',
                'Visualiza disponibilidad',
              ]}
              badgeClassName="bg-amber-100 text-amber-700"
            />
            <HowCard
              badge="Staff"
              title="Autonomía total"
              items={[
                'Consulta tus próximos turnos',
                'Solicita cambios e intercambios',
                'Recibe notificaciones',
              ]}
              badgeClassName="bg-blue-100 text-blue-700"
            />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-20">
        <div className="grid gap-10 text-center md:grid-cols-4">
          <Stat value="10,000+" label="Turnos gestionados" />
          <Stat value="500+" label="Empresas activas" />
          <Stat value="98%" label="Satisfacción" />
          <Stat value="4.9" label="Calificación" />
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary-600" id="pricing">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 py-20 text-center text-white lg:px-20">
          <h2 className="text-3xl font-bold sm:text-4xl">Empieza a organizar tu equipo hoy</h2>
          <p className="text-base text-white/90 sm:text-lg">
            Prueba Turnia gratis durante 14 días. Sin tarjeta de crédito.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex h-14 items-center justify-center rounded-xl bg-white px-8 text-base font-semibold text-primary-700 hover:bg-primary-50"
            >
              Comenzar gratis
            </Link>
            <Link
              href="/login"
              className="inline-flex h-14 items-center justify-center rounded-xl border-2 border-white px-8 text-base font-semibold text-white hover:bg-white/10"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-text-primary">
        <div className="mx-auto max-w-6xl px-6 py-12 lg:px-20">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Turnia" className="h-8 w-8" />
              <span className="text-lg font-bold text-white">Turnia</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-10 text-sm text-muted">
              <a href="#features" className="hover:text-white">Funcionalidades</a>
              <a href="#pricing" className="hover:text-white">Precios</a>
              <a href="#" className="hover:text-white">Contacto</a>
              <a href="#" className="hover:text-white">Privacidad</a>
            </div>
          </div>

          <div className="mt-8 border-t border-white/20 pt-6 text-center text-sm text-muted">
            © 2026 Turnia. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}

function SparklesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14" />
      <path d="m13 5 7 7-7 7" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl bg-subtle-bg p-8">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 2v4" />
          <path d="M12 18v4" />
          <path d="M4.93 4.93l2.83 2.83" />
          <path d="M16.24 16.24l2.83 2.83" />
          <path d="M2 12h4" />
          <path d="M18 12h4" />
          <path d="M4.93 19.07l2.83-2.83" />
          <path d="M16.24 7.76l2.83-2.83" />
        </svg>
      </div>
      <h3 className="mt-5 text-xl font-semibold text-text-primary">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-text-secondary">{description}</p>
    </div>
  );
}

function HowCard({
  badge,
  title,
  items,
  badgeClassName,
}: {
  badge: string;
  title: string;
  items: string[];
  badgeClassName: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-8">
      <div className={`inline-flex h-8 items-center rounded-full px-4 text-sm font-medium ${badgeClassName}`}>
        {badge}
      </div>
      <h3 className="mt-5 text-2xl font-semibold text-text-primary">{title}</h3>
      <ul className="mt-5 space-y-3 text-sm text-text-secondary">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2">
            <span className="mt-0.5 text-primary-600" aria-hidden>
              ✓
            </span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-4xl font-bold text-primary-600 sm:text-5xl">{value}</p>
      <p className="text-base text-text-secondary">{label}</p>
    </div>
  );
}
