/**
 * Etiquetas de roles para UI. Los roles editables por org_admin (no superadmin).
 */
export const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Superadmin',
  org_admin: 'Admin org',
  team_manager: 'Gestor',
  user: 'Usuario',
  viewer: 'Solo lectura',
};

/** Roles que org_admin puede asignar (sin superadmin) */
export const ROLES_EDITABLE = ['org_admin', 'team_manager', 'user', 'viewer'] as const;
