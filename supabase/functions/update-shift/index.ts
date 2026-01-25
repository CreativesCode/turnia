// Edge Function: actualizar turno
// Requiere: team_manager, org_admin o superadmin en la org del turno.
// @see project-roadmap.md Módulo 3.2

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authorization Bearer required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = (await req.json()) as {
      id: string;
      shift_type_id?: string;
      start_at?: string;
      end_at?: string;
      assigned_user_id?: string | null;
      location?: string | null;
      status?: 'draft' | 'published';
    };
    const { id, shift_type_id, start_at, end_at, assigned_user_id, location, status } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: 'id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: shift, error: shiftErr } = await supabase
      .from('shifts')
      .select('id, org_id, start_at, end_at, assigned_user_id')
      .eq('id', id)
      .single();

    if (shiftErr || !shift) {
      return new Response(JSON.stringify({ error: 'Turno no encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const org_id = shift.org_id;

    // Permisos: team_manager, org_admin o superadmin
    const { data: membership } = await supabase
      .from('memberships')
      .select('id')
      .eq('org_id', org_id)
      .eq('user_id', user.id)
      .in('role', ['team_manager', 'org_admin', 'superadmin'])
      .maybeSingle();

    let isSuperadmin = false;
    if (!membership) {
      const { data: sa } = await supabase
        .from('memberships')
        .select('id')
        .eq('user_id', user.id)
        .eq('role', 'superadmin')
        .limit(1)
        .maybeSingle();
      isSuperadmin = !!sa;
    }

    if (!membership && !isSuperadmin) {
      return new Response(
        JSON.stringify({ error: 'No tienes permiso para editar este turno' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (shift_type_id) {
      const { data: stRow, error: stErr } = await supabase
        .from('organization_shift_types')
        .select('id')
        .eq('id', shift_type_id)
        .eq('org_id', org_id)
        .maybeSingle();
      if (stErr || !stRow) {
        return new Response(
          JSON.stringify({ error: 'Tipo de turno no válido o no pertenece a la organización' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (assigned_user_id) {
      const { data: mem } = await supabase
        .from('memberships')
        .select('id')
        .eq('org_id', org_id)
        .eq('user_id', assigned_user_id)
        .maybeSingle();
      if (!mem) {
        return new Response(
          JSON.stringify({ error: 'El usuario asignado no es miembro de la organización' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const updates: Record<string, unknown> = {};
    if (shift_type_id != null) updates.shift_type_id = shift_type_id;
    if (start_at != null) updates.start_at = start_at;
    if (end_at != null) updates.end_at = end_at;
    if (assigned_user_id !== undefined) updates.assigned_user_id = assigned_user_id || null;
    if (location !== undefined) updates.location = location || null;
    if (status === 'draft' || status === 'published') updates.status = status;

    // Validar conflictos si hay usuario asignado (el nuevo o el actual)
    const newAssigned =
      assigned_user_id !== undefined ? assigned_user_id || null : shift.assigned_user_id;
    if (newAssigned) {
      const newStart = (updates.start_at as string) ?? shift.start_at;
      const newEnd = (updates.end_at as string) ?? shift.end_at;
      const { data: rpc, error: rpcErr } = await supabase.rpc('check_shift_conflicts', {
        p_user_id: newAssigned,
        p_start_at: newStart,
        p_end_at: newEnd,
        p_exclude_shift_id: id,
        p_org_id: org_id,
        p_min_rest_hours: 0,
      });
      if (!rpcErr) {
        const row = Array.isArray(rpc) ? rpc[0] : rpc;
        if (row?.has_conflict && row?.message) {
          return new Response(JSON.stringify({ error: row.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: updateErr } = await supabase
      .from('shifts')
      .update(updates)
      .eq('id', id)
      .eq('org_id', org_id);

    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
