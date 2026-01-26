// Edge Function: exportar horarios a CSV o Excel
// Requiere: team_manager, org_admin o superadmin.
// @see project-roadmap.md Módulo 7.1, 9.2

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';
import { corsHeaders } from '../_shared/cors.ts';
import { getAuthUser, checkCanManageShifts, checkRateLimit, logFailedAttempt } from '../_shared/auth.ts';

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

const FN = 'export-schedule';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceKey);

    const auth = await getAuthUser(req);
    if ('error' in auth) {
      await logFailedAttempt(supabase, {
        functionName: FN,
        reason: auth.error === 'no_bearer' ? 'Authorization Bearer required' : 'Invalid or expired token',
        status: 401,
      });
      return new Response(JSON.stringify({ error: auth.error === 'no_bearer' ? 'Authorization Bearer required' : 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const user = auth.user;

    const { allowed } = await checkRateLimit(supabase, user.id, FN);
    if (!allowed) {
      await logFailedAttempt(supabase, { functionName: FN, userId: user.id, reason: 'Rate limit exceeded', status: 429 });
      return new Response(JSON.stringify({ error: 'Demasiadas solicitudes' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
    const canManage = await checkCanManageShifts(supabase, user.id, orgId);
    if (!canManage) {
      await logFailedAttempt(supabase, {
        functionName: FN,
        userId: user.id,
        orgId,
        reason: 'No tienes permiso para exportar en esta organización',
        status: 403,
      });
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
