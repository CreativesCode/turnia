'use client';

import { LogoutButton } from '@/components/auth/LogoutButton';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { ThemeToggleButton } from '@/components/theme/theme';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  const pathname = usePathname();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const closeUserMenu = useCallback(() => setUserMenuOpen(false), []);

  useEffect(() => {
    if (!userMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

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
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700 hover:bg-primary-200"
                aria-label="Menú de usuario"
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
              >
                {initials}
              </button>
              {userMenuOpen && (
                <div
                  className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-border bg-background py-1 shadow-lg"
                  role="menu"
                >
                  <div className="border-b border-border px-3 py-2.5" role="presentation">
                    <p className="truncate text-sm font-medium text-text-primary">{fullName?.trim() || 'Usuario'}</p>
                  </div>
                  <Link
                    href="/dashboard/profile"
                    role="menuitem"
                    onClick={closeUserMenu}
                    className={`block px-3 py-2 text-sm transition-colors ${
                      pathname?.startsWith('/dashboard/profile')
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-text-secondary hover:bg-subtle-bg hover:text-text-primary'
                    }`}
                  >
                    Preferencia y perfil
                  </Link>
                  <div className="px-3 py-2" role="menuitem">
                    <LogoutButton />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

