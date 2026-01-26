// Edge Function: crear solicitudes take_open y give_away.
// Si org_settings lo permite, auto-aprueba:
// - take_open: allow_self_assign_open_shifts → asigna turno al requester.
// - give_away: !require_approval_for_give_aways → deja turno sin asignar.
// @see project-roadmap.md Módulo 9.3

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

    const { requestType, shiftId, comment } = (await req.json()) as {
      requestType: 'take_open' | 'give_away';
      shiftId: string;
      comment?: string;
    };

    if (!requestType || !shiftId || !['take_open', 'give_away'].includes(requestType)) {
      return new Response(
        JSON.stringify({ error: 'requestType (take_open|give_away) y shiftId son requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: shift, error: shiftErr } = await supabase
      .from('shifts')
      .select('id, org_id, assigned_user_id')
      .eq('id', shiftId)
      .single();

    if (shiftErr || !shift) {
      return new Response(
        JSON.stringify({ error: 'Turno no encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orgId = (shift as { org_id: string }).org_id;
    const assigned = (shift as { assigned_user_id: string | null }).assigned_user_id;

    if (requestType === 'take_open') {
      if (assigned != null) {
        return new Response(
          JSON.stringify({ error: 'El turno ya está asignado' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      if (assigned !== user.id) {
        return new Response(
          JSON.stringify({ error: 'Solo puedes dar de baja un turno que te está asignado' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const { data: membership } = await supabase
      .from('memberships')
      .select('id')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .in('role', ['user', 'team_manager', 'org_admin', 'superadmin'])
      .maybeSingle();
    if (!membership) {
      return new Response(
        JSON.stringify({ error: 'No tienes permiso para crear solicitudes en esta organización' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: existing } = await supabase
      .from('shift_requests')
      .select('id')
      .eq('shift_id', shiftId)
      .eq('request_type', requestType)
      .in('status', ['submitted', 'accepted'])
      .limit(1);
    if ((existing?.length ?? 0) > 0) {
      return new Response(
        JSON.stringify({ error: 'Ya existe una solicitud pendiente para este turno' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: os } = await supabase
      .from('org_settings')
      .select('allow_self_assign_open_shifts, require_approval_for_give_aways')
      .eq('org_id', orgId)
      .maybeSingle();

    const allowSelfAssign = (os as { allow_self_assign_open_shifts?: boolean } | null)?.allow_self_assign_open_shifts ?? true;
    const requireApprovalGiveAways = (os as { require_approval_for_give_aways?: boolean } | null)?.require_approval_for_give_aways ?? true;

    const autoApprove =
      (requestType === 'take_open' && allowSelfAssign) ||
      (requestType === 'give_away' && !requireApprovalGiveAways);

    const { data: inserted, error: insertErr } = await supabase
      .from('shift_requests')
      .insert({
        org_id: orgId,
        request_type: requestType,
        status: autoApprove ? 'approved' : 'submitted',
        shift_id: shiftId,
        requester_id: user.id,
        comment: (typeof comment === 'string' && comment.trim()) ? comment.trim() : null,
        approver_id: autoApprove ? null : undefined,
      })
      .select('id, status')
      .single();

    if (insertErr) {
      return new Response(
        JSON.stringify({ error: insertErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestId = (inserted as { id: string }).id;

    if (autoApprove) {
      if (requestType === 'give_away') {
        await supabase
          .from('shifts')
          .update({ assigned_user_id: null, updated_at: new Date().toISOString() })
          .eq('id', shiftId);
      } else {
        await supabase
          .from('shifts')
          .update({ assigned_user_id: user.id, updated_at: new Date().toISOString() })
          .eq('id', shiftId);
      }

      await supabase.from('audit_log').insert({
        org_id: orgId,
        actor_id: user.id,
        entity: 'shift_request',
        entity_id: requestId,
        action: 'request_approved',
        after_snapshot: { status: 'approved', auto: true },
        comment: 'Aprobación automática (configuración de la organización)',
      });

      await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Solicitud aprobada',
        message: 'Tu solicitud ha sido aprobada automáticamente.',
        type: 'request',
        entity_type: 'shift_request',
        entity_id: requestId,
      });

      const baseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      if (baseUrl) {
        try {
          await fetch(`${baseUrl}/functions/v1/send-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              type: 'request',
              title: 'Solicitud aprobada',
              body: 'Tu solicitud ha sido aprobada automáticamente.',
              email: false,
            }),
          });
        } catch (_) {
          /* ignore */
        }
      }
    }

    return new Response(
      JSON.stringify({
        id: requestId,
        status: (inserted as { status: string }).status,
        autoApproved: autoApprove,
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
