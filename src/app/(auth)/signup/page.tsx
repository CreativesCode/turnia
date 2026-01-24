import { Suspense } from 'react';
import { SignupForm } from '@/components/auth/SignupForm';

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="rounded-xl border border-border bg-background p-6 text-text-secondary">Cargando…</div>}>
      <SignupForm />
    </Suspense>
  );
}
