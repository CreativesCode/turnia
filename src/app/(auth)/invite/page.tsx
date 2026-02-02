'use client';

import { AcceptInvitationForm, type InvitationData } from '@/components/invitations/AcceptInvitationForm';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; invitation: InvitationData; sessionUser: { email?: string | null } | null };

function InvitePageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [state, setState] = useState<State>({ status: 'loading' });

  const fetchData = useCallback(async () => {
    if (!token) {
      setState({ status: 'error', message: 'Enlace inválido. Falta el token.' });
      return;
    }
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/validate-invitation?token=${encodeURIComponent(token)}`;
    const res = await fetch(url, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = json.error || (res.status === 404 ? 'Invitación no encontrada' : res.status === 410 ? 'Invitación expirada o ya utilizada' : 'Error al cargar');
      setState({ status: 'error', message: msg });
      return;
    }
    if (!json.ok || !json.email) {
      setState({ status: 'error', message: 'Invitación no válida' });
      return;
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setState({
      status: 'ready',
      invitation: json as InvitationData,
      sessionUser: user ? { email: user.email } : null,
    });
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (state.status === 'loading') {
    return (
      <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
        <p className="text-center text-text-secondary">Cargando invitación…</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
        <h1 className="mb-4 text-xl font-semibold text-text-primary">Invitación no disponible</h1>
        <p className="mb-4 text-sm text-text-secondary">{state.message}</p>
        <p className="text-center text-xs text-muted">
          <Link href="/" className="text-primary-600 hover:text-primary-700">Volver al inicio</Link>
          <span className="mx-2">·</span>
          <Link href="/login" className="text-primary-600 hover:text-primary-700">Iniciar sesión</Link>
        </p>
      </div>
    );
  }

  return (
    <AcceptInvitationForm
      invitation={state.invitation}
      sessionUser={state.sessionUser}
      token={token}
    />
  );
}

export default function InvitePage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-xl items-center justify-center sm:min-h-[calc(100vh-3rem)]">
      <div className="w-full">
        <Suspense
          fallback={
            <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
              <p className="text-center text-text-secondary">Cargando…</p>
            </div>
          }
        >
          <InvitePageContent />
        </Suspense>
      </div>
    </div>
  );
}
