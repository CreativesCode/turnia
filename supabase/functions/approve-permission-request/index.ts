// Edge Function: aprobar/rechazar solicitudes de permiso.
// Al aprobar: actualiza status y crea availability_events para bloquear el calendario.
// @see project-roadmap.md Módulo 4.3

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getAuthUser, checkCanApproveRequests, checkRateLimit, logFailedAttempt } from '../_shared/auth.ts';

type PermissionRequestRow = {
  id: string;
  org_id: string;
  requester_id: string;
  request_type: string;
  start_at: string;
  end_at: string;
  reason: string | null;
  status: string;
};

const FN = 'approve-permission-request';

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
      return new Response(
        JSON.stringify({
          error: auth.error === 'no_bearer' ? 'Authorization Bearer required' : 'Invalid or expired token',
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const user = auth.user;

    const { allowed } = await checkRateLimit(supabase, user.id, FN);
    if (!allowed) {
      await logFailedAttempt(supabase, {
        functionName: FN,
        userId: user.id,
        reason: 'Rate limit exceeded',
        status: 429,
      });
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

    const { data: pr, error: fetchErr } = await supabase
      .from('permission_requests')
      .select('id, org_id, requester_id, request_type, start_at, end_at, reason, status')
      .eq('id', requestId)
      .single();

    if (fetchErr || !pr) {
      return new Response(
        JSON.stringify({ error: 'Solicitud no encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const row = pr as PermissionRequestRow;

    if (row.status !== 'submitted') {
      return new Response(
        JSON.stringify({ error: 'Solo se pueden aprobar o rechazar solicitudes pendientes' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
        JSON.stringify({
          error: 'No tienes permiso para aprobar o rechazar solicitudes en esta organización',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const { error: updateErr } = await supabase
      .from('permission_requests')
      .update({
        status: newStatus,
        approver_id: user.id,
        comment_approver: comment || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateErr) {
      return new Response(
        JSON.stringify({ error: updateErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'approve') {
      await supabase.from('availability_events').insert({
        org_id: row.org_id,
        user_id: row.requester_id,
        type: row.request_type,
        start_at: row.start_at,
        end_at: row.end_at,
        note: row.reason || `Permiso aprobado: ${row.request_type}`,
      });
    }

    await supabase.from('audit_log').insert({
      org_id: row.org_id,
      actor_id: user.id,
      entity: 'permission_request',
      entity_id: requestId,
      action: `permission_${newStatus}`,
      after_snapshot: { status: newStatus, manager_comment: comment || null },
      comment: comment || null,
    });

    const toNotify =
      action === 'approve'
        ? { user_id: row.requester_id, title: 'Permiso aprobado', message: 'Tu solicitud de permiso ha sido aprobada.' }
        : { user_id: row.requester_id, title: 'Permiso rechazado', message: 'Tu solicitud de permiso ha sido rechazada.' };

    await supabase.from('notifications').insert({
      user_id: toNotify.user_id,
      title: toNotify.title,
      message: toNotify.message,
      type: 'request',
      entity_type: 'permission_request',
      entity_id: requestId,
    });

    const baseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    if (baseUrl) {
      await fetch(`${baseUrl}/functions/v1/send-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: toNotify.user_id,
          type: 'request',
          title: toNotify.title,
          body: toNotify.message,
          email: false,
        }),
      }).catch(() => {});
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
