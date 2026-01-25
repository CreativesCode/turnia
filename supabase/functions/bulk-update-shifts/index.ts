// Edge Function: asignar o desasignar varios turnos a la vez.
// Requiere: team_manager, org_admin o superadmin en la org.
// Valida conflictos (solapamiento, disponibilidad) al asignar.
// @see project-roadmap.md Módulo 3.3

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

    const body = (await req.json()) as { ids: string[]; assigned_user_id: string | null };
    const { ids, assigned_user_id } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return new Response(JSON.stringify({ error: 'ids (array no vacío) es obligatorio' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (assigned_user_id !== null && typeof assigned_user_id !== 'string') {
      return new Response(JSON.stringify({ error: 'assigned_user_id debe ser string o null' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: shifts, error: shiftsErr } = await supabase
      .from('shifts')
      .select('id, org_id, start_at, end_at, assigned_user_id')
      .in('id', ids);

    if (shiftsErr || !shifts || shifts.length !== ids.length) {
      return new Response(JSON.stringify({ error: 'Uno o más turnos no existen' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orgId = shifts[0].org_id;
    if (shifts.some((s) => s.org_id !== orgId)) {
      return new Response(JSON.stringify({ error: 'Todos los turnos deben ser de la misma organización' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Permisos: team_manager, org_admin o superadmin
    const { data: membership } = await supabase
      .from('memberships')
      .select('id')
      .eq('org_id', orgId)
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
        JSON.stringify({ error: 'No tienes permiso para editar estos turnos' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (assigned_user_id) {
      const { data: mem } = await supabase
        .from('memberships')
        .select('id')
        .eq('org_id', orgId)
        .eq('user_id', assigned_user_id)
        .maybeSingle();
      if (!mem) {
        return new Response(
          JSON.stringify({ error: 'El usuario a asignar no es miembro de la organización' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 1) Solapamiento dentro del propio batch
      for (let i = 0; i < shifts.length; i++) {
        for (let j = i + 1; j < shifts.length; j++) {
          const a = shifts[i];
          const b = shifts[j];
          const aS = new Date(a.start_at).getTime();
          const aE = new Date(a.end_at).getTime();
          const bS = new Date(b.start_at).getTime();
          const bE = new Date(b.end_at).getTime();
          if (aE > bS && bE > aS) {
            return new Response(
              JSON.stringify({
                error: 'Algunos de los turnos seleccionados se solapan entre sí. Asigna por grupos que no se solapen.',
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }

      // 2) Para cada turno: solapamiento con otros turnos del usuario y availability_events (vía RPC)
      for (const s of shifts) {
        const { data: rpc, error: rpcErr } = await supabase.rpc('check_shift_conflicts', {
          p_user_id: assigned_user_id,
          p_start_at: s.start_at,
          p_end_at: s.end_at,
          p_exclude_shift_id: null,
          p_org_id: orgId,
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
        // Excluir del "otros turnos" a los del batch: el RPC no los excluye, así que podría
        // marcar conflicto entre dos turnos del batch. Hemos comprobado ya el intra-batch.
        // El RPC considera "otros turnos" en la DB: los del batch aún tienen el asignado viejo,
        // no el nuevo. Al asignar A y B (ambos a User X): al comprobar A, B en DB tiene otro
        // asignado, no X, así que no hay conflicto. Al comprobar B, A en DB podría seguir con
        // el viejo. Tras el primer update, A ya tendría X. Mejor: hacemos los updates uno a uno
        // y así el RPC vería los ya actualizados. Pero entonces el intra-batch ya lo tenemos.
        // El problema: si asignamos A y B (mismo usuario) y A y B se solapan. Intra-batch: OK.
        // RPC para A: busca otros turnos de X. B aún no está asignado a X, no sale. RPC para B:
        // busca otros de X. A aún no actualizado... vamos a actualizar al final todos juntos.
        // Así que para el RPC, "otros turnos de X" no incluye los de nuestro batch (no actualizados).
        // Solapamiento A-B: el RPC para A no ve B (B no tiene assigned_user_id=X). Para B no ve A.
        // Por tanto el intra-batch overlap es la única comprobación entre ellos. Bien.
      }
    }

    const { error: updateErr } = await supabase
      .from('shifts')
      .update({
        assigned_user_id: assigned_user_id ?? null,
        updated_at: new Date().toISOString(),
      })
      .in('id', ids)
      .eq('org_id', orgId);

    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, updated: ids.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
