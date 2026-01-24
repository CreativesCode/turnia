// Edge Function: aprobar/rechazar solicitudes de turnos
// Usa service_role para transacciones multi-tabla y audit_log
// @see indications.md §5.4, §7

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { requestId, action, comment } = (await req.json()) as {
      requestId: string;
      action: 'approve' | 'reject';
      comment?: string;
    };

    if (!requestId || !action) {
      return new Response(
        JSON.stringify({ error: 'requestId and action required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: sr, error: fetchErr } = await supabase
      .from('shift_requests')
      .select('*, shift:shifts(*)')
      .eq('id', requestId)
      .single();

    if (fetchErr || !sr) {
      return new Response(
        JSON.stringify({ error: 'Request not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const { error: updateErr } = await supabase
      .from('shift_requests')
      .update({
        status: newStatus,
        approver_id: (req.headers.get('x-user-id') as string) || null,
        comment,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateErr) {
      return new Response(
        JSON.stringify({ error: updateErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // TODO: si approved, aplicar cambio de asignación en shifts y llamar send-notification
    await supabase.from('audit_log').insert({
      org_id: sr.org_id,
      actor_id: req.headers.get('x-user-id') || null,
      entity: 'shift_request',
      entity_id: requestId,
      action: `request_${newStatus}`,
      after_snapshot: { status: newStatus, comment },
      comment,
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
