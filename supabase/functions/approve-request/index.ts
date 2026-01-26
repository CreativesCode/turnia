// Edge Function: aprobar/rechazar solicitudes de turnos.
// Aplica cambios en shifts cuando action=approve según request_type:
// - give_away: deja el turno sin asignar.
// - swap: intercambia assigned_user_id entre shift y target_shift.
// - take_open: asigna el turno al requester.
// @see project-roadmap.md Módulo 4.3, 9.2

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getAuthUser, checkCanApproveRequests, checkRateLimit, logFailedAttempt } from '../_shared/auth.ts';

type ShiftRow = { id: string; assigned_user_id: string | null };

type RequestRow = {
  id: string;
  org_id: string;
  request_type: 'give_away' | 'swap' | 'take_open';
  status: string;
  shift_id: string | null;
  target_shift_id: string | null;
  target_user_id: string | null;
  requester_id: string;
  comment: string | null;
  shift?: ShiftRow | null;
  target_shift?: ShiftRow | null;
};

const FN = 'approve-request';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

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

    const { requestId, action, comment } = (await req.json()) as {
      requestId: string;
      action: 'approve' | 'reject';
      comment?: string;
    };

    if (!requestId || !action) {
      return new Response(
        JSON.stringify({ error: 'requestId and action are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: sr, error: fetchErr } = await supabase
      .from('shift_requests')
      .select(`
        id, org_id, request_type, status, shift_id, target_shift_id, target_user_id, requester_id, comment
      `)
      .eq('id', requestId)
      .single();

    if (fetchErr || !sr) {
      return new Response(
        JSON.stringify({ error: 'Request not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const row = sr as RequestRow;

    // Solo se puede aprobar/rechazar si está submitted o accepted
    if (!['submitted', 'accepted'].includes(row.status)) {
      return new Response(
        JSON.stringify({ error: 'Solo se pueden aprobar o rechazar solicitudes en estado enviada o aceptada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Permisos: team_manager, org_admin o superadmin en la org de la solicitud
    const canApprove = await checkCanApproveRequests(supabase, user.id, row.org_id);
    if (!canApprove) {
      await logFailedAttempt(supabase, {
        functionName: FN,
        userId: user.id,
        orgId: row.org_id,
        reason: 'No tienes permiso para aprobar o rechazar solicitudes en esta organización',
        status: 403,
      });
      return new Response(
        JSON.stringify({ error: 'No tienes permiso para aprobar o rechazar solicitudes en esta organización' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    if (action === 'approve' && row.shift_id) {
      if (row.request_type === 'give_away') {
        await supabase
          .from('shifts')
          .update({ assigned_user_id: null, updated_at: new Date().toISOString() })
          .eq('id', row.shift_id);
      } else if (row.request_type === 'take_open') {
        await supabase
          .from('shifts')
          .update({ assigned_user_id: row.requester_id, updated_at: new Date().toISOString() })
          .eq('id', row.shift_id);
      } else if (row.request_type === 'swap' && row.target_shift_id && row.target_user_id) {
        const { data: shiftRow } = await supabase
          .from('shifts')
          .select('id, assigned_user_id')
          .eq('id', row.shift_id)
          .single();
        const { data: targetRow } = await supabase
          .from('shifts')
          .select('id, assigned_user_id')
          .eq('id', row.target_shift_id)
          .single();
        const userA = (shiftRow as { assigned_user_id: string | null } | null)?.assigned_user_id ?? row.requester_id;
        const userB = (targetRow as { assigned_user_id: string | null } | null)?.assigned_user_id ?? row.target_user_id;
        await supabase.from('shifts').update({ assigned_user_id: userB, updated_at: new Date().toISOString() }).eq('id', row.shift_id);
        await supabase.from('shifts').update({ assigned_user_id: userA, updated_at: new Date().toISOString() }).eq('id', row.target_shift_id);
      }
    }

    const updatePayload: { status: string; approver_id: string; updated_at: string } = {
      status: newStatus,
      approver_id: user.id,
      updated_at: new Date().toISOString(),
    };
    // No sobrescribir comment del requester; el comentario del manager va a audit_log

    const { error: updateErr } = await supabase
      .from('shift_requests')
      .update(updatePayload)
      .eq('id', requestId);

    if (updateErr) {
      return new Response(
        JSON.stringify({ error: updateErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase.from('audit_log').insert({
      org_id: row.org_id,
      actor_id: user.id,
      entity: 'shift_request',
      entity_id: requestId,
      action: `request_${newStatus}`,
      after_snapshot: { status: newStatus, manager_comment: comment || null },
      comment: comment || null,
    });

    // Notificaciones: requester siempre; en swap también target_user_id
    const toNotify: { user_id: string; title: string; message: string }[] = [];
    if (action === 'approve') {
      toNotify.push({ user_id: row.requester_id, title: 'Solicitud aprobada', message: 'Tu solicitud ha sido aprobada.' });
      if (row.request_type === 'swap' && row.target_user_id) {
        toNotify.push({
          user_id: row.target_user_id,
          title: 'Intercambio aprobado',
          message: 'El intercambio de turnos ha sido aprobado.',
        });
      }
    } else {
      toNotify.push({ user_id: row.requester_id, title: 'Solicitud rechazada', message: 'Tu solicitud ha sido rechazada.' });
      if (row.request_type === 'swap' && row.target_user_id) {
        toNotify.push({
          user_id: row.target_user_id,
          title: 'Intercambio rechazado',
          message: 'El intercambio de turnos ha sido rechazado.',
        });
      }
    }
    for (const n of toNotify) {
      await supabase.from('notifications').insert({
        user_id: n.user_id,
        title: n.title,
        message: n.message,
        type: 'request',
        entity_type: 'shift_request',
        entity_id: requestId,
      });
    }

    // Push: invocar send-notification (best-effort; no fallar si FCM/APNs falla)
    const baseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    if (baseUrl) {
      await Promise.allSettled(
        toNotify.map((n) =>
          fetch(`${baseUrl}/functions/v1/send-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: n.user_id,
              type: 'request',
              title: n.title,
              body: n.message,
              email: false,
            }),
          })
        )
      );
    }

    return new Response(
      JSON.stringify({ ok: true, status: newStatus }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
