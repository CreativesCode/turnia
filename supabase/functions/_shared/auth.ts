// Helpers compartidos para Edge Functions: auth, permisos, rate limiting y logging de fallos.
// @see project-roadmap.md Módulo 9.2

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

type AuthResult = { user: { id: string } } | { error: 'no_bearer' | 'invalid_token' };

/** Obtiene el usuario autenticado desde el header Authorization. */
export async function getAuthUser(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return { error: 'no_bearer' };
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { error: 'invalid_token' };
  return { user: { id: user.id } };
}

/** team_manager, org_admin o superadmin en la org. */
export async function checkCanManageShifts(
  supabase: SupabaseClient,
  userId: string,
  orgId: string
): Promise<boolean> {
  const { data: m } = await supabase
    .from('memberships')
    .select('id')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .in('role', ['team_manager', 'org_admin', 'superadmin'])
    .maybeSingle();
  if (m) return true;
  const { data: sa } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'superadmin')
    .limit(1)
    .maybeSingle();
  return !!sa;
}

/** team_manager, org_admin o superadmin (para aprobar solicitudes). */
export async function checkCanApproveRequests(
  supabase: SupabaseClient,
  userId: string,
  orgId: string
): Promise<boolean> {
  return checkCanManageShifts(supabase, userId, orgId);
}

/** org_admin o superadmin en la org (invitar, gestionar miembros, etc.). */
export async function checkCanManageOrg(
  supabase: SupabaseClient,
  userId: string,
  orgId: string
): Promise<boolean> {
  const { data: m } = await supabase
    .from('memberships')
    .select('id')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .in('role', ['org_admin', 'superadmin'])
    .maybeSingle();
  if (m) return true;
  const { data: sa } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'superadmin')
    .limit(1)
    .maybeSingle();
  return !!sa;
}

/** Solo org_admin o superadmin (team_manager NO puede eliminar turnos). */
export async function checkCanDeleteShifts(
  supabase: SupabaseClient,
  userId: string,
  orgId: string
): Promise<boolean> {
  const { data: m } = await supabase
    .from('memberships')
    .select('id')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .in('role', ['org_admin', 'superadmin'])
    .maybeSingle();
  if (m) return true;
  const { data: sa } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'superadmin')
    .limit(1)
    .maybeSingle();
  return !!sa;
}

export type LogFailedAttemptOpts = {
  functionName: string;
  userId?: string | null;
  orgId?: string | null;
  reason: string;
  status: number;
};

/** Registra intentos fallidos: console (siempre) y audit_log (si se pasa supabase con service_role). */
export async function logFailedAttempt(
  supabase: SupabaseClient | null,
  opts: LogFailedAttemptOpts
): Promise<void> {
  const { functionName, userId, orgId, reason, status } = opts;
  console.error(`[${functionName}] Failed attempt: ${status} - ${reason}`, {
    userId: userId ?? 'anonymous',
    orgId: orgId ?? null,
  });
  if (supabase) {
    supabase
      .from('audit_log')
      .insert({
        org_id: orgId ?? null,
        actor_id: userId ?? null,
        entity: 'failed_auth',
        entity_id: null,
        action: String(status),
        after_snapshot: { function: functionName, reason },
        comment: reason,
      })
      .then(({ error }) => {
        if (error) console.error(`[${functionName}] logFailedAttempt insert error:`, error.message);
      })
      .catch((e) => console.error(`[${functionName}] logFailedAttempt:`, e));
  }
}

/**
 * Comprueba si la llamada está dentro del rate limit.
 * Por ahora es no-op (siempre permitido). Para activar:
 * - Crear tabla o RPC (p. ej. rate_limit_buckets por user_id + function_name + ventana).
 * - Implementar la lógica aquí.
 */
export async function checkRateLimit(
  _supabase: SupabaseClient,
  _userId: string,
  _functionName: string
): Promise<{ allowed: boolean }> {
  return { allowed: true };
}
