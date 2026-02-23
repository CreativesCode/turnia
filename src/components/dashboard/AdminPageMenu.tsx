'use client';

/**
 * Menú del panel de administración. El enlace "Audit log" solo se muestra a administradores (org_admin / superadmin).
 */

import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import Link from 'next/link';

const iconNames = ['user-plus', 'users', 'calendar-clock', 'download', 'file-text', 'building'] as const;

function Icon({ name }: { name: (typeof iconNames)[number] }) {
  switch (name) {
    case 'user-plus':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M15 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8" cy="7" r="4" />
          <path d="M20 8v6" />
          <path d="M23 11h-6" />
        </svg>
      );
    case 'users':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M17 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M7 21v-2a4 4 0 0 1 4-4h0" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'calendar-clock':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M3 10h18" />
          <path d="M16 14v4" />
          <path d="M16 14h3" />
        </svg>
      );
    case 'download':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="M7 10l5 5 5-5" />
          <path d="M12 15V3" />
        </svg>
      );
    case 'file-text':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
          <path d="M10 9H8" />
        </svg>
      );
    case 'building':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
    default:
      return null;
  }
}

function MenuLink({
  href,
  label,
  icon,
  last = false,
}: {
  href: string;
  label: string;
  icon: (typeof iconNames)[number];
  last?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-[52px] items-center gap-3 px-4 text-sm text-text-primary hover:bg-subtle-bg ${last ? '' : 'border-b border-border'}`}
    >
      <span className="text-primary-600" aria-hidden>
        <Icon name={icon} />
      </span>
      <span className="flex-1">{label}</span>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted" aria-hidden>
        <path d="m9 18 6-6-6-6" />
      </svg>
    </Link>
  );
}

export function AdminPageMenu() {
  const { canManageOrg } = useScheduleOrg();

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background md:rounded-xl">
      <MenuLink href="/dashboard/admin/invite" label="Invitar usuarios" icon="user-plus" />
      <MenuLink href="/dashboard/admin/members" label="Gestión de miembros" icon="users" />
      <MenuLink href="/dashboard/admin/shift-types" label="Tipos de turno" icon="calendar-clock" />
      <MenuLink href="/dashboard/admin/exports" label="Exportar horarios" icon="download" />
      {canManageOrg && (
        <MenuLink href="/dashboard/admin/audit" label="Audit log" icon="file-text" />
      )}
      <MenuLink href="/dashboard/admin/organizations" label="Organizaciones" icon="building" last />
    </div>
  );
}
