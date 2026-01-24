// Edge Function: validar token de invitación (pública, sin auth)
// Devuelve org, rol, team, email para mostrar en /invite/[token]
// @see project-roadmap.md Módulo 1

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let token = url.searchParams.get('token');
    if (!token && req.method === 'POST') {
      try {
        const body = (await req.json()) as { token?: string };
        token = body?.token ?? null;
      } catch { /* ignore */ }
    }
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'token required (query ?token= or body { token })' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Nota: SERVICE_ROLE_KEY sin prefijo porque Supabase no permite secretos que empiecen con SUPABASE_
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: inv, error } = await supabase
      .from('organization_invitations')
      .select('id, org_id, team_id, email, role, status, expires_at, invited_by')
      .eq('token', token)
      .single();

    if (error || !inv) {
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

    const expiresAt = new Date(inv.expires_at);
    if (expiresAt < new Date()) {
      await supabase
        .from('organization_invitations')
        .update({ status: 'expired' })
        .eq('id', inv.id);
      return new Response(
        JSON.stringify({ error: 'Invitation has expired' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const [orgRes, teamRes, inviterRes] = await Promise.all([
      supabase.from('organizations').select('name, slug').eq('id', inv.org_id).single(),
      inv.team_id ? supabase.from('teams').select('name, slug').eq('id', inv.team_id).single() : Promise.resolve({ data: null }),
      supabase.from('profiles').select('full_name').eq('id', inv.invited_by).single(),
    ]);

    return new Response(
      JSON.stringify({
        ok: true,
        invitation_id: inv.id,
        email: inv.email,
        role: inv.role,
        org_id: inv.org_id,
        org_name: orgRes.data?.name ?? null,
        org_slug: orgRes.data?.slug ?? null,
        team_id: inv.team_id,
        team_name: teamRes.data?.name ?? null,
        team_slug: teamRes.data?.slug ?? null,
        invited_by_name: inviterRes.data?.full_name ?? null,
        expires_at: inv.expires_at,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
