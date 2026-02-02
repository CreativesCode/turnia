import type { SupabaseClient } from '@supabase/supabase-js';

type ProfileRow = { id: string; full_name: string | null };

/**
 * Carga perfiles en batch y devuelve un mapa id -> nombre (full_name).
 * Si full_name no está disponible, usa `fallbackName` (o string vacío).
 */
export async function fetchProfilesMap(
  supabase: SupabaseClient,
  userIds: string[],
  options?: { fallbackName?: (id: string) => string }
): Promise<Record<string, string>> {
  const uniqueIds = Array.from(new Set((userIds ?? []).filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const { data, error } = await supabase.from('profiles').select('id, full_name').in('id', uniqueIds);
  if (error) return {};

  const map: Record<string, string> = {};
  (data as ProfileRow[] | null | undefined)?.forEach((p) => {
    const name = p.full_name?.trim();
    map[p.id] = name && name.length > 0 ? name : (options?.fallbackName?.(p.id) ?? '');
  });
  return map;
}

/**
 * Carga tipos de turnos para una organización.
 */
export async function fetchShiftTypes(supabase: SupabaseClient, orgId: string) {
  return await supabase
    .from('organization_shift_types')
    .select('id, name, letter, color')
    .eq('org_id', orgId)
    .order('sort_order')
    .order('name');
}

/**
 * Carga IDs de miembros de una organización.
 */
export async function fetchOrgMemberIds(supabase: SupabaseClient, orgId: string): Promise<string[]> {
  const { data, error } = await supabase.from('memberships').select('user_id').eq('org_id', orgId);
  if (error) return [];
  return (data ?? []).map((m: { user_id: string | null }) => m.user_id).filter(Boolean) as string[];
}
