// Edge Function: copiar turnos de un período a otro.
// source_from/source_to: rango de start_at a incluir. target_start: primer día del destino.
// Opción copy_assignments: copiar o dejar sin asignar.
// @see project-roadmap.md Módulo 3.3

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function daysBetween(a: string, b: string): number {
  const d1 = new Date(a);
  const d2 = new Date(b);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}

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
      source_from: string;
      source_to: string;
      target_start: string;
      copy_assignments: boolean;
    };
    const { org_id, source_from, source_to, target_start, copy_assignments } = body;

    if (!org_id || !source_from || !source_to || !target_start) {
      return new Response(
        JSON.stringify({ error: 'org_id, source_from, source_to y target_start son obligatorios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const srcFrom = new Date(source_from);
    const srcTo = new Date(source_to);
    if (isNaN(srcFrom.getTime()) || isNaN(srcTo.getTime()) || srcFrom > srcTo) {
      return new Response(
        JSON.stringify({ error: 'source_from y source_to deben ser fechas válidas con source_from <= source_to' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
        JSON.stringify({ error: 'No tienes permiso para crear turnos en esta organización' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const offsetDays = daysBetween(source_from, target_start);

    const { data: shifts, error: fetchErr } = await supabase
      .from('shifts')
      .select('id, shift_type_id, start_at, end_at, assigned_user_id, location, status')
      .eq('org_id', org_id)
      .gte('start_at', srcFrom.toISOString())
      .lte('start_at', srcTo.toISOString());

    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const list = shifts ?? [];
    if (list.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, copied: 0, message: 'No hay turnos en el período origen' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let copied = 0;
    for (const s of list) {
      const newStart = addDays(s.start_at, offsetDays);
      const newEnd = addDays(s.end_at, offsetDays);
      const assigned = copy_assignments ? (s.assigned_user_id ?? null) : null;

      if (assigned) {
        const { data: rpc, error: rpcErr } = await supabase.rpc('check_shift_conflicts', {
          p_user_id: assigned,
          p_start_at: newStart,
          p_end_at: newEnd,
          p_exclude_shift_id: null,
          p_org_id: org_id,
          p_min_rest_hours: 0,
        });
        if (!rpcErr) {
          const row = Array.isArray(rpc) ? rpc[0] : rpc;
          if (row?.has_conflict && row?.message) {
            return new Response(
              JSON.stringify({
                error: row.message,
                copied,
                failed_shift: { start: s.start_at, assigned },
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }

      const { error: insertErr } = await supabase.from('shifts').insert({
        org_id,
        shift_type_id: s.shift_type_id,
        start_at: newStart,
        end_at: newEnd,
        assigned_user_id: assigned,
        location: s.location ?? null,
        status: s.status === 'published' ? 'published' : 'draft',
      });

      if (insertErr) {
        return new Response(
          JSON.stringify({ error: insertErr.message, copied }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      copied += 1;
    }

    return new Response(
      JSON.stringify({ ok: true, copied }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
