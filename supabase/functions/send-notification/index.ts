// Edge Function: enviar notificación push/email
// Invocada desde approve-request, respond-to-swap o en eventos (asignación, publicación).
// Push: lee push_tokens del usuario e intenta enviar vía FCM (Android). APNs (iOS) requiere config adicional.
// @see project-roadmap.md Módulo 5.1, indications.md §5.7

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type FirebaseAccount = { client_email: string; private_key: string; project_id?: string };

async function getFcmAccessToken(account: FirebaseAccount): Promise<string | null> {
  try {
    const { SignJWT, importPKCS8 } = await import('https://esm.sh/jose@5.2.0');
    const key = account.private_key.replace(/\\n/g, '\n');
    const pk = await importPKCS8(key, 'RS256');
    const iat = Math.floor(Date.now() / 1000);
    const jwt = await new SignJWT({})
      .setIssuer(account.client_email)
      .setSubject(account.client_email)
      .setAudience('https://oauth2.googleapis.com/token')
      .setIssuedAt(iat)
      .setExpirationTime(iat + 3600)
      .sign(pk);

    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });
    if (!r.ok) return null;
    const json = (await r.json()) as { access_token?: string };
    return json.access_token ?? null;
  } catch {
    return null;
  }
}

async function sendFcm(accessToken: string, projectId: string, fcmToken: string, title: string, body: string): Promise<boolean> {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token: fcmToken,
        notification: { title, body },
        data: {},
      },
    }),
  });
  return res.ok;
}

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

    const bodyStr = bodyText ?? '';

    // ——— Push: push_tokens + FCM (Android) ———
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('platform, token')
      .eq('user_id', userId);

    let pushOk = 0;
    const firebaseJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
    let fcmAccess: string | null = null;
    let fcmProject: string | null = null;
    if (firebaseJson) {
      try {
        const acc = JSON.parse(firebaseJson) as FirebaseAccount;
        fcmProject = acc.project_id ?? Deno.env.get('FCM_PROJECT_ID') ?? null;
        fcmAccess = await getFcmAccessToken(acc);
      } catch {
        // FIREBASE_SERVICE_ACCOUNT_JSON inválido
      }
    }

    if (tokens?.length) {
      for (const row of tokens as { platform: string; token: string }[]) {
        if (row.platform === 'android' && fcmAccess && fcmProject) {
          const ok = await sendFcm(fcmAccess, fcmProject, row.token, title, bodyStr);
          if (ok) pushOk += 1;
        }
        // iOS (APNs): requiere key/cert y otra integración. Ver docs.
      }
    }

    // ——— Email (fallback): TODO integrar Resend/SendGrid cuando email=true ———
    if (email) {
      // TODO: enviar correo; registrar intento
    }

    return new Response(
      JSON.stringify({ ok: true, message: 'Notification queued', pushSent: pushOk }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
