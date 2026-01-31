'use client';

/**
 * Navegación del dashboard: header completo en desktop, barra superior compacta
 * + bottom navigation en móvil. Incluye sheet "Más" con enlaces adicionales y cierre de sesión.
 * @see project-roadmap.md Módulo 10.1
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { ThemeSelect, ThemeToggleButton } from '@/components/theme/theme';
import { OfflinePill } from '@/components/offline/OfflinePill';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { useIsMobile } from '@/hooks/useIsMobile';

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
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <circle cx="6" cy="12" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="18" cy="12" r="1.5" />
  </svg>
);

const MenuIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile('768px');
  const { canManageShifts, canManageOrg, isLoading } = useScheduleOrg();
  const [moreOpen, setMoreOpen] = useState(false);
  const morePanelRef = useRef<HTMLDivElement>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const moreMenuId = 'dashboard-more-menu';

  const homeHref = isLoading ? '/dashboard' : canManageShifts ? '/dashboard/manager' : '/dashboard/staff';
  const requestsHref = canManageShifts ? '/dashboard/manager/requests' : '/dashboard/staff/my-requests';
  const availabilityHref = canManageShifts ? '/dashboard/manager/availability' : '/dashboard/staff/availability';

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
      // Permite a teclado/screen readers entrar al panel.
      const t = window.setTimeout(() => {
        const panel = morePanelRef.current;
        if (!panel) return;
        const focusables = getFocusableElements(panel);
        (focusables[0] ?? panel).focus();
      }, 0);
      return () => window.clearTimeout(t);
    }
    // Devolver foco al trigger al cerrar.
    lastFocusedElementRef.current?.focus?.();
  }, [moreOpen]);

  const handleLogout = useCallback(async () => {
    closeMore();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/');
    router.refresh();
  }, [closeMore, router]);

  const link = (href: string, label: string) => (
    <Link key={href} href={href} onClick={closeMore} className="block rounded-lg px-4 py-3 text-sm text-text-primary hover:bg-subtle-bg">
      {label}
    </Link>
  );

  if (isMobile) {
    return (
      <>
        <header className="sticky top-0 z-30 border-b border-border bg-background px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href={homeHref} className="font-semibold text-text-primary">
              Turnia
            </Link>
            <div className="flex items-center gap-1">
              <OfflinePill variant="dot" />
              <ThemeToggleButton ariaLabel="Cambiar tema" />
              <NotificationBell />
              <button
                type="button"
                onClick={openMore}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted hover:bg-subtle-bg hover:text-text-primary"
                aria-label="Menú"
                aria-haspopup="dialog"
                aria-controls={moreMenuId}
                aria-expanded={moreOpen}
              >
                <MenuIcon />
              </button>
            </div>
          </div>
        </header>

        <nav
          className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
          aria-label="Navegación principal"
        >
          <div className="flex w-full">
            <NavIcon icon={<HomeIcon />} label="Inicio" href={homeHref} isActive={pathname === homeHref || (homeHref === '/dashboard/manager' && pathname?.startsWith('/dashboard/manager') && !pathname.includes('/requests') && !pathname.includes('/availability') && !pathname.includes('/shifts'))} />
            <NavIcon icon={<InboxIcon />} label="Solicitudes" href={requestsHref} isActive={pathname === requestsHref} />
            <NavIcon icon={<CalendarIcon />} label="Disponibilidad" href={availabilityHref} isActive={pathname === availabilityHref} />
            <NavIcon icon={<BellIcon />} label="Notificaciones" href="/dashboard/notifications" isActive={pathname === '/dashboard/notifications'} />
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

        {moreOpen && (
          <div
            id={moreMenuId}
            className="fixed inset-0 z-50 flex items-end justify-center md:hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-more-menu-title"
          >
            <div className="absolute inset-0 bg-black/50" onClick={closeMore} aria-hidden="true" />
            <div
              ref={morePanelRef}
              tabIndex={-1}
              className="relative w-full max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-border bg-background pb-[env(safe-area-inset-bottom)] focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <h2 id="dashboard-more-menu-title" className="sr-only">
                Menú de navegación
              </h2>
              <div className="sticky top-0 flex justify-center border-b border-border bg-background py-3">
                <span className="h-1 w-12 rounded-full bg-muted" aria-hidden />
                <button
                  type="button"
                  onClick={closeMore}
                  className="absolute right-3 top-1.5 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted hover:bg-subtle-bg hover:text-text-primary"
                  aria-label="Cerrar menú"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="grid gap-0.5 p-4">
                <div className="rounded-lg border border-border bg-subtle-bg px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-text-primary">Tema</span>
                    <ThemeSelect className="min-h-[44px] w-[140px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
                  </div>
                </div>
                {canManageShifts && link('/dashboard/manager/shifts', 'Lista de turnos')}
                {canManageOrg && (
                  <>
                    {link('/dashboard/admin/organizations', 'Organizaciones')}
                    {link('/dashboard/admin/members', 'Miembros')}
                    {link('/dashboard/admin/invite', 'Invitar')}
                    {link('/dashboard/admin/shift-types', 'Tipos de turno')}
                    {link('/dashboard/admin/settings', 'Configuración')}
                    {link('/dashboard/admin/exports', 'Exportar')}
                    {link('/dashboard/admin/reports', 'Reportes')}
                    {link('/dashboard/admin/audit', 'Auditoría')}
                  </>
                )}
                {(canManageShifts || canManageOrg) && <div className="my-2 border-t border-border" />}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg px-4 py-3 text-left text-sm font-medium text-red-600 hover:bg-red-500/10"
                >
                  Cerrar sesión
                </button>
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
        <Link href="/dashboard/admin" className="text-text-secondary hover:text-primary-600">Admin</Link>
        <Link href="/dashboard/admin/organizations" className="text-text-secondary hover:text-primary-600">Organizaciones</Link>
        <Link href="/dashboard/admin/members" className="text-text-secondary hover:text-primary-600">Miembros</Link>
        <Link href="/dashboard/admin/invite" className="text-text-secondary hover:text-primary-600">Invitar</Link>
        <Link href="/dashboard/admin/shift-types" className="text-text-secondary hover:text-primary-600">Tipos de turno</Link>
        <Link href="/dashboard/admin/settings" className="text-text-secondary hover:text-primary-600">Configuración</Link>
        <Link href="/dashboard/admin/exports" className="text-text-secondary hover:text-primary-600">Exportar</Link>
        <Link href="/dashboard/admin/reports" className="text-text-secondary hover:text-primary-600">Reportes</Link>
        <Link href="/dashboard/admin/audit" className="text-text-secondary hover:text-primary-600">Auditoría</Link>
        <Link href="/dashboard/manager" className="text-text-secondary hover:text-primary-600">Calendario</Link>
        <Link href="/dashboard/manager/shifts" className="text-text-secondary hover:text-primary-600">Lista de turnos</Link>
        <Link href="/dashboard/manager/requests" className="text-text-secondary hover:text-primary-600">Solicitudes</Link>
        <Link href="/dashboard/manager/availability" className="text-text-secondary hover:text-primary-600">Disponibilidad</Link>
        <Link href="/dashboard/staff" className="text-text-secondary hover:text-primary-600">Staff</Link>
        <Link href="/dashboard/staff/my-requests" className="text-text-secondary hover:text-primary-600">Mis solicitudes</Link>
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
