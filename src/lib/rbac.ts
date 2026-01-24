/**
 * RBAC: roles y helpers de permisos (Org/Team scoped)
 * @see indications.md §4
 */

export type Role =
  | 'superadmin'
  | 'org_admin'
  | 'team_manager'
  | 'user'
  | 'viewer';

export type MembershipRow = {
  org_id: string;
  team_id: string | null;
  role: Role;
};

export function isSuperadmin(role: Role): boolean {
  return role === 'superadmin';
}

export function isOrgAdmin(role: Role): boolean {
  return role === 'org_admin' || role === 'superadmin';
}

export function isTeamManager(role: Role): boolean {
  return role === 'team_manager' || isOrgAdmin(role);
}

export function isViewer(role: Role): boolean {
  return role === 'viewer';
}

export function isStaff(role: Role): boolean {
  return role === 'user' || role === 'viewer';
}

/** Puede gestionar org, equipos y asignación de roles */
export function canManageOrg(m: MembershipRow): boolean {
  return isOrgAdmin(m.role) || isSuperadmin(m.role);
}

/** Puede crear/editar turnos y aprobar solicitudes en el equipo */
export function canManageShifts(m: MembershipRow): boolean {
  return isTeamManager(m.role);
}

/** Puede ver todos los turnos del equipo (o solo los publicados según política) */
export function canViewTeamShifts(_m: MembershipRow): boolean {
  return true; // Viewer: solo lectura; política org define si ve “solo publicados”
}

/** Puede crear solicitudes (dar turno, swap, tomar abierto) */
export function canCreateRequests(m: MembershipRow): boolean {
  return m.role === 'user' || isTeamManager(m.role);
}

/** Puede aprobar/rechazar solicitudes en el equipo */
export function canApproveRequests(m: MembershipRow): boolean {
  return isTeamManager(m.role);
}

/** Rol con más privilegios entre varios (para membership en org+team) */
export function highestRole(roles: Role[]): Role {
  const order: Role[] = ['viewer', 'user', 'team_manager', 'org_admin', 'superadmin'];
  let i = 0;
  for (const r of roles) {
    const idx = order.indexOf(r);
    if (idx > i) i = idx;
  }
  return order[i];
}
