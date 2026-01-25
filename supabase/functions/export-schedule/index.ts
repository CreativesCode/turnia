// Edge Function: exportar horarios a CSV o Excel
// Requiere: team_manager, org_admin o superadmin.
// @see project-roadmap.md Módulo 7.1

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';
import { corsHeaders } from '../_shared/cors.ts';

type ShiftRow = {
  id: string;
  status: string;
  start_at: string;
  end_at: string;
  assigned_user_id: string | null;
  location: string | null;
  organization_shift_types: { name?: string; letter?: string } | null;
};

function escapeCsvCell(val: string): string {
  if (val === null || val === undefined) return '""';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authorization Bearer required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = (await req.json()) as { orgId: string; start: string; end: string; format?: string };
    const { orgId, start, end } = body;
    const format = (body.format === 'xlsx' ? 'xlsx' : 'csv') as 'csv' | 'xlsx';

    if (!orgId || !start || !end) {
      return new Response(JSON.stringify({ error: 'orgId, start, end required' }), {
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
      return new Response(JSON.stringify({ error: 'No tienes permiso para exportar en esta organización' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: rows, error } = await supabase
      .from('shifts')
      .select('id, status, start_at, end_at, assigned_user_id, location, organization_shift_types(name, letter)')
      .eq('org_id', orgId)
      .gte('start_at', start)
      .lte('end_at', end)
      .order('start_at');

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const shiftRows = (rows ?? []) as ShiftRow[];
    const userIds = [...new Set(shiftRows.map((r) => r.assigned_user_id).filter(Boolean))] as string[];
    let names: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      names = Object.fromEntries(((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? '']));
    }

    const headers = ['Fecha', 'Hora inicio', 'Hora fin', 'Tipo', 'Letra', 'Estado', 'Asignado', 'Ubicación'];
    const toCells = (r: ShiftRow) => {
      const ost = r.organization_shift_types ?? {};
      const typeName = ost.name ?? '';
      const typeLetter = ost.letter ?? '';
      const start = r.start_at ?? '';
      const end = r.end_at ?? '';
      const startDate = start.slice(0, 10);
      const startTime = start.slice(11, 16);
      const endTime = end.slice(11, 16);
      const assigned = r.assigned_user_id ? (names[r.assigned_user_id] || r.assigned_user_id) : '';
      return [startDate, startTime, endTime, typeName, typeLetter, r.status ?? '', assigned, r.location ?? ''];
    };

    if (format === 'csv') {
      const lines = [
        headers.map(escapeCsvCell).join(','),
        ...shiftRows.map((r) => toCells(r).map(escapeCsvCell).join(',')),
      ];
      const csv = '\uFEFF' + lines.join('\r\n'); // BOM para Excel en UTF-8

      return new Response(csv, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename=horarios.csv',
        },
      });
    }

    // Excel
    const wb = XLSX.utils.book_new();
    const wsData = [headers, ...shiftRows.map(toCells)];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 12 },
      { wch: 8 },
      { wch: 8 },
      { wch: 14 },
      { wch: 6 },
      { wch: 10 },
      { wch: 22 },
      { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Horarios');
    const xlsxBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    return new Response(xlsxBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename=horarios.xlsx',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
