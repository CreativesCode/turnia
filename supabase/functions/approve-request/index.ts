// Edge Function: aprobar/rechazar solicitudes de turnos.
// Aplica cambios en shifts cuando action=approve según request_type:
// - give_away: deja el turno sin asignar.
// - swap: intercambia assigned_user_id entre shift y target_shift.
// - take_open: asigna el turno al requester.
// @see project-roadmap.md Módulo 4.3

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type ShiftRow = { id: string; assigned_user_id: string | null };

type RequestRow = {
  id: string;
  org_id: string;
  request_type: 'give_away' | 'swap' | 'take_open';
  status: string;
  shift_id: string | null;
  target_shift_id: string | null;
  target_user_id: string | null;
  requester_id: string;
  comment: string | null;
  shift?: ShiftRow | null;
  target_shift?: ShiftRow | null;
};

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

    const { data: sr, error: fetchErr } = await supabase
      .from('shift_requests')
      .select(`
        id, org_id, request_type, status, shift_id, target_shift_id, target_user_id, requester_id, comment
      `)
      .eq('id', requestId)
      .single();

    if (fetchErr || !sr) {
      return new Response(
        JSON.stringify({ error: 'Request not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const row = sr as RequestRow;

    // Solo se puede aprobar/rechazar si está submitted o accepted
    if (!['submitted', 'accepted'].includes(row.status)) {
      return new Response(
        JSON.stringify({ error: 'Solo se pueden aprobar o rechazar solicitudes en estado enviada o aceptada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Permisos: team_manager, org_admin o superadmin en la org de la solicitud
    const { data: membership } = await supabase
      .from('memberships')
      .select('id')
      .eq('org_id', row.org_id)
      .eq('user_id', user.id)
      .in('role', ['team_manager', 'org_admin', 'superadmin'])
      .maybeSingle();

    let isSuperadmin = false;
    if (!membership) {
      const { data: sa } = await supabase
        .from('memberships')
        .select('id')
        .eq('user_id', user.id)
        .eq('role', 'superadmin')
        .limit(1)
        .maybeSingle();
      isSuperadmin = !!sa;
    }

    if (!membership && !isSuperadmin) {
      return new Response(
        JSON.stringify({ error: 'No tienes permiso para aprobar o rechazar solicitudes en esta organización' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    if (action === 'approve' && row.shift_id) {
      if (row.request_type === 'give_away') {
        await supabase
          .from('shifts')
          .update({ assigned_user_id: null, updated_at: new Date().toISOString() })
          .eq('id', row.shift_id);
      } else if (row.request_type === 'take_open') {
        await supabase
          .from('shifts')
          .update({ assigned_user_id: row.requester_id, updated_at: new Date().toISOString() })
          .eq('id', row.shift_id);
      } else if (row.request_type === 'swap' && row.target_shift_id && row.target_user_id) {
        const { data: shiftRow } = await supabase
          .from('shifts')
          .select('id, assigned_user_id')
          .eq('id', row.shift_id)
          .single();
        const { data: targetRow } = await supabase
          .from('shifts')
          .select('id, assigned_user_id')
          .eq('id', row.target_shift_id)
          .single();
        const userA = (shiftRow as { assigned_user_id: string | null } | null)?.assigned_user_id ?? row.requester_id;
        const userB = (targetRow as { assigned_user_id: string | null } | null)?.assigned_user_id ?? row.target_user_id;
        await supabase.from('shifts').update({ assigned_user_id: userB, updated_at: new Date().toISOString() }).eq('id', row.shift_id);
        await supabase.from('shifts').update({ assigned_user_id: userA, updated_at: new Date().toISOString() }).eq('id', row.target_shift_id);
      }
    }

    const updatePayload: { status: string; approver_id: string; updated_at: string } = {
      status: newStatus,
      approver_id: user.id,
      updated_at: new Date().toISOString(),
    };
    // No sobrescribir comment del requester; el comentario del manager va a audit_log

    const { error: updateErr } = await supabase
      .from('shift_requests')
      .update(updatePayload)
      .eq('id', requestId);

    if (updateErr) {
      return new Response(
        JSON.stringify({ error: updateErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase.from('audit_log').insert({
      org_id: row.org_id,
      actor_id: user.id,
      entity: 'shift_request',
      entity_id: requestId,
      action: `request_${newStatus}`,
      after_snapshot: { status: newStatus, manager_comment: comment || null },
      comment: comment || null,
    });

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
