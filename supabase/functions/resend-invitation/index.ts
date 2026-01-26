// Edge Function: reenviar invitación (nuevo token, nueva expiración, opcional email)
// Requiere: org_admin o superadmin. body: { invitation_id }
// @see project-roadmap.md 9.2

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getAuthUser, checkCanManageOrg, checkRateLimit, logFailedAttempt } from '../_shared/auth.ts';

function generateToken(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const FN = 'resend-invitation';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

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
        JSON.stringify({ error: auth.error === 'no_bearer' ? 'Authorization Bearer required' : 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    const body = (await req.json()) as { invitation_id?: string };
    const { invitation_id } = body;
    if (!invitation_id) {
      return new Response(
        JSON.stringify({ error: 'invitation_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: inv, error: invErr } = await supabase
      .from('organization_invitations')
      .select('id, org_id, email, role, status, metadata, invited_by')
      .eq('id', invitation_id)
      .single();

    if (invErr || !inv) {
      return new Response(
        JSON.stringify({ error: 'Invitation not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (inv.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: `Cannot resend: invitation is ${inv.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const canManage = await checkCanManageOrg(supabase, user.id, inv.org_id);
    if (!canManage) {
      await logFailedAttempt(supabase, {
        functionName: FN,
        userId: user.id,
        orgId: inv.org_id,
        reason: 'You must be org_admin or superadmin to resend',
        status: 403,
      });
      return new Response(
        JSON.stringify({ error: 'You must be org_admin or superadmin to resend' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const { error: upErr } = await supabase
      .from('organization_invitations')
      .update({ token, expires_at: expiresAt.toISOString() })
      .eq('id', inv.id);

    if (upErr) {
      return new Response(
        JSON.stringify({ error: upErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:3000';
    const inviteLink = `${appUrl.replace(/\/$/, '')}/invite?token=${encodeURIComponent(token)}`;

    let emailSent = false;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const custom_message = (inv.metadata as { message?: string } | null)?.message;
    if (resendKey) {
      const roleLabels: Record<string, string> = {
        org_admin: 'Administrador de organización',
        team_manager: 'Gestor de equipo',
        user: 'Usuario',
        viewer: 'Solo lectura',
      };
      const [{ data: org }, { data: inviter }] = await Promise.all([
        supabase.from('organizations').select('name').eq('id', inv.org_id).single(),
        supabase.from('profiles').select('full_name').eq('id', inv.invited_by).single(),
      ]);
      const orgName = org?.name ?? 'la organización';
      const inviterName = inviter?.full_name?.trim() || 'Un administrador';
      const roleLabel = roleLabels[inv.role] ?? inv.role;
      const expiryDate = expiresAt.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:system-ui,sans-serif;line-height:1.5;max-width:480px;margin:0 auto;padding:24px;"><h2>Recordatorio: invitación a ${orgName}</h2><p><strong>${inviterName}</strong> te ha invitado a <strong>${orgName}</strong> como <strong>${roleLabel}</strong>. Este enlace ha sido renovado y expira el ${expiryDate}.</p>${custom_message ? `<p style="background:#f5f5f5;padding:12px;border-radius:8px;">"${String(custom_message).replace(/"/g, '&quot;')}"</p>` : ''}<p><a href="${inviteLink}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:500;">Aceptar invitación</a></p><p style="color:#666;font-size:0.875rem;">Enlace: <a href="${inviteLink}">${inviteLink}</a></p></body></html>`;
      const fromAddress = Deno.env.get('RESEND_FROM') || 'Turnia <onboarding@resend.dev>';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: fromAddress,
          to: [inv.email],
          subject: `Recordatorio: invitación a ${orgName} – Turnia`,
          html,
        }),
      });
      const resJson = (await res.json()) as { id?: string };
      emailSent = res.ok && !!resJson?.id;
    }

    return new Response(
      JSON.stringify({ ok: true, invite_link: inviteLink, expires_at: expiresAt.toISOString(), email_sent: emailSent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
