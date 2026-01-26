// Edge Function: eliminar turno
// Requiere: org_admin o superadmin en la org (team_manager NO puede eliminar). @see project-roadmap.md 9.1, 9.2

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  getAuthUser,
  checkCanDeleteShifts,
  checkRateLimit,
  logFailedAttempt,
} from '../_shared/auth.ts';

const FN = 'delete-shift';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

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
        JSON.stringify({ error: auth.error === 'no_bearer' ? 'Authorization Bearer required' : 'Invalid or expired token' }),
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

    const body = (await req.json()) as { id: string };
    const { id } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: 'id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: shift, error: shiftErr } = await supabase
      .from('shifts')
      .select('id, org_id')
      .eq('id', id)
      .single();

    if (shiftErr || !shift) {
      return new Response(JSON.stringify({ error: 'Turno no encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const org_id = shift.org_id;

    // Permisos: solo org_admin o superadmin (team_manager NO puede eliminar)
    const canDelete = await checkCanDeleteShifts(supabase, user.id, org_id);
    if (!canDelete) {
      await logFailedAttempt(supabase, {
        functionName: FN,
        userId: user.id,
        orgId: org_id,
        reason: 'No tienes permiso para eliminar este turno',
        status: 403,
      });
      return new Response(
        JSON.stringify({ error: 'No tienes permiso para eliminar este turno' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: deleteErr } = await supabase
      .from('shifts')
      .delete()
      .eq('id', id)
      .eq('org_id', org_id);

    if (deleteErr) {
      return new Response(JSON.stringify({ error: deleteErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
