// Edge Function: User B (target_user_id) acepta o rechaza una solicitud de swap.
// Solo aplica a request_type=swap, status=submitted. Aceptar → accepted; Rechazar → cancelled.
// @see project-roadmap.md Módulo 4.4

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

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

    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceKey);

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
      .select('id, org_id, request_type, status, target_user_id, requester_id')
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
      return new Response(
        JSON.stringify({ error: 'Solo el usuario con quien se propone intercambiar puede aceptar o rechazar' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newStatus = response === 'accept' ? 'accepted' : 'cancelled';

    const { error: updateErr } = await supabase
      .from('shift_requests')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', requestId);

    if (updateErr) {
      return new Response(
        JSON.stringify({ error: updateErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase.from('audit_log').insert({
      org_id: sr.org_id,
      actor_id: user.id,
      entity: 'shift_request',
      entity_id: requestId,
      action: response === 'accept' ? 'swap_accepted_by_target' : 'swap_declined_by_target',
      after_snapshot: { status: newStatus },
      comment: response === 'decline' ? 'Rechazado por la contraparte' : null,
    });

    // Notificar al solicitante (User A): in-app y push
    const requesterId = (sr as { requester_id?: string }).requester_id;
    if (requesterId) {
      const title = response === 'accept' ? 'Intercambio aceptado' : 'Intercambio rechazado';
      const message = response === 'accept'
        ? 'La contraparte ha aceptado tu solicitud de intercambio. Espera la aprobación del responsable.'
        : 'La contraparte ha rechazado tu solicitud de intercambio.';
      await supabase.from('notifications').insert({
        user_id: requesterId,
        title,
        message,
        type: 'request',
        entity_type: 'shift_request',
        entity_id: requestId,
      });
      // Push: invocar send-notification (best-effort)
      const baseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      if (baseUrl) {
        try {
          await fetch(`${baseUrl}/functions/v1/send-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: requesterId,
              type: 'request',
              title,
              body: message,
              email: false,
            }),
          });
        } catch (_) {
          /* ignore; in-app ya enviada */
        }
      }
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
