// Edge Function: crear turno
// Requiere: team_manager, org_admin o superadmin en la org.
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
      org_id: string;
      shift_type_id: string;
      start_at: string;
      end_at: string;
      assigned_user_id?: string | null;
      location?: string | null;
      status?: 'draft' | 'published';
    };
    const { org_id, shift_type_id, start_at, end_at, assigned_user_id, location, status } = body;

    if (!org_id || !shift_type_id || !start_at || !end_at) {
      return new Response(
        JSON.stringify({ error: 'org_id, shift_type_id, start_at and end_at are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const st = status === 'published' ? 'published' : 'draft';

    // Permisos: team_manager, org_admin o superadmin en esta org
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
        JSON.stringify({ error: 'No tienes permiso para crear turnos en esta organización' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // shift_type_id debe pertenecer a la org
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

    // Si hay assigned_user_id, debe ser miembro de la org
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

      // Validar conflictos: overlap, disponibilidad, descanso mínimo (desde org_settings)
      const { data: os } = await supabase.from('org_settings').select('min_rest_hours').eq('org_id', org_id).maybeSingle();
      const minRest = (os as { min_rest_hours?: number } | null)?.min_rest_hours ?? 0;
      const { data: rpc, error: rpcErr } = await supabase.rpc('check_shift_conflicts', {
        p_user_id: assigned_user_id,
        p_start_at: start_at,
        p_end_at: end_at,
        p_exclude_shift_id: null,
        p_org_id: org_id,
        p_min_rest_hours: minRest,
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

    const { data: inserted, error: insertErr } = await supabase
      .from('shifts')
      .insert({
        org_id,
        shift_type_id,
        start_at,
        end_at,
        assigned_user_id: assigned_user_id || null,
        location: location || null,
        status: st,
      })
      .select('id')
      .single();

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Notificación: Shift assigned (Módulo 5.2)
    if (assigned_user_id) {
      const { data: stRow2 } = await supabase
        .from('organization_shift_types')
        .select('name')
        .eq('id', shift_type_id)
        .single();
      const typeName = (stRow2 as { name?: string } | null)?.name ?? 'Turno';
      const dateStr = new Date(start_at).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      await supabase.from('notifications').insert({
        user_id: assigned_user_id,
        title: 'Turno asignado',
        message: `Te han asignado un turno: ${dateStr}, ${typeName}.`,
        type: 'shift',
        entity_type: 'shift',
        entity_id: inserted.id,
      });
    }

    return new Response(
      JSON.stringify({ ok: true, id: inserted.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
