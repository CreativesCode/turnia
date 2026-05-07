import { AuthSplit } from '@/components/auth/AuthSplit';
import { SignupForm } from '@/components/auth/SignupForm';
import { Suspense } from 'react';

export default function SignupPage() {
  return (
    <AuthSplit>
      <Suspense
        fallback={
          <div className="rounded-xl border border-border bg-background p-6 text-text-sec">
            Cargando…
          </div>
        }
      >
        <SignupForm />
      </Suspense>
    </AuthSplit>
  );
}
