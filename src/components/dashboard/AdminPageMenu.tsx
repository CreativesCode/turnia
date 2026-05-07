'use client';

/**
 * Hub del panel de administración: grid de cards de acceso rápido.
 * Diseño: ref docs/design/screens/extras2.jsx DAdminExports (línea 189).
 *
 * El enlace "Auditoría" solo se muestra a admins con `canManageOrg`.
 */

import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { Icons, type IconProps } from '@/components/ui/icons';
import Link from 'next/link';

type CardDef = {
  href: string;
  title: string;
  description: string;
  icon: React.FC<IconProps>;
  /** Color de acento (token CSS o hex). */
  accent: string;
  /** Solo visible para admins. */
  adminOnly?: boolean;
};

const CARDS: CardDef[] = [
  {
    href: '/dashboard/admin/members',
    title: 'Miembros',
    description: 'Gestiona usuarios, roles y membresías de tu organización.',
    icon: Icons.users,
    accent: 'var(--primary)',
  },
  {
    href: '/dashboard/admin/invite',
    title: 'Invitaciones',
    description: 'Envía invitaciones por email y monitoriza las pendientes.',
    icon: Icons.mail,
    accent: 'var(--blue)',
  },
  {
    href: '/dashboard/admin/teams',
    title: 'Equipos',
    description: 'Equipos del centro modelados como sub-organizaciones, con cobertura.',
    icon: Icons.briefcase,
    accent: 'var(--violet)',
  },
  {
    href: '/dashboard/admin/shift-types',
    title: 'Tipos de turno',
    description: 'Crea y configura los tipos de turno: horario, color, plus.',
    icon: Icons.cal2,
    accent: 'var(--amber)',
  },
  {
    href: '/dashboard/admin/staff-positions',
    title: 'Puestos',
    description: 'Define puestos del equipo y los permisos de cada categoría.',
    icon: Icons.stethoscope,
    accent: 'var(--green)',
  },
  {
    href: '/dashboard/admin/exports',
    title: 'Exportar datos',
    description: 'Descarga turnos, horas, solicitudes o auditoría en CSV/XLSX/PDF.',
    icon: Icons.download,
    accent: 'var(--primary)',
  },
  {
    href: '/dashboard/admin/reports',
    title: 'Reportes',
    description: 'Insights del rendimiento del equipo y tendencias por mes.',
    icon: Icons.trend,
    accent: 'var(--blue)',
  },
  {
    href: '/dashboard/admin/audit',
    title: 'Auditoría',
    description: 'Registro detallado de cambios y acciones en la organización.',
    icon: Icons.history,
    accent: 'var(--amber)',
    adminOnly: true,
  },
  {
    href: '/dashboard/admin/permissions',
    title: 'Permisos',
    description: 'Matriz de capacidades por rol: qué puede hacer cada quién.',
    icon: Icons.shield,
    accent: 'var(--violet)',
  },
  {
    href: '/dashboard/admin/settings',
    title: 'Configuración',
    description: 'Reglas de turnos, aprobaciones, notificaciones y seguridad.',
    icon: Icons.settings,
    accent: 'var(--red)',
  },
];

function AdminCard({ card }: { card: CardDef }) {
  const Icon = card.icon;
  return (
    <Link
      href={card.href}
      className="group flex items-start gap-3.5 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-border-strong"
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
        style={{
          backgroundColor: `color-mix(in oklab, ${card.accent} 14%, transparent)`,
          color: card.accent,
        }}
      >
        <Icon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="tn-h text-[14.5px] font-bold text-text">{card.title}</p>
        <p className="mt-0.5 text-[12px] leading-[1.5] text-muted">{card.description}</p>
      </div>
      <Icons.chevronR
        size={17}
        className="mt-1 shrink-0 text-muted transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}

export function AdminPageMenu() {
  const { canManageOrg } = useScheduleOrg();
  const cards = CARDS.filter((c) => !c.adminOnly || canManageOrg);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <AdminCard key={c.href} card={c} />
      ))}
    </div>
  );
}
