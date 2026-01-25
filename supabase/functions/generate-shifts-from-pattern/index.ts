// Edge Function: generar turnos desde un patrón semanal.
// pattern: [{ day_of_week: 0-6 (0=Dom), shift_type_id, assigned_user_id? }]
// Para cada día en [date_from, date_to] se crean los turnos cuyos day_of_week coinciden.
// use_assignments: si false, todos assigned_user_id=null.
// @see project-roadmap.md Módulo 3.3

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function buildStartEndISO(
  date: string,
  startTime: string | null,
  endTime: string | null
): { start_at: string; end_at: string } {
  const st = (startTime || '08:00').toString().substring(0, 5);
  const etRaw = (endTime || '16:00').toString().substring(0, 5);
  const start_at = new Date(`${date}T${st}:00`).toISOString();

  let endDate = date;
  let et = etRaw;
  if (etRaw === '24:00' || etRaw.startsWith('24:')) {
    endDate = addDays(date, 1);
    et = '00:00';
  } else if (etRaw < st) {
    endDate = addDays(date, 1);
    et = etRaw;
  }
  const end_at = new Date(`${endDate}T${et}:00`).toISOString();
  return { start_at, end_at };
}

type PatternRow = { day_of_week: number; shift_type_id: string; assigned_user_id?: string | null };

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
      pattern: PatternRow[];
      date_from: string;
      date_to: string;
      use_assignments: boolean;
      status?: 'draft' | 'published';
    };
    const { org_id, pattern, date_from, date_to, use_assignments } = body;

    if (!org_id || !pattern || !Array.isArray(pattern) || pattern.length === 0 || !date_from || !date_to) {
      return new Response(
        JSON.stringify({ error: 'org_id, pattern (array no vacío), date_from y date_to son obligatorios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const from = new Date(date_from + 'T12:00:00');
    const to = new Date(date_to + 'T12:00:00');
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
      return new Response(
        JSON.stringify({ error: 'date_from y date_to deben ser fechas válidas con date_from <= date_to' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Permisos
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

    const typeIds = [...new Set(pattern.map((p) => p.shift_type_id))];
    const { data: types, error: typesErr } = await supabase
      .from('organization_shift_types')
      .select('id, start_time, end_time')
      .eq('org_id', org_id)
      .in('id', typeIds);

    if (typesErr || !types) {
      return new Response(JSON.stringify({ error: 'Error al cargar tipos de turno' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const typeMap: Record<string, { start_time: string | null; end_time: string | null }> = {};
    for (const t of types) {
      typeMap[t.id] = { start_time: t.start_time, end_time: t.end_time };
    }

    const status = body.status === 'published' ? 'published' : 'draft';
    let generated = 0;

    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      const dateStr = d.toISOString().slice(0, 10);

      for (const row of pattern) {
        if (row.day_of_week !== dayOfWeek) continue;
        const type = typeMap[row.shift_type_id];
        if (!type) continue;

        const { start_at, end_at } = buildStartEndISO(dateStr, type.start_time, type.end_time);
        const assigned = use_assignments ? (row.assigned_user_id ?? null) : null;

        if (assigned) {
          const { data: mem } = await supabase
            .from('memberships')
            .select('id')
            .eq('org_id', org_id)
            .eq('user_id', assigned)
            .maybeSingle();
          if (!mem) continue;

          const { data: rpc, error: rpcErr } = await supabase.rpc('check_shift_conflicts', {
            p_user_id: assigned,
            p_start_at: start_at,
            p_end_at: end_at,
            p_exclude_shift_id: null,
            p_org_id: org_id,
            p_min_rest_hours: 0,
          });
          if (!rpcErr) {
            const r = Array.isArray(rpc) ? rpc[0] : rpc;
            if (r?.has_conflict && r?.message) continue; // skip this one on conflict
          }
        }

        const { error: insErr } = await supabase.from('shifts').insert({
          org_id,
          shift_type_id: row.shift_type_id,
          start_at,
          end_at,
          assigned_user_id: assigned,
          location: null,
          status,
        });
        if (!insErr) generated += 1;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, generated }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
