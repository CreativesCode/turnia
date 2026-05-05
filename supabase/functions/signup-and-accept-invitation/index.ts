// Edge Function: registro + aceptar invitación en un solo paso
// Pública (sin auth previa). Crea usuario con email_confirm=true para
// saltar el correo de confirmación de Supabase Auth (la invitación ya
// validó el email al ser enviada al token destinatario).
// Body: { token, password, full_name }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = (await req.json()) as {
      token?: string;
      password?: string;
      full_name?: string;
    };
    const token = body.token?.trim();
    const password = body.password ?? '';
    const fullName = body.full_name?.trim() ?? '';

    if (!token || !password || !fullName) {
      return new Response(
        JSON.stringify({ error: 'token, password and full_name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: inv, error: invErr } = await supabase
      .from('organization_invitations')
      .select('id, org_id, email, role, status, expires_at, invited_by')
      .eq('token', token)
      .single();

    if (invErr || !inv) {
      return new Response(
        JSON.stringify({ error: 'Invitation not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (inv.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: `Invitation is ${inv.status}` }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (new Date(inv.expires_at) < new Date()) {
      await supabase.from('organization_invitations').update({ status: 'expired' }).eq('id', inv.id);
      return new Response(
        JSON.stringify({ error: 'Invitation has expired' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const invEmail = inv.email.trim().toLowerCase();

    // Crear usuario ya confirmado. El trigger on_auth_user_created creará el profile.
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: invEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createErr || !created?.user) {
      const msg = createErr?.message ?? 'Could not create user';
      // Detectar usuario existente para devolver un código manejable en cliente
      const lower = msg.toLowerCase();
      if (lower.includes('already') || lower.includes('exists') || lower.includes('duplicate')) {
        return new Response(
          JSON.stringify({ error: 'user_exists', message: `Ya existe una cuenta con ${inv.email}. Inicia sesión para aceptar la invitación.` }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: msg }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = created.user.id;
    const now = new Date().toISOString();

    const { error: insertErr } = await supabase.from('memberships').insert({
      org_id: inv.org_id,
      user_id: userId,
      role: inv.role,
    });
    if (insertErr) {
      // Rollback del usuario para no dejar huérfanos
      await supabase.auth.admin.deleteUser(userId).catch(() => {});
      return new Response(
        JSON.stringify({ error: insertErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase
      .from('organization_invitations')
      .update({ status: 'accepted', accepted_at: now })
      .eq('id', inv.id);

    await supabase.from('audit_log').insert({
      org_id: inv.org_id,
      actor_id: userId,
      entity: 'organization_invitation',
      entity_id: inv.id,
      action: 'accept',
      after_snapshot: { role: inv.role, signup: true },
      comment: `Invitation accepted (signup) by ${invEmail}`,
    });

    // Notificar al inviter por email (mismo patrón que accept-invitation)
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (resendKey && inv.invited_by) {
      const roleLabels: Record<string, string> = {
        org_admin: 'Administrador de organización',
        team_manager: 'Gestor de equipo',
        user: 'Usuario',
        viewer: 'Solo lectura',
      };
      const [{ data: org }, { data: inviter }] = await Promise.all([
        supabase.from('organizations').select('name').eq('id', inv.org_id).single(),
        supabase.auth.admin.getUserById(inv.invited_by),
      ]);
      const inviterEmail = inviter?.user?.email;
      const orgName = org?.name ?? 'la organización';
      const roleLabel = roleLabels[inv.role] ?? inv.role;
      if (inviterEmail) {
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:system-ui,sans-serif;line-height:1.5;max-width:480px;margin:0 auto;padding:24px;"><h2 style="margin:0 0 16px;">Invitación aceptada</h2><p><strong>${fullName}</strong> (${invEmail}) ha aceptado tu invitación a unirse a <strong>${orgName}</strong> con el rol de <strong>${roleLabel}</strong>.</p><p style="color:#666;font-size:0.875rem;">— Turnia</p></body></html>`;
        const fromAddress = Deno.env.get('RESEND_FROM') || 'Turnia <onboarding@resend.dev>';
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: fromAddress,
            to: [inviterEmail],
            subject: `Invitación aceptada: ${fullName} se unió a ${orgName}`,
            html,
          }),
        }).catch(() => {});
      }
    }

    return new Response(
      JSON.stringify({ ok: true, org_id: inv.org_id, user_id: userId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
