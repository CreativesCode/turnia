// Edge Function: invitar usuario a una organización con rol
// Requiere: org_admin o superadmin en la org. Crea invitación, token y devuelve link.
// @see project-roadmap.md Módulo 1

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

function generateToken(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req) => {
  console.log('[invite-user] Request received:', req.method);

  if (req.method === 'OPTIONS') {
    console.log('[invite-user] Responding to OPTIONS preflight');
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    console.log('[invite-user] Processing request...');

    const authHeader = req.headers.get('Authorization');
    console.log('[invite-user] Auth header present:', !!authHeader);

    if (!authHeader?.startsWith('Bearer ')) {
      console.log('[invite-user] ERROR: No Bearer token');
      return new Response(
        JSON.stringify({ error: 'Authorization Bearer required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Crear cliente con el token del usuario para validar la sesión
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    console.log('[invite-user] SUPABASE_URL present:', !!supabaseUrl);
    console.log('[invite-user] SUPABASE_ANON_KEY present:', !!supabaseAnonKey);

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    console.log('[invite-user] Getting user...');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    console.log('[invite-user] User found:', !!user, 'Error:', userError?.message);

    if (userError || !user) {
      console.log('[invite-user] ERROR: Invalid or expired token');
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Crear cliente con SERVICE_ROLE_KEY para operaciones administrativas
    // Nota: SERVICE_ROLE_KEY sin prefijo porque Supabase no permite secretos que empiecen con SUPABASE_
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    console.log('[invite-user] SERVICE_ROLE_KEY present:', !!serviceRoleKey);

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log('[invite-user] Parsing body...');
    const body = (await req.json()) as {
      org_id: string;
      email?: string;
      role?: string;
      team_id?: string | null;
      custom_message?: string;
    };
    const { org_id, email, role, team_id = null, custom_message } = body;
    console.log('[invite-user] Body parsed:', { org_id, email, role, team_id });

    if (!org_id || !email || !role) {
      console.log('[invite-user] ERROR: Missing required fields');
      return new Response(
        JSON.stringify({ error: 'org_id, email and role are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const allowedRoles = ['org_admin', 'team_manager', 'user', 'viewer'];
    if (!allowedRoles.includes(role)) {
      console.log('[invite-user] ERROR: Invalid role:', role);
      return new Response(
        JSON.stringify({ error: `role must be one of: ${allowedRoles.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar permisos: org_admin/superadmin en esta org, o superadmin en cualquier org
    const { data: membershipInOrg } = await supabase
      .from('memberships')
      .select('id')
      .eq('org_id', org_id)
      .eq('user_id', user.id)
      .in('role', ['org_admin', 'superadmin'])
      .maybeSingle();

    const isAdminOfThisOrg = !!membershipInOrg;

    let isSuperadmin = false;
    if (!isAdminOfThisOrg) {
      const { data: anySuperadmin } = await supabase
        .from('memberships')
        .select('id')
        .eq('user_id', user.id)
        .eq('role', 'superadmin')
        .limit(1)
        .maybeSingle();
      isSuperadmin = !!anySuperadmin;
    }

    if (!isAdminOfThisOrg && !isSuperadmin) {
      return new Response(
        JSON.stringify({ error: 'You must be org_admin or superadmin of this organization to invite' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    console.log('[invite-user] Inserting invitation...');
    const { data: inv, error: insertErr } = await supabase
      .from('organization_invitations')
      .insert({
        org_id,
        team_id: team_id || null,
        email: email.trim().toLowerCase(),
        role,
        token,
        invited_by: user.id,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
        metadata: custom_message ? { message: custom_message } : {},
      })
      .select('id')
      .single();

    console.log('[invite-user] Insert result:', { success: !!inv, error: insertErr?.message });

    if (insertErr) {
      console.log('[invite-user] ERROR inserting invitation:', insertErr.message);
      return new Response(
        JSON.stringify({ error: insertErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:3000';
    const inviteLink = `${appUrl.replace(/\/$/, '')}/invite?token=${encodeURIComponent(token)}`;

    // Enviar email con Resend si está configurado
    const resendKey = Deno.env.get('RESEND_API_KEY');
    let emailSent = false;
    if (resendKey) {
      const roleLabels: Record<string, string> = {
        org_admin: 'Administrador de organización',
        team_manager: 'Gestor de equipo',
        user: 'Usuario',
        viewer: 'Solo lectura',
      };
      const roleLabel = roleLabels[role] ?? role;
      const [{ data: org }, { data: inviter }] = await Promise.all([
        supabase.from('organizations').select('name').eq('id', org_id).single(),
        supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      ]);
      const orgName = org?.name ?? 'la organización';
      const inviterName = inviter?.full_name?.trim() || 'Un administrador';
      const expiryDate = new Date(expiresAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a;">
  <h2 style="margin:0 0 16px;font-size:1.25rem;">Invitación a ${orgName}</h2>
  <p><strong>${inviterName}</strong> te ha invitado a unirte a <strong>${orgName}</strong> con el rol de <strong>${roleLabel}</strong>.</p>
  ${custom_message ? `<p style="background:#f5f5f5;padding:12px;border-radius:8px;margin:16px 0;">"${custom_message.replace(/"/g, '&quot;')}"</p>` : ''}
  <p><a href="${inviteLink}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:500;margin:8px 0;">Aceptar invitación</a></p>
  <p style="color:#666;font-size:0.875rem;">Este enlace expira el ${expiryDate}. Si no esperabas esta invitación, puedes ignorar este correo.</p>
  <p style="color:#999;font-size:0.75rem;margin-top:24px;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br><a href="${inviteLink}" style="color:#2563eb;word-break:break-all;">${inviteLink}</a></p>
</body>
</html>`;

      const fromAddress = Deno.env.get('RESEND_FROM') || 'Turnia <onboarding@resend.dev>';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [email.trim().toLowerCase()],
          subject: `Invitación a ${orgName} – Turnia`,
          html,
        }),
      });
      const resJson = (await res.json()) as { id?: string; message?: string };
      if (res.ok && resJson?.id) {
        emailSent = true;
        console.log('[invite-user] Email sent via Resend, id:', resJson.id);
      } else {
        console.log('[invite-user] Resend error:', res.status, resJson?.message ?? resJson);
      }
    } else {
      console.log('[invite-user] RESEND_API_KEY not set, skipping email');
    }

    console.log('[invite-user] SUCCESS: Invitation created, id:', inv.id);

    return new Response(
      JSON.stringify({
        ok: true,
        invitation_id: inv.id,
        invite_link: inviteLink,
        expires_at: expiresAt.toISOString(),
        email_sent: emailSent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.log('[invite-user] CATCH ERROR:', String(e));
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
