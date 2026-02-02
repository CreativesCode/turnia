'use client';

import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

type Stats = {
  monthShifts: number;
  monthHours: number;
  approvedRequests: number;
};

function initials(name: string | null): string {
  const n = (name ?? '').trim();
  if (!n) return 'U';
  const parts = n.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? 'U';
  const b = parts[1]?.[0] ?? parts[0]?.[1] ?? '';
  return (a + b).toUpperCase();
}

function formatHours(h: number): string {
  if (!isFinite(h) || h <= 0) return '0h';
  if (h < 10) return `${Math.round(h * 10) / 10}h`;
  return `${Math.round(h)}h`;
}

export default function ProfilePage() {
  const router = useRouter();
  const { orgId, userId, canManageOrg, canManageShifts, isLoading, error } = useScheduleOrg();
  const [fullName, setFullName] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ monthShifts: 0, monthHours: 0, approvedRequests: 0 });
  const [loadingData, setLoadingData] = useState(false);

  const roleLabel = useMemo(() => {
    if (canManageOrg) return 'Admin';
    if (canManageShifts) return 'Manager';
    return 'Staff';
  }, [canManageOrg, canManageShifts]);

  const load = useCallback(async () => {
    if (!orgId || !userId) return;
    setLoadingData(true);
    const supabase = createClient();

    const [{ data: prof }, { data: org }, { data: au }] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
      supabase.from('organizations').select('name').eq('id', orgId).maybeSingle(),
      supabase.auth.getUser(),
    ]);

    setFullName((prof as { full_name?: string | null } | null)?.full_name ?? null);
    setOrgName((org as { name?: string | null } | null)?.name ?? null);
    setEmail(au.user?.email ?? null);

    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const { data: shifts } = await supabase
      .from('shifts')
      .select('start_at, end_at')
      .eq('org_id', orgId)
      .eq('assigned_user_id', userId)
      .gte('start_at', from.toISOString())
      .lte('start_at', to.toISOString())
      .limit(200);

    const monthShifts = (shifts ?? []).length;
    const monthHours = (shifts ?? []).reduce((acc, s) => {
      const st = new Date((s as { start_at: string }).start_at).getTime();
      const en = new Date((s as { end_at: string }).end_at).getTime();
      if (!isFinite(st) || !isFinite(en) || en <= st) return acc;
      return acc + (en - st) / 3600_000;
    }, 0);

    const { count: approvedRequests } = await supabase
      .from('shift_requests')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('requester_id', userId)
      .eq('status', 'approved');

    setStats({ monthShifts, monthHours, approvedRequests: approvedRequests ?? 0 });
    setLoadingData(false);
  }, [orgId, userId]);

  useEffect(() => {
    if (!orgId || !userId) return;
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [orgId, userId, load]);

  const handleLogout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/');
    router.refresh();
  }, [router]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-background p-6">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!orgId || !userId) {
    return (
      <div className="rounded-xl border border-border bg-background p-6">
        <h1 className="text-xl font-semibold text-text-primary">Mi perfil</h1>
        <p className="mt-2 text-sm text-muted">Inicia sesión y asegúrate de tener una organización asignada.</p>
        <div className="mt-4">
          <Link href="/login" className="text-sm font-medium text-primary-600 hover:text-primary-700">
            Iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  const name = fullName?.trim() || (email?.split('@')[0] ?? 'Usuario');

  return (
    <div className="space-y-4">
      <DashboardDesktopHeader title="Mi Perfil" subtitle={orgName ? `${orgName} • ${roleLabel}` : roleLabel} />

      {/* Header (móvil) */}
      <div className="flex items-center justify-center md:hidden">
        <h1 className="text-lg font-semibold text-text-primary">Mi Perfil</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-[320px_1fr] md:gap-8">
        {/* Left */}
        <div className="space-y-4 md:space-y-6">
          <div className="rounded-2xl border border-border bg-background p-5 md:p-8">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-100 text-[28px] font-semibold text-primary-700">
                {initials(fullName)}
              </div>
              <p className="mt-4 text-xl font-semibold text-text-primary">{name}</p>
              <span className="mt-3 inline-flex h-7 items-center rounded-full bg-primary-50 px-3 text-[13px] font-medium text-primary-700">
                {roleLabel}
              </span>
              {orgName ? <p className="mt-2 text-sm text-text-secondary">{orgName}</p> : null}
              {email ? <p className="mt-2 text-xs text-muted md:hidden">{email}</p> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-5 md:rounded-xl md:p-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-text-secondary">Turnos este mes</p>
                <p className="text-base font-semibold text-primary-600">{loadingData ? '…' : stats.monthShifts}</p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-text-secondary">Horas trabajadas</p>
                <p className="text-base font-semibold text-green-600">{loadingData ? '…' : formatHours(stats.monthHours)}</p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-text-secondary">Solicitudes aprobadas</p>
                <p className="text-base font-semibold text-text-primary">{loadingData ? '—' : stats.approvedRequests}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="space-y-4">
          <p className="hidden text-base font-semibold text-text-secondary md:block">Configuración</p>

          <div className="overflow-hidden rounded-2xl border border-border bg-background md:rounded-xl">
            <MenuLink href="/dashboard/profile" label="Editar perfil" icon="pencil" />
            <MenuLink href="/dashboard/notifications" label="Notificaciones" icon="bell" />
            <MenuLink href="/dashboard/staff/availability" label="Mi disponibilidad" icon="calendar" />
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-14 w-full items-center gap-4 px-5 text-left text-sm font-medium text-red-600 hover:bg-subtle-bg"
            >
              <span className="text-red-600" aria-hidden>
                <Icon name="log-out" />
              </span>
              <span className="flex-1">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Icon({ name }: { name: 'pencil' | 'bell' | 'calendar' | 'log-out' }) {
  switch (name) {
    case 'pencil':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M17 3a2.85 2.85 0 1 1 4 4L7 21H3v-4L17 3z" />
          <path d="M16 5l3 3" />
        </svg>
      );
    case 'bell':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case 'calendar':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M3 10h18" />
        </svg>
      );
    case 'log-out':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      );
  }
}

function MenuLink({ href, label, icon }: { href: string; label: string; icon: Parameters<typeof Icon>[0]['name'] }) {
  return (
    <Link href={href} className="flex h-14 items-center gap-4 px-5 text-sm font-medium text-text-primary hover:bg-subtle-bg">
      <span className="text-muted" aria-hidden>
        <Icon name={icon} />
      </span>
      <span className="flex-1">{label}</span>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted" aria-hidden>
        <path d="m9 18 6-6-6-6" />
      </svg>
    </Link>
  );
}

