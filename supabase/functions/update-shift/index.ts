// Edge Function: actualizar turno
// Requiere: team_manager, org_admin o superadmin en la org del turno.
// @see project-roadmap.md Módulo 3.2, 9.2

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getAuthUser, checkCanManageShifts, checkRateLimit, logFailedAttempt } from '../_shared/auth.ts';

const FN = 'update-shift';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
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
      .select('id, org_id, start_at, end_at, assigned_user_id, status, shift_type_id')
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
    const canManage = await checkCanManageShifts(supabase, user.id, org_id);
    if (!canManage) {
      await logFailedAttempt(supabase, {
        functionName: FN,
        userId: user.id,
        orgId: org_id,
        reason: 'No tienes permiso para editar este turno',
        status: 403,
      });
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

    // Validar conflictos si hay usuario asignado (el nuevo o el actual); min_rest_hours desde org_settings
    const newAssigned =
      assigned_user_id !== undefined ? assigned_user_id || null : shift.assigned_user_id;
    if (newAssigned) {
      const newStart = (updates.start_at as string) ?? shift.start_at;
      const newEnd = (updates.end_at as string) ?? shift.end_at;
      const { data: os } = await supabase.from('org_settings').select('min_rest_hours').eq('org_id', org_id).maybeSingle();
      const minRest = (os as { min_rest_hours?: number } | null)?.min_rest_hours ?? 0;
      const { data: rpc, error: rpcErr } = await supabase.rpc('check_shift_conflicts', {
        p_user_id: newAssigned,
        p_start_at: newStart,
        p_end_at: newEnd,
        p_exclude_shift_id: id,
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

    // Notificaciones: Shift assigned / changed / unassigned / Schedule published (Módulo 5.2)
    const oldAssigned = shift.assigned_user_id;
    const newAssigned =
      assigned_user_id !== undefined ? assigned_user_id || null : shift.assigned_user_id;
    const finalStart = (updates.start_at as string) ?? shift.start_at;
    const finalTypeId = (updates.shift_type_id as string) ?? shift.shift_type_id;
    const oldStatus = shift.status;
    const newStatus = (updates.status as string) ?? shift.status;

    let typeName = 'Turno';
    if (finalTypeId) {
      const { data: stRow } = await supabase
        .from('organization_shift_types')
        .select('name')
        .eq('id', finalTypeId)
        .single();
      typeName = (stRow as { name?: string } | null)?.name ?? 'Turno';
    }
    const dateStr = new Date(finalStart).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    if (assigned_user_id !== undefined) {
      if (newAssigned && newAssigned !== oldAssigned) {
        await supabase.from('notifications').insert({
          user_id: newAssigned,
          title: 'Turno asignado',
          message: `Te han asignado un turno: ${dateStr}, ${typeName}.`,
          type: 'shift',
          entity_type: 'shift',
          entity_id: id,
        });
      }
      if (oldAssigned && newAssigned !== oldAssigned) {
        await supabase.from('notifications').insert({
          user_id: oldAssigned,
          title: 'Turno desasignado',
          message: `Te han quitado el turno del ${dateStr}.`,
          type: 'shift',
          entity_type: 'shift',
          entity_id: id,
        });
      }
    } else if (newAssigned && Object.keys(updates).length > 0) {
      if (oldStatus !== 'published' && newStatus === 'published') {
        await supabase.from('notifications').insert({
          user_id: newAssigned,
          title: 'Turno publicado',
          message: `Tu turno del ${dateStr} ha sido publicado.`,
          type: 'shift',
          entity_type: 'shift',
          entity_id: id,
        });
      } else if (
        updates.start_at != null ||
        updates.end_at != null ||
        updates.shift_type_id != null ||
        updates.location !== undefined
      ) {
        await supabase.from('notifications').insert({
          user_id: newAssigned,
          title: 'Turno modificado',
          message: `Tu turno del ${dateStr} ha sido modificado.`,
          type: 'shift',
          entity_type: 'shift',
          entity_id: id,
        });
      }
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
