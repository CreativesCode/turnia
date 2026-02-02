// Edge Function: exportar horarios a CSV o Excel
// Requiere: team_manager, org_admin o superadmin.
// @see project-roadmap.md Módulo 7.1, 9.2

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';
import { checkCanManageShifts, checkRateLimit, getAuthUser, logFailedAttempt } from '../_shared/auth.ts';
import { corsHeaders } from '../_shared/cors.ts';

type ShiftRow = {
  status: string;
  start_at: string;
  end_at: string;
  location: string | null;
  shift_type_name: string | null;
  shift_type_letter: string | null;
  assigned_user_id: string | null;
  assigned_full_name: string | null;
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
const PAGE_SIZE = 2000;
const XLSX_MAX_ROWS = 10_000;

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

    // Validación básica de fechas (ISO expected)
    const startMs = Date.parse(start);
    const endMs = Date.parse(end);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      return new Response(JSON.stringify({ error: 'Invalid start/end timestamps' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (startMs > endMs) {
      return new Response(JSON.stringify({ error: 'start must be <= end' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // Límite de rango para evitar exportes masivos accidentales (1 año)
    const maxRangeMs = 1000 * 60 * 60 * 24 * 366;
    if (endMs - startMs > maxRangeMs) {
      return new Response(JSON.stringify({ error: 'Rango demasiado grande (máx 12 meses). Acota el período.' }), {
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

    const headers = ['Fecha', 'Hora inicio', 'Hora fin', 'Tipo', 'Letra', 'Estado', 'Asignado', 'Ubicación'];
    const toCells = (r: ShiftRow) => {
      const typeName = r.shift_type_name ?? '';
      const typeLetter = r.shift_type_letter ?? '';
      const s = r.start_at ?? '';
      const e = r.end_at ?? '';
      const startDate = s.slice(0, 10);
      const startTime = s.slice(11, 16);
      const endTime = e.slice(11, 16);
      const assigned =
        r.assigned_user_id
          ? (r.assigned_full_name?.trim() || r.assigned_user_id.slice(0, 8))
          : '';
      return [startDate, startTime, endTime, typeName, typeLetter, r.status ?? '', assigned, r.location ?? ''];
    };

    const baseFile = `horarios_${start.slice(0, 10)}_${end.slice(0, 10)}`;

    if (format === 'csv') {
      const enc = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          // BOM + header
          controller.enqueue(enc.encode('\uFEFF' + headers.map(escapeCsvCell).join(',') + '\r\n'));
          let from = 0;
          while (true) {
            const to = from + PAGE_SIZE - 1;
            const { data, error } = await supabase
              .rpc('export_schedule_rows', { p_org_id: orgId, p_from: start, p_to: end })
              .range(from, to);
            if (error) throw new Error(error.message);
            const batch = ((data ?? []) as unknown) as ShiftRow[];
            if (batch.length === 0) break;
            // chunked write
            let chunk = '';
            for (const r of batch) {
              chunk += toCells(r).map(escapeCsvCell).join(',') + '\r\n';
            }
            controller.enqueue(enc.encode(chunk));
            if (batch.length < PAGE_SIZE) break;
            from += PAGE_SIZE;
          }
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename=${baseFile}.csv`,
        },
      });
    }

    // Excel
    // XLSX requiere materializar todo en memoria; ponemos un límite razonable.
    const wsData: (string | number)[][] = [headers];
    let from = 0;
    while (true) {
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .rpc('export_schedule_rows', { p_org_id: orgId, p_from: start, p_to: end })
        .range(from, to);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const batch = ((data ?? []) as unknown) as ShiftRow[];
      if (batch.length === 0) break;
      for (const r of batch) {
        wsData.push(toCells(r));
        if (wsData.length - 1 > XLSX_MAX_ROWS) {
          return new Response(JSON.stringify({ error: 'Demasiados turnos para Excel. Usa CSV o acota el rango.' }), {
            status: 413,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      if (batch.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const wb = XLSX.utils.book_new();
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
        'Content-Disposition': `attachment; filename=${baseFile}.xlsx`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
