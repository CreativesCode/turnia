'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace(`/login?redirect=${encodeURIComponent(pathname || '/dashboard')}`);
      }
    });
  }, [mounted, router, pathname]);

  if (!mounted) {
    return (
      <div className="grid min-h-[40vh] place-items-center bg-subtle-bg">
        <p className="text-muted">Cargando…</p>
      </div>
    );
  }

  return <>{children}</>;
}
