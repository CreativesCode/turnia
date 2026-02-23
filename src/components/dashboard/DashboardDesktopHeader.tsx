'use client';

import { NotificationBell } from '@/components/notifications/NotificationBell';
import { ThemeToggleButton } from '@/components/theme/theme';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

function getInitials(name: string | null): string {
  const n = (name ?? '').trim();
  if (!n) return 'U';
  const parts = n.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? 'U';
  const b = parts[1]?.[0] ?? parts[0]?.[1] ?? '';
  return (a + b).toUpperCase();
}

export function DashboardDesktopHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string | null;
  actions?: React.ReactNode;
}) {
  const { userId } = useScheduleOrg();
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const t = window.setTimeout(() => {
      const supabase = createClient();
      void supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .maybeSingle()
        .then(
          ({ data }) => setFullName((data as { full_name?: string | null } | null)?.full_name ?? null),
          () => setFullName(null)
        );
    }, 0);
    return () => window.clearTimeout(t);
  }, [userId]);

  const initials = useMemo(() => getInitials(fullName), [fullName]);

  return (
    <div className="-mx-8 -mt-8 mb-4 hidden md:block">
      <div className="border-b border-border bg-background">
        <div className="flex min-h-[72px] items-center justify-between gap-4 px-8 py-4">
          <div className="min-w-0">
            <p className="truncate text-2xl font-bold text-text-primary">{title}</p>
            {subtitle ? <p className="mt-1 truncate text-sm text-text-secondary">{subtitle}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <ThemeToggleButton ariaLabel="Cambiar tema" />
            <NotificationBell />
            <Link
              href="/dashboard/profile"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700"
              aria-label="Preferencia y perfil"
              title="Preferencia y perfil"
            >
              {initials}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

