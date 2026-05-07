import { AuthSplit } from '@/components/auth/AuthSplit';
import { LoginForm } from '@/components/auth/LoginForm';
import { Suspense } from 'react';

export default function LoginPage() {
  return (
    <AuthSplit>
      <Suspense
        fallback={
          <div className="rounded-xl border border-border bg-background p-6 text-text-sec">
            Cargando…
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </AuthSplit>
  );
}
