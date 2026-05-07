'use client';

import { Pill, type PillTone } from '@/components/ui/Pill';
import { CheckIcon } from '@/components/ui/icons';

type Role = 'staff' | 'manager' | 'org_admin' | 'superadmin';

const ROLES: ReadonlyArray<{ key: Role; label: string; tone: PillTone }> = [
  { key: 'staff', label: 'Staff', tone: 'primary' },
  { key: 'manager', label: 'Manager', tone: 'violet' },
  { key: 'org_admin', label: 'OrgAdmin', tone: 'red' },
  { key: 'superadmin', label: 'Superadmin', tone: 'amber' },
];

const ROLE_COLOR_VAR: Record<Role, string> = {
  staff: 'var(--color-primary)',
  manager: 'var(--violet)',
  org_admin: 'var(--red)',
  superadmin: 'var(--amber)',
};

type Capability = {
  key: string;
  label: string;
  description?: string;
  roles: Partial<Record<Role, boolean>>;
};

type Category = {
  key: string;
  label: string;
  capabilities: Capability[];
};

const MATRIX: ReadonlyArray<Category> = [
  {
    key: 'calendar',
    label: 'Calendario',
    capabilities: [
      {
        key: 'view-shifts',
        label: 'Ver turnos del equipo',
        roles: { staff: true, manager: true, org_admin: true, superadmin: true },
      },
      {
        key: 'create-shifts',
        label: 'Crear y editar turnos',
        roles: { manager: true, org_admin: true, superadmin: true },
      },
      {
        key: 'publish-shifts',
        label: 'Publicar y despublicar planificación',
        roles: { manager: true, org_admin: true, superadmin: true },
      },
      {
        key: 'export-schedule',
        label: 'Exportar horarios',
        roles: { manager: true, org_admin: true, superadmin: true },
      },
    ],
  },
  {
    key: 'requests',
    label: 'Solicitudes',
    capabilities: [
      {
        key: 'create-request',
        label: 'Crear swap, cesión o tomar turno abierto',
        roles: { staff: true, manager: true, org_admin: true, superadmin: true },
      },
      {
        key: 'cancel-own',
        label: 'Cancelar tus propias solicitudes',
        roles: { staff: true, manager: true, org_admin: true, superadmin: true },
      },
      {
        key: 'approve-requests',
        label: 'Aprobar o rechazar solicitudes del equipo',
        roles: { manager: true, org_admin: true, superadmin: true },
      },
      {
        key: 'create-leave',
        label: 'Solicitar permisos (vacaciones, licencias)',
        roles: { staff: true, manager: true, org_admin: true, superadmin: true },
      },
    ],
  },
  {
    key: 'team',
    label: 'Equipo',
    capabilities: [
      {
        key: 'view-availability',
        label: 'Ver disponibilidad del equipo',
        roles: { manager: true, org_admin: true, superadmin: true },
      },
      {
        key: 'edit-team-availability',
        label: 'Editar disponibilidad de otros',
        roles: { manager: true, org_admin: true, superadmin: true },
      },
      {
        key: 'view-stats',
        label: 'Ver estadísticas y reportes',
        roles: { manager: true, org_admin: true, superadmin: true },
      },
    ],
  },
  {
    key: 'admin',
    label: 'Administración',
    capabilities: [
      {
        key: 'invite-members',
        label: 'Invitar miembros',
        roles: { org_admin: true, superadmin: true },
      },
      {
        key: 'manage-shift-types',
        label: 'Configurar tipos de turno y puestos',
        roles: { org_admin: true, superadmin: true },
      },
      {
        key: 'org-settings',
        label: 'Editar reglas y configuración de la organización',
        roles: { org_admin: true, superadmin: true },
      },
      {
        key: 'audit',
        label: 'Ver auditoría',
        roles: { org_admin: true, superadmin: true },
      },
      {
        key: 'manage-orgs',
        label: 'Crear y administrar otras organizaciones',
        roles: { superadmin: true },
      },
    ],
  },
];

function Cell({ enabled, color }: { enabled: boolean; color: string }) {
  if (!enabled) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center text-muted">—</span>
    );
  }
  return (
    <span
      className="inline-flex h-6 w-6 items-center justify-center rounded-md"
      style={{
        background: `color-mix(in oklab, ${color} 18%, transparent)`,
        color,
      }}
      aria-label="Permitido"
    >
      <CheckIcon size={14} stroke={2.6} />
    </span>
  );
}

export function PermissionsMatrix() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-bg">
      {/* Header */}
      <div className="grid grid-cols-[1fr_repeat(4,minmax(96px,120px))] gap-2 border-b border-border bg-subtle-bg px-4 py-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
          Capacidad
        </div>
        {ROLES.map((r) => (
          <div key={r.key} className="text-center">
            <Pill tone={r.tone}>{r.label}</Pill>
          </div>
        ))}
      </div>

      {/* Body */}
      {MATRIX.map((cat, ci) => (
        <div key={cat.key}>
          <div
            className={
              'sticky top-0 z-10 bg-subtle-2/40 px-4 py-2 text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted ' +
              (ci > 0 ? 'border-t border-border' : '')
            }
          >
            {cat.label}
          </div>
          {cat.capabilities.map((cap, i) => (
            <div
              key={cap.key}
              className={
                'grid grid-cols-[1fr_repeat(4,minmax(96px,120px))] items-center gap-2 px-4 py-3 text-[13px] ' +
                (i < cat.capabilities.length - 1 ? 'border-b border-border' : '')
              }
            >
              <div className="min-w-0">
                <div className="font-medium text-text">{cap.label}</div>
                {cap.description ? (
                  <div className="mt-0.5 text-[11.5px] text-muted">{cap.description}</div>
                ) : null}
              </div>
              {ROLES.map((r) => (
                <div key={r.key} className="flex items-center justify-center">
                  <Cell enabled={!!cap.roles[r.key]} color={ROLE_COLOR_VAR[r.key]} />
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
