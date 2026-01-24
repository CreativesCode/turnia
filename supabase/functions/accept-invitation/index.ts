// Edge Function: aceptar invitación y crear membership
// Requiere: usuario autenticado; email debe coincidir con invitation.email
// @see project-roadmap.md Módulo 1

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authorization Bearer required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Crear cliente con el token del usuario para validar la sesión
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Crear cliente con SERVICE_ROLE_KEY para operaciones administrativas
    // Nota: SERVICE_ROLE_KEY sin prefijo porque Supabase no permite secretos que empiecen con SUPABASE_
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { token } = (await req.json()) as { token?: string };
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'token required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: inv, error: invErr } = await supabase
      .from('organization_invitations')
      .select('id, org_id, team_id, email, role, status, expires_at, invited_by')
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
    const userEmail = (user.email ?? '').trim().toLowerCase();
    if (userEmail !== invEmail) {
      return new Response(
        JSON.stringify({ error: `This invitation is for ${inv.email}. Please sign in with that email.` }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let membershipQuery = supabase
      .from('memberships')
      .select('id')
      .eq('org_id', inv.org_id)
      .eq('user_id', user.id);
    if (inv.team_id) membershipQuery = membershipQuery.eq('team_id', inv.team_id);
    else membershipQuery = membershipQuery.is('team_id', null);
    const { data: existing } = await membershipQuery.maybeSingle();

    const now = new Date().toISOString();
    if (existing) {
      await supabase
        .from('memberships')
        .update({ role: inv.role, updated_at: now })
        .eq('id', existing.id);
    } else {
      const { error: insertErr } = await supabase.from('memberships').insert({
        org_id: inv.org_id,
        team_id: inv.team_id,
        user_id: user.id,
        role: inv.role,
      });
      if (insertErr) {
        return new Response(
          JSON.stringify({ error: insertErr.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    await supabase
      .from('organization_invitations')
      .update({ status: 'accepted', accepted_at: now })
      .eq('id', inv.id);

    await supabase.from('audit_log').insert({
      org_id: inv.org_id,
      actor_id: user.id,
      entity: 'organization_invitation',
      entity_id: inv.id,
      action: 'accept',
      after_snapshot: { role: inv.role, team_id: inv.team_id },
      comment: `Invitation accepted by ${userEmail}`,
    });

    // Email de confirmación al inviter (opcional, requiere Resend y dominio)
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (resendKey && inv.invited_by) {
      const roleLabels: Record<string, string> = {
        org_admin: 'Administrador de organización',
        team_manager: 'Gestor de equipo',
        user: 'Usuario',
        viewer: 'Solo lectura',
      };
      const [{ data: org }, { data: inviter }, { data: accepterProfile }] = await Promise.all([
        supabase.from('organizations').select('name').eq('id', inv.org_id).single(),
        supabase.auth.admin.getUserById(inv.invited_by),
        supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      ]);
      const inviterEmail = inviter?.user?.email;
      const orgName = org?.name ?? 'la organización';
      const accepterName = accepterProfile?.full_name?.trim() || userEmail;
      const roleLabel = roleLabels[inv.role] ?? inv.role;
      if (inviterEmail) {
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:system-ui,sans-serif;line-height:1.5;max-width:480px;margin:0 auto;padding:24px;"><h2 style="margin:0 0 16px;">Invitación aceptada</h2><p><strong>${accepterName}</strong> (${userEmail}) ha aceptado tu invitación a unirse a <strong>${orgName}</strong> con el rol de <strong>${roleLabel}</strong>.</p><p style="color:#666;font-size:0.875rem;">— Turnia</p></body></html>`;
        const fromAddress = Deno.env.get('RESEND_FROM') || 'Turnia <onboarding@resend.dev>';
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: fromAddress,
            to: [inviterEmail],
            subject: `Invitación aceptada: ${accepterName} se unió a ${orgName}`,
            html,
          }),
        });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, org_id: inv.org_id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
