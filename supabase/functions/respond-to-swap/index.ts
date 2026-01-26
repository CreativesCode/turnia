// Edge Function: User B (target_user_id) acepta o rechaza una solicitud de swap.
// Solo aplica a request_type=swap, status=submitted. Aceptar → accepted; Rechazar → cancelled.
// @see project-roadmap.md Módulo 4.4, 9.2

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getAuthUser, checkRateLimit, logFailedAttempt } from '../_shared/auth.ts';

const FN = 'respond-to-swap';

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

    const { requestId, response } = (await req.json()) as {
      requestId: string;
      response: 'accept' | 'decline';
    };

    if (!requestId || !response || !['accept', 'decline'].includes(response)) {
      return new Response(
        JSON.stringify({ error: 'requestId and response (accept|decline) are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: sr, error: fetchErr } = await supabase
      .from('shift_requests')
      .select('id, org_id, request_type, status, shift_id, target_shift_id, target_user_id, requester_id')
      .eq('id', requestId)
      .single();

    if (fetchErr || !sr) {
      return new Response(
        JSON.stringify({ error: 'Solicitud no encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (sr.request_type !== 'swap') {
      return new Response(
        JSON.stringify({ error: 'Solo se puede aceptar o rechazar solicitudes de intercambio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (sr.status !== 'submitted') {
      return new Response(
        JSON.stringify({ error: 'Solo puedes responder a solicitudes en estado enviada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (sr.target_user_id !== user.id) {
      await logFailedAttempt(supabase, {
        functionName: FN,
        userId: user.id,
        orgId: sr.org_id,
        reason: 'Solo el usuario con quien se propone intercambiar puede aceptar o rechazar',
        status: 403,
      });
      return new Response(
        JSON.stringify({ error: 'Solo el usuario con quien se propone intercambiar puede aceptar o rechazar' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let newStatus = response === 'accept' ? 'accepted' : 'cancelled';
    let autoApproved = false;

    if (response === 'accept') {
      const { data: os } = await supabase
        .from('org_settings')
        .select('require_approval_for_swaps')
        .eq('org_id', sr.org_id)
        .maybeSingle();
      const requireApproval = (os as { require_approval_for_swaps?: boolean } | null)?.require_approval_for_swaps ?? true;

      if (!requireApproval && sr.shift_id && sr.target_shift_id && sr.target_user_id) {
        const shiftId = sr.shift_id as string;
        const targetShiftId = sr.target_shift_id as string;
        const { data: shiftRow } = await supabase.from('shifts').select('id, assigned_user_id').eq('id', shiftId).single();
        const { data: targetRow } = await supabase.from('shifts').select('id, assigned_user_id').eq('id', targetShiftId).single();
        const userA = (shiftRow as { assigned_user_id: string | null } | null)?.assigned_user_id ?? (sr.requester_id as string);
        const userB = (targetRow as { assigned_user_id: string | null } | null)?.assigned_user_id ?? (sr.target_user_id as string);
        await supabase.from('shifts').update({ assigned_user_id: userB, updated_at: new Date().toISOString() }).eq('id', shiftId);
        await supabase.from('shifts').update({ assigned_user_id: userA, updated_at: new Date().toISOString() }).eq('id', targetShiftId);
        newStatus = 'approved';
        autoApproved = true;
      }
    }

    const updatePayload: { status: string; updated_at: string; approver_id?: null } = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (autoApproved) updatePayload.approver_id = null;

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

    const auditAction = response === 'accept'
      ? (autoApproved ? 'request_approved' : 'swap_accepted_by_target')
      : 'swap_declined_by_target';
    await supabase.from('audit_log').insert({
      org_id: sr.org_id,
      actor_id: user.id,
      entity: 'shift_request',
      entity_id: requestId,
      action: auditAction,
      after_snapshot: { status: newStatus, ...(autoApproved ? { auto: true } : {}) },
      comment: response === 'decline' ? 'Rechazado por la contraparte' : (autoApproved ? 'Aprobación automática al aceptar (configuración de la organización)' : null),
    });

    const requesterId = (sr as { requester_id?: string }).requester_id;
    const targetId = (sr as { target_user_id?: string }).target_user_id;

    let title = response === 'accept' ? 'Intercambio aceptado' : 'Intercambio rechazado';
    let message = response === 'accept'
      ? (autoApproved ? 'El intercambio se ha aplicado. La organización no requiere aprobación del responsable.' : 'La contraparte ha aceptado tu solicitud de intercambio. Espera la aprobación del responsable.')
      : 'La contraparte ha rechazado tu solicitud de intercambio.';

    const toNotify: { user_id: string; title: string; message: string }[] = [];
    if (requesterId) toNotify.push({ user_id: requesterId, title, message });
    if (autoApproved && targetId) {
      toNotify.push({
        user_id: targetId,
        title: 'Intercambio aprobado',
        message: 'El intercambio de turnos se ha aplicado automáticamente.',
      });
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

    const baseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    if (baseUrl) {
      await Promise.allSettled(
        toNotify.map((n) =>
          fetch(`${baseUrl}/functions/v1/send-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: n.user_id, type: 'request', title: n.title, body: n.message, email: false }),
          })
        )
      );
    }

    return new Response(
      JSON.stringify({ ok: true, status: newStatus, autoApproved }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
