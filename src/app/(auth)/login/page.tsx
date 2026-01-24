import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="rounded-xl border border-border bg-background p-6 text-text-secondary">Cargando…</div>}>
      <LoginForm />
    </Suspense>
  );
}
