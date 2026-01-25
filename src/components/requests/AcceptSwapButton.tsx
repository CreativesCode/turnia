'use client';

/**
 * Botones para que User B (target_user_id) acepte o rechace una solicitud de swap.
 * @see project-roadmap.md Módulo 4.4
 */

import { useCallback, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

type Props = {
  requestId: string;
  onSuccess: () => void;
};

export function AcceptSwapButton({ requestId, onSuccess }: Props) {
  const [action, setAction] = useState<'accept' | 'decline' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAction = useCallback(async () => {
    if (!action) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr || !refreshData?.session?.access_token) {
      setError('Sesión expirada. Recarga la página e inicia sesión de nuevo.');
      setLoading(false);
      setAction(null);
      return;
    }

    const { data, error: fnErr } = await supabase.functions.invoke('respond-to-swap', {
      body: { requestId, response: action },
    });
    setLoading(false);
    setAction(null);
    const json = (data ?? {}) as { ok?: boolean; error?: string };
    if (fnErr || !json.ok) {
      setError(String(json.error || (fnErr as Error)?.message || 'Error al procesar.'));
      return;
    }
    onSuccess();
  }, [requestId, action, onSuccess]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setAction('accept')}
          disabled={loading}
          className="min-h-[44px] min-w-[44px] rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {loading && action === 'accept' ? '…' : 'Aceptar'}
        </button>
        <button
          type="button"
          onClick={() => setAction('decline')}
          disabled={loading}
          className="min-h-[44px] min-w-[44px] rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {loading && action === 'decline' ? '…' : 'Rechazar'}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}

      <ConfirmModal
        open={action === 'accept'}
        onClose={() => setAction(null)}
        onConfirm={runAction}
        title="Aceptar intercambio"
        message="Al aceptar, un responsable deberá aprobar el intercambio para que se aplique. ¿Continuar?"
        confirmLabel="Sí, aceptar"
        loading={loading}
      />
      <ConfirmModal
        open={action === 'decline'}
        onClose={() => setAction(null)}
        onConfirm={runAction}
        title="Rechazar intercambio"
        message="La solicitud de intercambio se cancelará. ¿Continuar?"
        confirmLabel="Sí, rechazar"
        variant="danger"
        loading={loading}
      />
    </>
  );
}
