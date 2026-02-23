'use client';

/**
 * Navegación del dashboard: sidebar en desktop, header compacto + bottom tab bar
 * (5 tabs) + bottom sheet "Más" en móvil.
 */

import { LogoutButton } from '@/components/auth/LogoutButton';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { OfflinePill } from '@/components/offline/OfflinePill';
import { ThemeSelect, ThemeToggleButton } from '@/components/theme/theme';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const nodes = Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),select:not([disabled]),textarea:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])'
    )
  );
  return nodes.filter((el) => !el.hasAttribute('aria-hidden'));
}

function NavIcon({
  icon,
  label,
  href,
  isActive,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch={true}
      className="flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors md:min-h-0 md:min-w-0"
      aria-current={isActive ? 'page' : undefined}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center ${isActive ? 'text-primary-600' : 'text-muted'}`}
      >
        {icon}
      </span>
      <span className={isActive ? 'text-primary-600' : 'text-muted'}>{label}</span>
    </Link>
  );
}

const HomeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const InboxIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 01-3.46 0" />
  </svg>
);

const MoreIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="19" r="1" />
  </svg>
);

function SheetLink({
  href,
  label,
  icon,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      prefetch={true}
      onClick={onClick}
      className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text-primary transition-colors hover:bg-subtle-bg active:bg-subtle-bg"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-subtle-bg text-text-secondary">
        {icon}
      </span>
      <span className="font-medium">{label}</span>
    </Link>
  );
}

function SheetSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile('768px');
  const { canManageShifts, canManageOrg } = useScheduleOrg();
  const [moreOpen, setMoreOpen] = useState(false);
  const morePanelRef = useRef<HTMLDivElement>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const moreMenuId = 'dashboard-more-menu';

  const homeHref = '/dashboard';
  const requestsHref = canManageShifts ? '/dashboard/manager/requests' : '/dashboard/staff/my-requests';
  const calendarHref = canManageShifts ? '/dashboard/manager' : '/dashboard/my-shifts';
  const calendarLabel = canManageShifts ? 'Calendario' : 'Mis turnos';

  const closeMore = useCallback(() => setMoreOpen(false), []);
  const openMore = useCallback(() => {
    lastFocusedElementRef.current = (typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null) ?? null;
    setMoreOpen(true);
  }, []);

  useEffect(() => {
    if (moreOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [moreOpen]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMore();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = morePanelRef.current;
      if (!panel) return;

      const focusables = getFocusableElements(panel);
      if (focusables.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (!active || active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (!active || !panel.contains(active) || active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [moreOpen, closeMore]);

  useEffect(() => {
    if (moreOpen) {
      const t = window.setTimeout(() => {
        const panel = morePanelRef.current;
        if (!panel) return;
        const focusables = getFocusableElements(panel);
        (focusables[0] ?? panel).focus();
      }, 0);
      return () => window.clearTimeout(t);
    }
    lastFocusedElementRef.current?.focus?.();
  }, [moreOpen]);

  const handleLogout = useCallback(async () => {
    closeMore();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/');
    router.refresh();
  }, [closeMore, router]);

  if (isMobile) {
    const isHomeActive = pathname === '/dashboard' || pathname === '/dashboard/admin';

    const isCalendarActive = canManageShifts
      ? (pathname?.startsWith('/dashboard/manager') &&
          !pathname.includes('/requests') &&
          !pathname.includes('/availability') &&
          !pathname.includes('/shifts'))
      : pathname?.startsWith('/dashboard/my-shifts');

    return (
      <>
        {/* Header compacto: solo logo + estado offline + tema */}
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <Link href={homeHref} prefetch={true} className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Turnia" className="h-9 w-9" />
              <span className="text-xl font-bold text-primary-600">Turnia</span>
            </Link>
            <div className="flex items-center gap-1">
              <OfflinePill variant="dot" />
              <ThemeToggleButton ariaLabel="Cambiar tema" />
              <NotificationBell />
            </div>
          </div>
        </header>

        {/* Bottom Tab Bar — 5 tabs fijos */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-border bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)] md:hidden"
          aria-label="Navegación principal"
        >
          <div className="flex w-full">
            <NavIcon
              icon={<HomeIcon />}
              label="Inicio"
              href={homeHref}
              isActive={isHomeActive}
            />
            <NavIcon
              icon={<CalendarIcon />}
              label={calendarLabel}
              href={calendarHref}
              isActive={isCalendarActive}
            />
            <NavIcon
              icon={<InboxIcon />}
              label="Solicitudes"
              href={requestsHref}
              isActive={pathname === requestsHref || pathname?.startsWith(requestsHref)}
            />
            <NavIcon
              icon={<BellIcon />}
              label="Avisos"
              href="/dashboard/notifications"
              isActive={pathname?.startsWith('/dashboard/notifications')}
            />
            <button
              type="button"
              onClick={openMore}
              className="flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors"
              aria-label="Más opciones"
              aria-haspopup="dialog"
              aria-controls={moreMenuId}
              aria-expanded={moreOpen}
            >
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center ${moreOpen ? 'text-primary-600' : 'text-muted'}`}>
                <MoreIcon />
              </span>
              <span className={moreOpen ? 'text-primary-600' : 'text-muted'}>Más</span>
            </button>
          </div>
        </nav>

        {/* Bottom Sheet "Más" — con secciones e iconos */}
        {moreOpen && (
          <div
            id={moreMenuId}
            className="fixed inset-0 z-50 flex items-end justify-center md:hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-more-menu-title"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
              onClick={closeMore}
              aria-label="Cerrar menú"
            />
            <div
              ref={morePanelRef}
              tabIndex={-1}
              className="relative w-full max-h-[88dvh] overflow-y-auto rounded-t-2xl border-t border-border bg-background pb-[calc(env(safe-area-inset-bottom)+1rem)] focus:outline-none"
            >
              <h2 id="dashboard-more-menu-title" className="sr-only">
                Menú de navegación
              </h2>
              {/* Drag handle + cierre */}
              <div className="sticky top-0 z-10 flex items-center justify-center border-b border-border bg-background py-3">
                <span className="h-1 w-10 rounded-full bg-border" aria-hidden />
                <button
                  type="button"
                  onClick={closeMore}
                  className="absolute right-3 top-1.5 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted hover:bg-subtle-bg hover:text-text-primary"
                  aria-label="Cerrar menú"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4 p-4">
                {/* Sección: Mi cuenta */}
                <SheetSection title="Mi cuenta">
                  <SheetLink
                    href="/dashboard/profile"
                    label="Preferencia y perfil"
                    onClick={closeMore}
                    icon={
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    }
                  />
                  <SheetLink
                    href="/dashboard/statistics"
                    label="Mis estadísticas"
                    onClick={closeMore}
                    icon={
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="20" x2="12" y2="10" />
                        <line x1="18" y1="20" x2="18" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="16" />
                      </svg>
                    }
                  />
                </SheetSection>

                {/* Sección: Turnos */}
                <SheetSection title="Turnos">
                  <SheetLink
                    href="/dashboard/daily-schedule"
                    label="Turnos por día"
                    onClick={closeMore}
                    icon={
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <path d="M16 2v4M8 2v4M3 10h18" />
                        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
                      </svg>
                    }
                  />
                  <SheetLink
                    href="/dashboard/active-now"
                    label="De turno ahora"
                    onClick={closeMore}
                    icon={
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                      </svg>
                    }
                  />
                  <SheetLink
                    href="/dashboard/open-shifts"
                    label="Turnos vacantes"
                    onClick={closeMore}
                    icon={
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" />
                      </svg>
                    }
                  />
                  <SheetLink
                    href="/dashboard/transactions"
                    label="Transacciones"
                    onClick={closeMore}
                    icon={
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" />
                      </svg>
                    }
                  />
                  <SheetLink
                    href="/dashboard/permissions"
                    label="Solicitar permiso"
                    onClick={closeMore}
                    icon={
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                      </svg>
                    }
                  />
                </SheetSection>

                {/* Sección: Gestión (managers) */}
                {canManageShifts && (
                  <SheetSection title="Gestión">
                    <SheetLink
                      href="/dashboard/manager/shifts"
                      label="Lista de turnos"
                      onClick={closeMore}
                      icon={
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                        </svg>
                      }
                    />
                    <SheetLink
                      href="/dashboard/manager/availability"
                      label="Disponibilidad del equipo"
                      onClick={closeMore}
                      icon={
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                      }
                    />
                    {canManageOrg && (
                      <SheetLink
                        href="/dashboard/admin/statistics"
                        label="Estadísticas generales"
                        onClick={closeMore}
                        icon={
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="20" x2="12" y2="10" />
                            <line x1="18" y1="20" x2="18" y2="4" />
                            <line x1="6" y1="20" x2="6" y2="16" />
                          </svg>
                        }
                      />
                    )}
                  </SheetSection>
                )}

                {/* Sección: Administración (solo admins) */}
                {canManageOrg && (
                  <SheetSection title="Administración">
                    <SheetLink href="/dashboard/admin/members" label="Miembros" onClick={closeMore}
                      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>}
                    />
                    <SheetLink href="/dashboard/admin/organizations" label="Equipos" onClick={closeMore}
                      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 7h.01M11 7h.01M15 7h.01M7 11h.01M11 11h.01M15 11h.01M7 15h.01M11 15h.01M15 15h.01" /></svg>}
                    />
                    <SheetLink href="/dashboard/admin/shift-types" label="Tipos de turno" onClick={closeMore}
                      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4M16 2v4" /><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18M16 14v4M16 14h3" /></svg>}
                    />
                    <SheetLink href="/dashboard/admin/staff-positions" label="Puestos" onClick={closeMore}
                      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>}
                    />
                    <SheetLink href="/dashboard/admin/exports" label="Exportar datos" onClick={closeMore}
                      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>}
                    />
                    <SheetLink href="/dashboard/admin/reports" label="Reportes" onClick={closeMore}
                      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg>}
                    />
                    <SheetLink href="/dashboard/admin/audit" label="Registro de auditoría" onClick={closeMore}
                      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>}
                    />
                  </SheetSection>
                )}

                {/* Preferencias */}
                <div className="rounded-xl border border-border bg-subtle-bg px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-text-primary">Tema de la app</span>
                    <ThemeSelect className="min-h-[44px] w-[140px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none" />
                  </div>
                </div>

                {/* Cerrar sesión */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10 active:bg-red-500/10"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                      </svg>
                    </span>
                    Cerrar sesión
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <header className="border-b border-border bg-background px-4 py-3">
      <nav className="flex flex-wrap items-center gap-4 text-sm">
        <Link href="/dashboard" className="font-medium text-text-primary hover:text-primary-600">Dashboard</Link>
        <Link href="/dashboard/daily-schedule" className="text-text-secondary hover:text-primary-600">Turnos por día</Link>
        <Link href="/dashboard/active-now" className="text-text-secondary hover:text-primary-600">De turno ahora</Link>
        <Link href="/dashboard/profile" className="text-text-secondary hover:text-primary-600">Preferencia y perfil</Link>
        <Link href="/dashboard/admin" className="text-text-secondary hover:text-primary-600">Admin</Link>
        <Link href="/dashboard/admin/organizations" className="text-text-secondary hover:text-primary-600">Organizaciones</Link>
        <Link href="/dashboard/admin/members" className="text-text-secondary hover:text-primary-600">Miembros</Link>
        <Link href="/dashboard/admin/invite" className="text-text-secondary hover:text-primary-600">Invitar</Link>
        <Link href="/dashboard/admin/shift-types" className="text-text-secondary hover:text-primary-600">Tipos de turno</Link>
        <Link href="/dashboard/admin/staff-positions" className="text-text-secondary hover:text-primary-600">Puestos</Link>
        <Link href="/dashboard/admin/settings" className="text-text-secondary hover:text-primary-600">Configuración</Link>
        <Link href="/dashboard/admin/exports" className="text-text-secondary hover:text-primary-600">Exportar</Link>
        <Link href="/dashboard/admin/reports" className="text-text-secondary hover:text-primary-600">Reportes</Link>
        {canManageOrg && (
          <Link href="/dashboard/admin/audit" className="text-text-secondary hover:text-primary-600">Auditoría</Link>
        )}
        <Link href="/dashboard/manager" className="text-text-secondary hover:text-primary-600">Calendario</Link>
        <Link href="/dashboard/manager/shifts" className="text-text-secondary hover:text-primary-600">Lista de turnos</Link>
        <Link href="/dashboard/manager/requests" className="text-text-secondary hover:text-primary-600">Solicitudes</Link>
        <Link href="/dashboard/manager/availability" className="text-text-secondary hover:text-primary-600">Disponibilidad</Link>
        <Link href="/dashboard/staff" className="text-text-secondary hover:text-primary-600">Staff</Link>
        <Link href="/dashboard/staff/my-requests" className="text-text-secondary hover:text-primary-600">Mis solicitudes</Link>
        <Link href="/dashboard/transactions" className="text-text-secondary hover:text-primary-600">Transacciones</Link>
        <Link href="/dashboard/staff/availability" className="text-text-secondary hover:text-primary-600">Disponibilidad</Link>
        <Link href="/dashboard/viewer" className="text-text-secondary hover:text-primary-600">Viewer</Link>
        <Link href="/dashboard/notifications" className="text-text-secondary hover:text-primary-600">Notificaciones</Link>
        <span className="ml-auto flex items-center gap-2">
          <OfflinePill />
          <ThemeToggleButton ariaLabel="Cambiar tema" />
          <NotificationBell />
          <LogoutButton />
        </span>
      </nav>
    </header>
  );
}
