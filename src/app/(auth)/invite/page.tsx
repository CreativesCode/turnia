'use client';

import { AuthShell } from '@/components/auth/AuthShell';
import {
  AcceptInvitationForm,
  type InvitationData,
} from '@/components/invitations/AcceptInvitationForm';
import { Spinner } from '@/components/ui/Spinner';
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
      <AuthShell title="Cargando invitación…">
        <div className="flex justify-center py-6 text-text-sec">
          <Spinner />
        </div>
      </AuthShell>
    );
  }

  if (state.status === 'error') {
    return (
      <AuthShell
        title="Invitación no disponible"
        subtitle={state.message}
        footer={
          <>
            <Link href="/" className="font-semibold text-primary">
              Volver al inicio
            </Link>
            <span className="mx-2">·</span>
            <Link href="/login" className="font-semibold text-primary">
              Iniciar sesión
            </Link>
          </>
        }
      >
        <div />
      </AuthShell>
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
    <div className="flex min-h-screen items-start justify-center px-4 sm:items-center">
      <Suspense
        fallback={
          <AuthShell title="Cargando…">
            <div className="flex justify-center py-6 text-text-sec">
              <Spinner />
            </div>
          </AuthShell>
        }
      >
        <InvitePageContent />
      </Suspense>
    </div>
  );
}
