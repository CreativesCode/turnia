'use client';

import { LogoutButton } from '@/components/auth/LogoutButton';
import { TurniaLogo } from '@/components/branding/TurniaLogo';
import { OrganizationSelector } from '@/components/dashboard/OrganizationSelector';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { OfflinePill } from '@/components/offline/OfflinePill';
import { ThemeToggleButton } from '@/components/theme/theme';
import {
  Icons,
  type IconProps,
} from '@/components/ui/icons';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { cn } from '@/lib/cn';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ─────────── Tipos del menú ───────────

type Role = 'admin' | 'manager' | 'staff';

type Permission = 'manage-org' | 'manage-shifts' | 'create-requests' | 'approve-requests';

type Permissions = {
  canManageOrg: boolean;
  canManageShifts: boolean;
  canCreateRequests: boolean;
  canApproveRequests: boolean;
};

type NavItemDef = {
  href: string;
  label: string;
  icon: React.FC<IconProps>;
  /** Active si pathname empieza por uno de estos prefixes (orden importa). */
  match: string[];
  /** Exclude si el pathname empieza por alguno de estos (para evitar solape entre rutas anidadas). */
  exclude?: string[];
  /** Badge numérico opcional (puede venir de un hook en el futuro). */
  badge?: number;
  /** Permiso requerido para mostrar el item; si no se cumple, se oculta. */
  requires?: Permission;
};

type Section = { title: string; items: NavItemDef[] };

function hasPermission(perms: Permissions, p: Permission): boolean {
  switch (p) {
    case 'manage-org':
      return perms.canManageOrg;
    case 'manage-shifts':
      return perms.canManageShifts;
    case 'create-requests':
      return perms.canCreateRequests;
    case 'approve-requests':
      return perms.canApproveRequests;
  }
}

function filterSections(sections: Section[], perms: Permissions): Section[] {
  return sections
    .map((s) => ({
      ...s,
      items: s.items.filter((it) => !it.requires || hasPermission(perms, it.requires)),
    }))
    .filter((s) => s.items.length > 0);
}

function buildSections(role: Role): Section[] {
  if (role === 'admin') {
    return [
      {
        title: 'Principal',
        items: [
          { href: '/dashboard', label: 'Dashboard', icon: Icons.home, match: ['/dashboard'], exclude: ['/dashboard/manager', '/dashboard/admin', '/dashboard/staff'] },
          { href: '/dashboard/manager', label: 'Calendario', icon: Icons.calendar, match: ['/dashboard/manager'], exclude: ['/dashboard/manager/requests', '/dashboard/manager/availability'] },
        ],
      },
      {
        title: 'Operación',
        items: [
          { href: '/dashboard/daily-schedule', label: 'Agenda del día', icon: Icons.list, match: ['/dashboard/daily-schedule'] },
          { href: '/dashboard/manager/requests', label: 'Solicitudes', icon: Icons.swap, match: ['/dashboard/manager/requests'], requires: 'approve-requests' },
          { href: '/dashboard/manager/availability', label: 'Disponibilidad', icon: Icons.beach, match: ['/dashboard/manager/availability'] },
          { href: '/dashboard/admin/statistics', label: 'Estadísticas', icon: Icons.trend, match: ['/dashboard/admin/statistics'] },
        ],
      },
      {
        title: 'Administración',
        items: [
          { href: '/dashboard/admin/members', label: 'Miembros', icon: Icons.users, match: ['/dashboard/admin/members'] },
          { href: '/dashboard/admin/teams', label: 'Equipos', icon: Icons.briefcase, match: ['/dashboard/admin/teams'] },
          { href: '/dashboard/admin/organizations', label: 'Organizaciones', icon: Icons.building, match: ['/dashboard/admin/organizations'] },
          { href: '/dashboard/admin/shift-types', label: 'Tipos de turno', icon: Icons.cal2, match: ['/dashboard/admin/shift-types'] },
          { href: '/dashboard/admin/staff-positions', label: 'Puestos', icon: Icons.stethoscope, match: ['/dashboard/admin/staff-positions'] },
          { href: '/dashboard/admin/invite', label: 'Invitaciones', icon: Icons.mail, match: ['/dashboard/admin/invite'] },
          { href: '/dashboard/admin/audit', label: 'Auditoría', icon: Icons.history, match: ['/dashboard/admin/audit'] },
          { href: '/dashboard/admin/permissions', label: 'Permisos', icon: Icons.shield, match: ['/dashboard/admin/permissions'] },
          { href: '/dashboard/admin/exports', label: 'Exportar', icon: Icons.download, match: ['/dashboard/admin/exports'] },
          { href: '/dashboard/admin/reports', label: 'Reportes', icon: Icons.trend, match: ['/dashboard/admin/reports'] },
          { href: '/dashboard/admin/settings', label: 'Configuración', icon: Icons.settings, match: ['/dashboard/admin/settings'] },
        ],
      },
    ];
  }

  if (role === 'manager') {
    return [
      {
        title: 'Principal',
        items: [
          { href: '/dashboard', label: 'Inicio', icon: Icons.home, match: ['/dashboard'], exclude: ['/dashboard/manager', '/dashboard/staff', '/dashboard/admin'] },
          { href: '/dashboard/manager', label: 'Calendario', icon: Icons.calendar, match: ['/dashboard/manager'], exclude: ['/dashboard/manager/requests', '/dashboard/manager/availability'] },
        ],
      },
      {
        title: 'Operación',
        items: [
          { href: '/dashboard/daily-schedule', label: 'Agenda del día', icon: Icons.list, match: ['/dashboard/daily-schedule'] },
          { href: '/dashboard/manager/requests', label: 'Solicitudes', icon: Icons.swap, match: ['/dashboard/manager/requests'], requires: 'approve-requests' },
          { href: '/dashboard/manager/availability', label: 'Disponibilidad', icon: Icons.beach, match: ['/dashboard/manager/availability'] },
          { href: '/dashboard/active-now', label: 'De guardia ahora', icon: Icons.stethoscope, match: ['/dashboard/active-now'] },
        ],
      },
      {
        title: 'Equipo',
        items: [
          { href: '/dashboard/staff', label: 'Compañeros', icon: Icons.users, match: ['/dashboard/staff'] },
          { href: '/dashboard/statistics', label: 'Estadísticas', icon: Icons.trend, match: ['/dashboard/statistics'] },
        ],
      },
    ];
  }

  // staff
  return [
    {
      title: 'Principal',
      items: [
        { href: '/dashboard', label: 'Inicio', icon: Icons.home, match: ['/dashboard'], exclude: ['/dashboard/staff', '/dashboard/manager', '/dashboard/admin', '/dashboard/my-shifts', '/dashboard/open-shifts', '/dashboard/permissions', '/dashboard/transactions'] },
        { href: '/dashboard/my-shifts', label: 'Mis turnos', icon: Icons.calendar, match: ['/dashboard/my-shifts'] },
      ],
    },
    {
      title: 'Mi gestión',
      items: [
        { href: '/dashboard/staff/my-requests', label: 'Solicitudes', icon: Icons.swap, match: ['/dashboard/staff/my-requests'], requires: 'create-requests' },
        { href: '/dashboard/staff/availability', label: 'Disponibilidad', icon: Icons.beach, match: ['/dashboard/staff/availability'] },
        { href: '/dashboard/open-shifts', label: 'Turnos abiertos', icon: Icons.takeOpen, match: ['/dashboard/open-shifts'], requires: 'create-requests' },
        { href: '/dashboard/permissions', label: 'Permisos', icon: Icons.doc, match: ['/dashboard/permissions'], requires: 'create-requests' },
      ],
    },
    {
      title: 'Mi equipo',
      items: [
        { href: '/dashboard/active-now', label: 'On-call ahora', icon: Icons.stethoscope, match: ['/dashboard/active-now'] },
        { href: '/dashboard/staff', label: 'Compañeros', icon: Icons.users, match: ['/dashboard/staff'] },
        { href: '/dashboard/statistics', label: 'Estadísticas', icon: Icons.trend, match: ['/dashboard/statistics'] },
      ],
    },
  ];
}

function isItemActive(pathname: string | null, item: NavItemDef): boolean {
  if (!pathname) return false;
  if (item.exclude?.some((p) => pathname.startsWith(p))) {
    // item.match incluye '/dashboard' al raíz: solo activo si exact match
    if (item.href === '/dashboard') return pathname === '/dashboard';
    return false;
  }
  return item.match.some((p) => pathname.startsWith(p));
}

// ─────────── Helpers UI ───────────

function getInitials(name: string | null): string {
  const n = (name ?? '').trim();
  if (!n) return 'U';
  const parts = n.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? 'U';
  const b = parts[1]?.[0] ?? parts[0]?.[1] ?? '';
  return (a + b).toUpperCase();
}

function NavRow({
  item,
  active,
  collapsed,
}: {
  item: NavItemDef;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        'relative my-px flex items-center rounded-lg text-[13px] transition-colors',
        collapsed ? 'justify-center px-2 py-2' : 'gap-2.5 px-2.5 py-2',
        active
          ? 'bg-primary-soft font-semibold text-primary'
          : 'font-medium text-text-sec hover:bg-subtle'
      )}
    >
      {active && !collapsed ? (
        <span
          aria-hidden
          className="absolute -left-[10px] top-1.5 bottom-1.5 w-[2.5px] rounded-full bg-primary"
        />
      ) : null}
      <Icon size={18} stroke={active ? 2.2 : 1.8} />
      {!collapsed ? (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge ? (
            <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold leading-none text-white">
              {item.badge}
            </span>
          ) : null}
        </>
      ) : null}
    </Link>
  );
}

// ─────────── Sidebar ───────────

const SIDEBAR_COLLAPSED_KEY = 'turnia:sidebar:collapsed';

export function DashboardSidebar() {
  const pathname = usePathname();
  const { orgId, userId, canManageShifts, canManageOrg, canCreateRequests, canApproveRequests } = useScheduleOrg();
  const [fullName, setFullName] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1') {
        setCollapsed(true);
      }
    } catch {
      // localStorage no disponible
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!orgId || !userId) return;
    const t = window.setTimeout(() => {
      const supabase = createClient();
      void Promise.all([
        supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
        supabase.from('organizations').select('name').eq('id', orgId).maybeSingle(),
      ]).then(
        ([p, o]) => {
          setFullName((p.data as { full_name?: string | null } | null)?.full_name ?? null);
          setOrgName((o.data as { name?: string | null } | null)?.name ?? null);
        },
        () => {
          setFullName(null);
          setOrgName(null);
        }
      );
    }, 0);
    return () => window.clearTimeout(t);
  }, [orgId, userId]);

  const role: Role = useMemo(() => {
    if (canManageOrg) return 'admin';
    if (canManageShifts) return 'manager';
    return 'staff';
  }, [canManageOrg, canManageShifts]);

  const roleLabel = useMemo(() => {
    if (role === 'admin') return 'Admin';
    if (role === 'manager') return 'Manager';
    return 'Staff';
  }, [role]);

  const initials = useMemo(() => getInitials(fullName), [fullName]);
  const sections = useMemo(
    () =>
      filterSections(buildSections(role), {
        canManageOrg,
        canManageShifts,
        canCreateRequests,
        canApproveRequests,
      }),
    [role, canManageOrg, canManageShifts, canCreateRequests, canApproveRequests]
  );

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const closeUserMenu = useCallback(() => setUserMenuOpen(false), []);

  useEffect(() => {
    if (!userMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  const profileActive = pathname?.startsWith('/dashboard/profile') ?? false;

  return (
    <aside
      className={cn(
        'flex h-screen shrink-0 flex-col border-r border-border bg-bg transition-[width] duration-150',
        collapsed ? 'w-[64px]' : 'w-[252px]'
      )}
    >
      {/* Header con logo + burger */}
      <div
        className={cn(
          'flex items-center py-5',
          collapsed ? 'flex-col gap-2 px-2' : 'justify-between px-[18px]'
        )}
      >
        <div className="flex items-center gap-2.5">
          <TurniaLogo />
          {!collapsed ? (
            <span className="tn-h text-[18px] font-extrabold tracking-[-0.025em] text-text">
              Turnia
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-subtle text-muted transition-colors hover:bg-subtle-2 hover:text-text"
        >
          <Icons.burger size={14} />
        </button>
      </div>

      {/* Org switcher */}
      {!collapsed ? (
        <div className="mx-3 mb-3.5">
          <OrganizationSelector />
        </div>
      ) : null}

      {/* Navigation */}
      <nav
        className={cn(
          'sidebar-nav-scroll flex-1 min-h-0 overflow-y-auto',
          collapsed ? 'px-2' : 'px-2.5'
        )}
        aria-label="Navegación principal"
      >
        {sections.map((s) => (
          <div key={s.title} className="mb-4">
            {!collapsed ? (
              <div className="px-2.5 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted">
                {s.title}
              </div>
            ) : null}
            {s.items.map((item) => (
              <NavRow
                key={item.href}
                item={item}
                active={isItemActive(pathname, item)}
                collapsed={collapsed}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* Footer: usuario + ajustes/menú */}
      <div
        className={cn('relative shrink-0 border-t border-border', collapsed ? 'p-2' : 'p-3')}
        ref={userMenuRef}
      >
        <button
          type="button"
          onClick={() => setUserMenuOpen((o) => !o)}
          className={cn(
            'flex w-full items-center rounded-lg text-left transition-colors',
            collapsed ? 'justify-center p-1.5' : 'gap-2.5 px-1.5 py-1.5',
            profileActive
              ? 'bg-primary-soft text-primary'
              : 'text-text-sec hover:bg-subtle hover:text-text'
          )}
          aria-expanded={userMenuOpen}
          aria-haspopup="true"
          aria-label="Menú de usuario"
          title={collapsed ? fullName?.trim() || roleLabel : undefined}
        >
          <span
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))' }}
            aria-hidden
          >
            {initials}
          </span>
          {!collapsed ? (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-text">
                  {fullName?.trim() || roleLabel}
                </p>
                <p className="truncate text-[10.5px] text-muted">
                  {orgName ? orgName : roleLabel}
                </p>
              </div>
              <span
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-subtle text-muted"
                aria-hidden
              >
                <Icons.settings size={14} />
              </span>
            </>
          ) : null}
        </button>

        {userMenuOpen && (
          <div
            className={cn(
              'absolute z-20 rounded-lg border border-border bg-surface py-1 shadow-lg',
              collapsed
                ? 'bottom-2 left-full ml-2 w-56'
                : 'bottom-full left-3 right-3 mb-1'
            )}
            role="menu"
          >
            <Link
              href="/dashboard/profile"
              role="menuitem"
              onClick={closeUserMenu}
              className={cn(
                'flex items-center gap-3 px-3 py-2 text-sm transition-colors',
                profileActive
                  ? 'bg-primary-soft text-primary'
                  : 'text-text-sec hover:bg-subtle hover:text-text'
              )}
            >
              <Icons.user size={18} />
              <span>Preferencias y perfil</span>
            </Link>
            <div className="my-1 border-t border-border" />
            <div className="flex items-center justify-between gap-2 px-3 py-2" role="menuitem">
              <span className="text-sm text-text-sec">Tema</span>
              <ThemeToggleButton ariaLabel="Cambiar tema" />
            </div>
            <div className="flex items-center justify-between gap-2 px-3 py-2" role="menuitem">
              <span className="text-sm text-text-sec">Notificaciones</span>
              <NotificationBell />
            </div>
            <div className="border-t border-border" />
            <div className="px-3 py-2" role="menuitem">
              <LogoutButton />
            </div>
          </div>
        )}

        <div className="mt-1.5 flex items-center justify-center">
          <OfflinePill variant="dot" />
        </div>
      </div>
    </aside>
  );
}
