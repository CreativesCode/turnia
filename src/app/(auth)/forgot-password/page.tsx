import { Suspense } from 'react';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="rounded-2xl border border-border bg-background p-6 text-text-secondary shadow-sm">Cargando…</div>}>
      <ForgotPasswordForm />
    </Suspense>
  );
}

