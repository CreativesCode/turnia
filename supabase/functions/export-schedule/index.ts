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

    const { orgId, start, end } = (await req.json()) as {
      orgId: string;
      start: string;
      end: string;
    };

    if (!orgId || !start || !end) {
      return new Response(
        JSON.stringify({ error: 'orgId, start, end required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: rows, error } = await supabase
      .from('shifts')
      .select('id, status, start_at, end_at, assigned_user_id, organization_shift_types(name, letter)')
      .eq('org_id', orgId)
      .gte('start_at', start)
      .lte('end_at', end)
      .order('start_at');

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CSV: shift_type = nombre (o letra) del tipo desde organization_shift_types
    const headers = ['id', 'shift_type', 'type_letter', 'status', 'start_at', 'end_at', 'assigned_user_id'];
    const typeRow = (r: Record<string, unknown>) => {
      const ost = (r.organization_shift_types as { name?: string; letter?: string } | null) ?? {};
      return [ost.name ?? '', ost.letter ?? ''];
    };
    const lines = [
      headers.join(','),
      ...(rows || []).map((r: Record<string, unknown>) => {
        const [typeName, typeLetter] = typeRow(r);
        return [r.id, typeName, typeLetter, r.status, r.start_at, r.end_at, r.assigned_user_id ?? ''].join(',');
      }),
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
