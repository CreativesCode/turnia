// Edge Function: exportar horarios a CSV (y opcional Excel/PDF)
// @see indications.md §5.8

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { orgId, teamId, start, end } = (await req.json()) as {
      orgId: string;
      teamId?: string;
      start: string;
      end: string;
    };

    if (!orgId || !start || !end) {
      return new Response(
        JSON.stringify({ error: 'orgId, start, end required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let q = supabase
      .from('shifts')
      .select('id, shift_type, status, start_at, end_at, assigned_user_id')
      .eq('org_id', orgId)
      .gte('start_at', start)
      .lte('end_at', end)
      .order('start_at');

    if (teamId) q = q.eq('team_id', teamId);

    const { data: rows, error } = await q;

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CSV simple (assigned_user_id; resolver nombres en frontend o vista posterior)
    const headers = ['id', 'shift_type', 'status', 'start_at', 'end_at', 'assigned_user_id'];
    const lines = [
      headers.join(','),
      ...(rows || []).map((r: Record<string, unknown>) =>
        [r.id, r.shift_type, r.status, r.start_at, r.end_at, r.assigned_user_id ?? ''].join(',')
      ),
    ];
    const csv = lines.join('\n');

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename=schedule.csv',
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
