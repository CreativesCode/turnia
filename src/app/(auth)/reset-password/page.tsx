import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { Spinner } from '@/components/ui/Spinner';
import { Suspense } from 'react';

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-start justify-center px-4 sm:items-center">
      <Suspense
        fallback={
          <div className="flex justify-center py-12 text-text-sec">
            <Spinner />
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
