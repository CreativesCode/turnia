// Edge Function: enviar notificación push/email
// Invocada desde approve-request o en eventos (solicitud, asignación, publicación)
// @see indications.md §5.7

import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = (await req.json()) as {
      userId: string;
      type: string;
      title: string;
      body?: string;
      email?: boolean;
    };

    const { userId, type, title, body: bodyText, email } = body;

    if (!userId || !type || !title) {
      return new Response(
        JSON.stringify({ error: 'userId, type, title required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // TODO: integrar FCM (Android) / APNs (iOS) para push
    // TODO: integrar Resend/SendGrid para email cuando email=true
    console.log('Notification:', { userId, type, title, bodyText, email });

    return new Response(
      JSON.stringify({ ok: true, message: 'Notification queued' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
