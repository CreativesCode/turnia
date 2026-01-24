// Edge Function: enviar recordatorios por email a invitaciones próximas a expirar
// Pensada para ser llamada por un cron (p. ej. 1x/día). Opcional: header X-Cron-Secret = CRON_SECRET.
// Busca pending con expires_at en las próximas 24–48 h y envía recordatorio vía Resend.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const cronSecret = Deno.env.get('CRON_SECRET');
    if (cronSecret && req.headers.get('X-Cron-Secret') !== cronSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      return new Response(
        JSON.stringify({ ok: true, message: 'RESEND_API_KEY not set, nothing to do' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await supabase
      .from('organization_invitations')
      .select('id, org_id, team_id, email, role, token, expires_at, metadata, invited_by')
      .eq('status', 'pending')
      .gt('expires_at', now.toISOString())
      .lte('expires_at', in48h);

    if (error || !rows?.length) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, message: rows?.length === 0 ? 'No invitations to remind' : error?.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const appUrl = (Deno.env.get('APP_URL') || 'http://localhost:3000').replace(/\/$/, '');
    const fromAddress = Deno.env.get('RESEND_FROM') || 'Turnia <onboarding@resend.dev>';
    const roleLabels: Record<string, string> = {
      org_admin: 'Administrador de organización',
      team_manager: 'Gestor de equipo',
      user: 'Usuario',
      viewer: 'Solo lectura',
    };

    let sent = 0;
    for (const inv of rows) {
      const inviteLink = `${appUrl}/invite?token=${encodeURIComponent(inv.token)}`;
      const [{ data: org }, { data: inviter }] = await Promise.all([
        supabase.from('organizations').select('name').eq('id', inv.org_id).single(),
        supabase.from('profiles').select('full_name').eq('id', inv.invited_by).single(),
      ]);
      const orgName = org?.name ?? 'la organización';
      const inviterName = inviter?.full_name?.trim() || 'Un administrador';
      const roleLabel = roleLabels[inv.role] ?? inv.role;
      const expiryDate = new Date(inv.expires_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
      const custom_message = (inv.metadata as { message?: string } | null)?.message;

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:system-ui,sans-serif;line-height:1.5;max-width:480px;margin:0 auto;padding:24px;"><h2>Tu invitación a ${orgName} expira pronto</h2><p><strong>${inviterName}</strong> te invitó a <strong>${orgName}</strong> como <strong>${roleLabel}</strong>. La invitación expira el <strong>${expiryDate}</strong>.</p>${custom_message ? `<p style="background:#f5f5f5;padding:12px;border-radius:8px;">"${String(custom_message).replace(/"/g, '&quot;')}"</p>` : ''}<p><a href="${inviteLink}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:500;">Aceptar invitación</a></p><p style="color:#666;font-size:0.875rem;">Enlace: <a href="${inviteLink}">${inviteLink}</a></p></body></html>`;

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: fromAddress,
          to: [inv.email],
          subject: `Recordatorio: tu invitación a ${orgName} expira el ${expiryDate}`,
          html,
        }),
      });
      const resJson = (await res.json()) as { id?: string };
      if (res.ok && resJson?.id) sent++;
    }

    return new Response(
      JSON.stringify({ ok: true, sent, total: rows.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
