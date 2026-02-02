import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { Suspense } from 'react';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="rounded-2xl border border-border bg-background p-6 text-text-secondary shadow-sm">Cargando…</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

