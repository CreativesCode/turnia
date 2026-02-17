'use client';

import { LogoutButton } from '@/components/auth/LogoutButton';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { OfflinePill } from '@/components/offline/OfflinePill';
import { ThemeToggleButton } from '@/components/theme/theme';
import { OrganizationSelector } from '@/components/dashboard/OrganizationSelector';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(' ');
}

function getInitials(name: string | null): string {
  const n = (name ?? '').trim();
  if (!n) return 'U';
  const parts = n.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? 'U';
  const b = parts[1]?.[0] ?? parts[0]?.[1] ?? '';
  return (a + b).toUpperCase();
}

function NavItem({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm transition-colors',
        active ? 'bg-primary-50 text-primary-700' : 'text-text-secondary hover:bg-subtle-bg hover:text-text-primary'
      )}
      aria-current={active ? 'page' : undefined}
    >
      <span className={cn('shrink-0', active ? 'text-primary-600' : 'text-muted')} aria-hidden>
        {icon}
      </span>
      <span className={cn('truncate', active ? 'font-semibold' : 'font-medium')}>{label}</span>
    </Link>
  );
}

function Icon({
  name,
}: {
  name:
  | 'grid'
  | 'calendar'
  | 'inbox'
  | 'repeat'
  | 'users'
  | 'settings'
  | 'building'
  | 'calendar-clock'
  | 'file-text'
  | 'briefcase'
  | 'calendar-day'
  | 'activity';
}) {
  switch (name) {
    case 'grid':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      );
    case 'calendar':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4" />
          <path d="M8 2v4" />
          <path d="M3 10h18" />
        </svg>
      );
    case 'inbox':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-6l-2 3h-4l-2-3H2" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      );
    case 'repeat':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 2l4 4-4 4" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <path d="M7 22l-4-4 4-4" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      );
    case 'users':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'settings':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7z" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.33 1.82V22a2 2 0 0 1-4 0v-.08A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1.82-.33H2a2 2 0 0 1 0-4h.08A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .33-1.82V2a2 2 0 0 1 4 0v.08A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.23.31.43.65.6 1a1.65 1.65 0 0 0 1.82.33H22a2 2 0 0 1 0 4h-.08A1.65 1.65 0 0 0 19.4 15z" />
        </svg>
      );
    case 'building':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M7 7h.01" />
          <path d="M11 7h.01" />
          <path d="M15 7h.01" />
          <path d="M7 11h.01" />
          <path d="M11 11h.01" />
          <path d="M15 11h.01" />
          <path d="M7 15h.01" />
          <path d="M11 15h.01" />
          <path d="M15 15h.01" />
        </svg>
      );
    case 'calendar-clock':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M3 10h18" />
          <path d="M16 14v4" />
          <path d="M16 14h3" />
        </svg>
      );
    case 'file-text':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
          <path d="M10 9H8" />
        </svg>
      );
    case 'briefcase':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      );
    case 'calendar-day':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4" />
          <path d="M8 2v4" />
          <path d="M3 10h18" />
          <path d="M8 14h.01" />
          <path d="M12 14h.01" />
          <path d="M16 14h.01" />
          <path d="M8 18h.01" />
          <path d="M12 18h.01" />
          <path d="M16 18h.01" />
        </svg>
      );
    case 'activity':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      );
  }
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const { orgId, userId, canManageShifts, canManageOrg } = useScheduleOrg();
  const [fullName, setFullName] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);

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

  const roleLabel = useMemo(() => {
    if (canManageOrg) return 'Admin';
    if (canManageShifts) return 'Manager';
    return 'Staff';
  }, [canManageOrg, canManageShifts]);

  const initials = useMemo(() => getInitials(fullName), [fullName]);

  return (
    <aside className="flex h-screen w-[260px] flex-col border-r border-border bg-background">
      <div className="flex items-center gap-3 px-5 py-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Turnia" className="h-10 w-10" />
        <span className="text-2xl font-bold text-primary-600">Turnia</span>
      </div>

      {/* Selector de organización */}
      <div className="px-3 pb-2">
        <OrganizationSelector />
      </div>

      <div className="flex-1 space-y-1 px-3 py-2">
        {/* Turnos por día - visible para todos los usuarios */}
        <NavItem
          href="/dashboard/daily-schedule"
          label="Turnos por día"
          icon={<Icon name="calendar-day" />}
          active={pathname?.startsWith('/dashboard/daily-schedule')}
        />
        <NavItem
          href="/dashboard/active-now"
          label="De turno ahora"
          icon={<Icon name="activity" />}
          active={pathname?.startsWith('/dashboard/active-now')}
        />
        <NavItem
          href="/dashboard/transactions"
          label="Transacciones"
          icon={<Icon name="repeat" />}
          active={pathname?.startsWith('/dashboard/transactions')}
        />

        {canManageOrg ? (
          <>
            <NavItem href="/dashboard" label="Dashboard" icon={<Icon name="grid" />} active={pathname === '/dashboard' || pathname === '/dashboard/admin'} />
            <NavItem
              href="/dashboard/manager"
              label="Calendario"
              icon={<Icon name="calendar" />}
              active={pathname?.startsWith('/dashboard/manager') && !pathname?.startsWith('/dashboard/manager/requests') && !pathname?.startsWith('/dashboard/manager/availability')}
            />
            <NavItem href="/dashboard/manager/requests" label="Solicitudes" icon={<Icon name="inbox" />} active={pathname?.startsWith('/dashboard/manager/requests')} />
            <NavItem href="/dashboard/admin/members" label="Miembros" icon={<Icon name="users" />} active={pathname?.startsWith('/dashboard/admin/members')} />
            <NavItem href="/dashboard/admin/organizations" label="Equipos" icon={<Icon name="building" />} active={pathname?.startsWith('/dashboard/admin/organizations')} />
            <NavItem href="/dashboard/admin/shift-types" label="Tipos de Turno" icon={<Icon name="calendar-clock" />} active={pathname?.startsWith('/dashboard/admin/shift-types')} />
            <NavItem href="/dashboard/admin/staff-positions" label="Puestos" icon={<Icon name="briefcase" />} active={pathname?.startsWith('/dashboard/admin/staff-positions')} />
            <NavItem href="/dashboard/admin/audit" label="Audit Log" icon={<Icon name="file-text" />} active={pathname?.startsWith('/dashboard/admin/audit')} />
          </>
        ) : canManageShifts ? (
          <>
            <NavItem href="/dashboard" label="Dashboard" icon={<Icon name="grid" />} active={pathname === '/dashboard'} />
            <NavItem
              href="/dashboard/manager"
              label="Calendario"
              icon={<Icon name="calendar" />}
              active={pathname?.startsWith('/dashboard/manager') && !pathname?.startsWith('/dashboard/manager/requests') && !pathname?.startsWith('/dashboard/manager/availability')}
            />
            <NavItem href="/dashboard/manager/requests" label="Solicitudes" icon={<Icon name="inbox" />} active={pathname?.startsWith('/dashboard/manager/requests')} />
            <NavItem href="/dashboard/manager/availability" label="Equipo" icon={<Icon name="users" />} active={pathname?.startsWith('/dashboard/manager/availability')} />
          </>
        ) : (
          <>
            <NavItem href="/dashboard" label="Dashboard" icon={<Icon name="grid" />} active={pathname === '/dashboard'} />
            <NavItem href="/dashboard/manager" label="Calendario" icon={<Icon name="calendar" />} active={pathname?.startsWith('/dashboard/manager')} />
            <NavItem href="/dashboard/staff/my-requests" label="Solicitudes" icon={<Icon name="inbox" />} active={pathname?.startsWith('/dashboard/staff/my-requests')} />
            <NavItem href="/dashboard/staff" label="Equipo" icon={<Icon name="users" />} active={pathname?.startsWith('/dashboard/staff')} />
            <NavItem href="/dashboard/profile" label="Configuración" icon={<Icon name="settings" />} active={pathname?.startsWith('/dashboard/profile')} />
          </>
        )}
      </div>

      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700" aria-hidden>
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-primary">{fullName?.trim() || roleLabel}</p>
            <p className="truncate text-xs text-muted">{orgName ? orgName : roleLabel}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-subtle-bg p-3">
          <OfflinePill variant="dot" />
          <div className="flex items-center gap-1">
            <ThemeToggleButton ariaLabel="Cambiar tema" />
            <NotificationBell />
            <LogoutButton />
          </div>
        </div>
      </div>
    </aside>
  );
}

