'use client';

/**
 * Navegación del dashboard en mobile: header compacto + bottom tab bar (5 tabs)
 * + bottom sheet "Más" con resto de rutas.
 *
 * Diseño: ref docs/design/screens/mobile.jsx (MTabBar línea 35).
 */

import { LogoutButton } from '@/components/auth/LogoutButton';
import { TurniaLogo } from '@/components/branding/TurniaLogo';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { OfflinePill } from '@/components/offline/OfflinePill';
import { ThemeSelect, ThemeToggleButton } from '@/components/theme/theme';
import {
  Icons,
  type IconProps,
} from '@/components/ui/icons';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { cn } from '@/lib/cn';
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

// ─────────── Tab bar ───────────

type Tab = {
  href: string;
  label: string;
  icon: React.FC<IconProps>;
  /** Active si pathname empieza por uno de estos prefixes. */
  match: string[];
  /** Excluye sub-rutas que pertenecen a otros tabs. */
  exclude?: string[];
  /** Badge numérico (>0 para mostrar). */
  badge?: number;
};

function isTabActive(pathname: string | null, tab: Tab): boolean {
  if (!pathname) return false;
  if (tab.exclude?.some((p) => pathname.startsWith(p))) return false;
  return tab.match.some((p) =>
    p === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(p)
  );
}

function TabItem({
  tab,
  active,
}: {
  tab: Tab;
  active: boolean;
}) {
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      prefetch
      aria-current={active ? 'page' : undefined}
      className="relative flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2 transition-colors"
    >
      <span
        className={cn(
          'relative inline-flex h-6 w-6 items-center justify-center',
          active ? 'text-primary' : 'text-muted'
        )}
      >
        <Icon size={22} stroke={active ? 2.2 : 1.8} />
        {tab.badge && tab.badge > 0 ? (
          <span
            className="absolute -right-1.5 -top-0.5 inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full border-2 border-bg bg-red px-1 text-[9px] font-bold leading-none text-white"
            aria-label={`${tab.badge} sin leer`}
          >
            {tab.badge > 9 ? '9+' : tab.badge}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          'text-[10.5px] tracking-[0.01em]',
          active ? 'font-semibold text-primary' : 'font-medium text-muted'
        )}
      >
        {tab.label}
      </span>
    </Link>
  );
}

// ─────────── Bottom sheet "Más" ───────────

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
      prefetch
      onClick={onClick}
      className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text transition-colors hover:bg-subtle active:bg-subtle"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-subtle text-text-sec">
        {icon}
      </span>
      <span className="font-medium">{label}</span>
    </Link>
  );
}

function SheetSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

// ─────────── Componente principal ───────────

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { canManageShifts, canManageOrg, canCreateRequests, canApproveRequests } = useScheduleOrg();

  const [moreOpen, setMoreOpen] = useState(false);
  const morePanelRef = useRef<HTMLDivElement>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const moreMenuId = 'dashboard-more-menu';

  // Hrefs por rol
  const homeHref = '/dashboard';
  const calendarHref = canManageShifts ? '/dashboard/manager' : '/dashboard/my-shifts';
  const calendarLabel = canManageShifts ? 'Calendario' : 'Mis turnos';
  const requestsHref = canManageShifts ? '/dashboard/manager/requests' : '/dashboard/staff/my-requests';
  const availabilityHref = canManageShifts ? '/dashboard/manager/availability' : '/dashboard/staff/availability';

  // El tab "Solicitudes" requiere poder aprobar (manager+) o crear (staff con permisos).
  // Se oculta para viewer (sin permiso de creación).
  const canSeeRequestsTab = canManageShifts ? canApproveRequests : canCreateRequests;

  const tabs: Tab[] = [
    {
      href: homeHref,
      label: 'Inicio',
      icon: Icons.home,
      match: ['/dashboard'],
      exclude: [
        '/dashboard/manager',
        '/dashboard/admin',
        '/dashboard/staff',
        '/dashboard/my-shifts',
        '/dashboard/open-shifts',
        '/dashboard/permissions',
        '/dashboard/transactions',
        '/dashboard/notifications',
        '/dashboard/profile',
        '/dashboard/active-now',
        '/dashboard/daily-schedule',
      ],
    },
    {
      href: calendarHref,
      label: calendarLabel,
      icon: Icons.calendar,
      match: [calendarHref],
      exclude: [
        '/dashboard/manager/requests',
        '/dashboard/manager/availability',
      ],
    },
    ...(canSeeRequestsTab
      ? [
          {
            href: requestsHref,
            label: 'Solicitudes',
            icon: Icons.swap,
            match: [requestsHref],
          } as Tab,
        ]
      : []),
    {
      href: availabilityHref,
      label: 'Disponible',
      icon: Icons.beach,
      match: [availabilityHref],
    },
    {
      href: '/dashboard/profile',
      label: 'Perfil',
      icon: Icons.user,
      match: ['/dashboard/profile'],
    },
  ];

  // ── Sheet "Más" ──
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

  return (
    <>
      {/* Header compacto */}
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <Link href={homeHref} prefetch className="flex items-center gap-2.5">
            <TurniaLogo size={36} />
            <span className="tn-h text-[20px] font-extrabold tracking-[-0.025em] text-text">Turnia</span>
          </Link>
          <div className="flex items-center gap-1">
            <OfflinePill variant="dot" />
            <ThemeToggleButton ariaLabel="Cambiar tema" />
            <NotificationBell />
            <button
              type="button"
              onClick={openMore}
              className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-subtle text-text-sec hover:bg-subtle-2 hover:text-text"
              aria-label="Más opciones"
              aria-haspopup="dialog"
              aria-controls={moreMenuId}
              aria-expanded={moreOpen}
            >
              <Icons.burger size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Bottom Tab Bar — 5 tabs */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-border bg-bg/95 backdrop-blur md:hidden"
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
        aria-label="Navegación principal"
      >
        <div className="flex w-full">
          {tabs.map((tab) => (
            <TabItem key={tab.href} tab={tab} active={isTabActive(pathname, tab)} />
          ))}
        </div>
      </nav>

      {/* Bottom Sheet "Más" */}
      {moreOpen ? (
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
            className="relative max-h-[88dvh] w-full overflow-y-auto rounded-t-2xl border-t border-border bg-bg pb-[calc(env(safe-area-inset-bottom)+1rem)] focus:outline-none"
          >
            <h2 id="dashboard-more-menu-title" className="sr-only">
              Menú de navegación
            </h2>
            <div className="sticky top-0 z-10 flex items-center justify-center border-b border-border bg-bg py-3">
              <span className="h-1 w-10 rounded-full bg-border" aria-hidden />
              <button
                type="button"
                onClick={closeMore}
                className="absolute right-3 top-1.5 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-text"
                aria-label="Cerrar menú"
              >
                <Icons.x size={18} />
              </button>
            </div>

            <div className="space-y-4 p-4">
              <SheetSection title="Mi cuenta">
                <SheetLink href="/dashboard/profile" label="Preferencia y perfil" onClick={closeMore} icon={<Icons.user size={16} />} />
                <SheetLink href="/dashboard/statistics" label="Mis estadísticas" onClick={closeMore} icon={<Icons.trend size={16} />} />
              </SheetSection>

              <SheetSection title="Turnos">
                <SheetLink href="/dashboard/daily-schedule" label="Agenda del día" onClick={closeMore} icon={<Icons.list size={16} />} />
                <SheetLink href="/dashboard/active-now" label="De turno ahora" onClick={closeMore} icon={<Icons.stethoscope size={16} />} />
                {canCreateRequests ? (
                  <SheetLink href="/dashboard/open-shifts" label="Turnos abiertos" onClick={closeMore} icon={<Icons.takeOpen size={16} />} />
                ) : null}
                <SheetLink href="/dashboard/transactions" label="Movimientos" onClick={closeMore} icon={<Icons.refresh size={16} />} />
                {canCreateRequests ? (
                  <SheetLink href="/dashboard/permissions" label="Solicitar permiso" onClick={closeMore} icon={<Icons.doc size={16} />} />
                ) : null}
                <SheetLink href="/dashboard/notifications" label="Notificaciones" onClick={closeMore} icon={<Icons.bell size={16} />} />
              </SheetSection>

              {canManageShifts ? (
                <SheetSection title="Gestión">
                  <SheetLink href="/dashboard/manager/shifts" label="Lista de turnos" onClick={closeMore} icon={<Icons.list size={16} />} />
                  <SheetLink href="/dashboard/manager/availability" label="Disponibilidad del equipo" onClick={closeMore} icon={<Icons.users size={16} />} />
                  {canManageOrg ? (
                    <SheetLink href="/dashboard/admin/statistics" label="Estadísticas generales" onClick={closeMore} icon={<Icons.trend size={16} />} />
                  ) : null}
                </SheetSection>
              ) : null}

              {canManageOrg ? (
                <SheetSection title="Administración">
                  <SheetLink href="/dashboard/admin/members" label="Miembros" onClick={closeMore} icon={<Icons.users size={16} />} />
                  <SheetLink href="/dashboard/admin/organizations" label="Equipos" onClick={closeMore} icon={<Icons.briefcase size={16} />} />
                  <SheetLink href="/dashboard/admin/shift-types" label="Tipos de turno" onClick={closeMore} icon={<Icons.cal2 size={16} />} />
                  <SheetLink href="/dashboard/admin/staff-positions" label="Puestos" onClick={closeMore} icon={<Icons.stethoscope size={16} />} />
                  <SheetLink href="/dashboard/admin/invite" label="Invitaciones" onClick={closeMore} icon={<Icons.mail size={16} />} />
                  <SheetLink href="/dashboard/admin/exports" label="Exportar datos" onClick={closeMore} icon={<Icons.download size={16} />} />
                  <SheetLink href="/dashboard/admin/reports" label="Reportes" onClick={closeMore} icon={<Icons.trend size={16} />} />
                  <SheetLink href="/dashboard/admin/audit" label="Auditoría" onClick={closeMore} icon={<Icons.history size={16} />} />
                  <SheetLink href="/dashboard/admin/settings" label="Configuración" onClick={closeMore} icon={<Icons.settings size={16} />} />
                </SheetSection>
              ) : null}

              <div className="rounded-xl border border-border bg-subtle px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-text">Tema de la app</span>
                  <ThemeSelect className="min-h-[44px] w-[140px] rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary focus:outline-none" />
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red transition-colors hover:bg-red-soft active:bg-red-soft"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-soft">
                    <Icons.logout size={16} />
                  </span>
                  Cerrar sesión
                </button>
                {/* `LogoutButton` exportado pero no usado — se delega en handleLogout para cerrar también el sheet */}
                <span className="hidden">
                  <LogoutButton />
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
