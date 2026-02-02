'use client';

import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { LinkButton } from '@/components/ui/LinkButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { getCacheEntry, setCache } from '@/lib/cache';
import { createClient } from '@/lib/supabase/client';
import { fetchProfilesMap } from '@/lib/supabase/queries';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ShiftType = { id: string; name: string; letter: string; color: string } | null;
type ShiftRow = {
  id: string;
  start_at: string;
  end_at: string;
  assigned_user_id: string | null;
  location: string | null;
  organization_shift_types: ShiftType | ShiftType[] | null;
};

function normalizeShiftType(ot: ShiftRow['organization_shift_types']): ShiftType {
  if (!ot) return null;
  return (Array.isArray(ot) ? ot[0] : ot) ?? null;
}

function formatShortDate(startAt: string, endAt: string): string {
  const s = new Date(startAt);
  const e = new Date(endAt);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return '—';
  const day = s.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
  const st = s.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const et = e.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${st}–${et}`;
}

function formatTableDate(startAt: string): string {
  const s = new Date(startAt);
  if (isNaN(s.getTime())) return '—';
  return s.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
}

function formatTimeRange(startAt: string, endAt: string): string {
  const s = new Date(startAt);
  const e = new Date(endAt);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return '—';
  const st = s.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const et = e.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `${st} - ${et}`;
}

function formatHours(hours: number): string {
  if (!isFinite(hours) || hours <= 0) return '0h';
  if (hours < 10) return `${Math.round(hours * 10) / 10}h`;
  return `${Math.round(hours)}h`;
}

function TypeBadge({ letter, name, color }: { letter: string; name: string; color?: string | null }) {
  const c = color ?? '#0D9488';
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold"
        style={{ backgroundColor: hexToRgba(c, 0.18), color: c }}
        aria-hidden
      >
        {letter || '?'}
      </span>
      <span className="truncate text-sm text-text-primary">{name}</span>
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace('#', '').trim();
  if (raw.length !== 6) return `rgba(13,148,136,${alpha})`;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  if (![r, g, b].every((n) => Number.isFinite(n))) return `rgba(13,148,136,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}

function TypePill({ name, color }: { name: string; color: string | null }) {
  const c = color ?? '#0D9488';
  return (
    <span
      className="inline-flex h-6 items-center rounded-md px-2 text-xs font-medium"
      style={{ backgroundColor: hexToRgba(c, 0.18), color: c }}
    >
      {name}
    </span>
  );
}

function getShiftStatus(startAt: string, endAt: string): { label: string; className: string } {
  const now = Date.now();
  const st = new Date(startAt).getTime();
  const en = new Date(endAt).getTime();
  if (!isFinite(st) || !isFinite(en)) return { label: '—', className: 'text-muted' };
  if (now >= st && now <= en) return { label: 'Activo', className: 'text-green-600' };
  if (now < st) return { label: 'Próximo', className: 'text-muted' };
  return { label: 'Finalizado', className: 'text-muted' };
}

function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

type ManagerCardShift = {
  id: string;
  start_at: string;
  end_at: string;
  assigned_user_id: string | null;
  assigned_name: string | null;
  type_name: string;
  type_letter: string;
  type_color: string | null;
};

type DashboardCacheData = {
  fullName: string | null;
  orgName: string | null;
  todayShift: (ShiftRow & { organization_shift_types: ShiftType }) | null;
  upcoming: (ShiftRow & { organization_shift_types: ShiftType })[];
  monthShiftsCount: number;
  monthHours: number;
  myPendingRequestsCount: number;
  pendingRequestsCount: number;
  managerWeekCount: number;
  managerWeekHours: number;
  managerStaffActive: number;
  managerToday: ManagerCardShift[];
  adminMembersCount: number;
  adminInvitesPending: number;
  adminShiftTypesCount: number;
};

function dashboardCacheKey(orgId: string, userId: string, roleKey: 'admin' | 'manager' | 'staff'): string {
  return `turnia:cache:dashboard:${orgId}:${userId}:${roleKey}`;
}

export default function DashboardPage() {
  const { orgId, userId, canManageOrg, canManageShifts, isLoading, error } = useScheduleOrg();
  const [fullName, setFullName] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [todayShift, setTodayShift] = useState<(ShiftRow & { organization_shift_types: ShiftType }) | null>(null);
  const [upcoming, setUpcoming] = useState<(ShiftRow & { organization_shift_types: ShiftType })[]>([]);
  const [monthShiftsCount, setMonthShiftsCount] = useState<number>(0);
  const [monthHours, setMonthHours] = useState<number>(0);
  const [myPendingRequestsCount, setMyPendingRequestsCount] = useState<number>(0);
  const [managerWeekCount, setManagerWeekCount] = useState<number>(0);
  const [managerWeekHours, setManagerWeekHours] = useState<number>(0);
  const [managerStaffActive, setManagerStaffActive] = useState<number>(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
  const [managerToday, setManagerToday] = useState<ManagerCardShift[]>([]);
  const [adminMembersCount, setAdminMembersCount] = useState<number>(0);
  const [adminInvitesPending, setAdminInvitesPending] = useState<number>(0);
  const [adminShiftTypesCount, setAdminShiftTypesCount] = useState<number>(0);
  const [loadingData, setLoadingData] = useState(false);

  const greeting = useMemo(() => {
    const name = fullName?.trim();
    if (name) return `Hola, ${name.split(' ')[0]} 👋`;
    return 'Hola 👋';
  }, [fullName]);

  const roleLabel = useMemo(() => {
    if (canManageOrg) return 'Admin';
    if (canManageShifts) return 'Manager';
    return 'Staff';
  }, [canManageOrg, canManageShifts]);

  const desktopTitle = useMemo(() => {
    if (canManageOrg) return 'Panel de Administración';
    if (canManageShifts) return 'Dashboard';
    return 'Dashboard';
  }, [canManageOrg, canManageShifts]);

  const headerActions = useMemo(() => {
    if (!canManageOrg) return null;
    return (
      <Link
        href="/dashboard/admin/invite"
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8" cy="7" r="4" />
          <path d="M20 8v6" />
          <path d="M23 11h-6" />
        </svg>
        Invitar Usuario
      </Link>
    );
  }, [canManageOrg]);

  const load = useCallback(async () => {
    if (!orgId || !userId) return;
    const supabase = createClient();
    const roleKey: 'admin' | 'manager' | 'staff' = canManageOrg ? 'admin' : canManageShifts ? 'manager' : 'staff';
    const key = dashboardCacheKey(orgId, userId, roleKey);
    const cached = getCacheEntry<DashboardCacheData>(key, { maxAgeMs: 60_000 }); // 1 minuto

    if (cached) {
      const d = cached.data;
      setFullName(d.fullName);
      setOrgName(d.orgName);
      setTodayShift(d.todayShift);
      setUpcoming(d.upcoming);
      setMonthShiftsCount(d.monthShiftsCount);
      setMonthHours(d.monthHours);
      setMyPendingRequestsCount(d.myPendingRequestsCount);
      setPendingRequestsCount(d.pendingRequestsCount);
      setManagerWeekCount(d.managerWeekCount);
      setManagerWeekHours(d.managerWeekHours);
      setManagerStaffActive(d.managerStaffActive);
      setManagerToday(d.managerToday);
      setAdminMembersCount(d.adminMembersCount);
      setAdminInvitesPending(d.adminInvitesPending);
      setAdminShiftTypesCount(d.adminShiftTypesCount);
    } else {
      setLoadingData(true);
    }
    try {
      // Rango de hoy (para turno actual del usuario)
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);

      // Próximos turnos (14 días)
      const now = new Date();
      const to = new Date(now);
      to.setDate(now.getDate() + 14);

      // Stats del mes actual
      const now0 = new Date();
      const from = new Date(now0.getFullYear(), now0.getMonth(), 1, 0, 0, 0, 0);
      const toMonthEnd = new Date(now0.getFullYear(), now0.getMonth() + 1, 0, 23, 59, 59, 999);

      // Semana actual (lunes-domingo)
      const now2 = new Date();
      const dayIdx = (now2.getDay() + 6) % 7; // 0 = lunes
      const monday = new Date(now2);
      monday.setDate(now2.getDate() - dayIdx);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      // Base (paralelo)
      const [p, o, todayRes, nextRes, monthRes, myPendingRes, pendingReqRes] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
        supabase.from('organizations').select('name').eq('id', orgId).maybeSingle(),
        supabase
          .from('shifts')
          .select(
            `id, start_at, end_at, assigned_user_id, location,
             organization_shift_types (id, name, letter, color)`
          )
          .eq('org_id', orgId)
          .eq('assigned_user_id', userId)
          .gte('end_at', start.toISOString())
          .lte('start_at', end.toISOString())
          .order('start_at', { ascending: true })
          .limit(1),
        supabase
          .from('shifts')
          .select(
            `id, start_at, end_at, assigned_user_id, location,
             organization_shift_types (id, name, letter, color)`
          )
          .eq('org_id', orgId)
          .eq('assigned_user_id', userId)
          .gte('end_at', now.toISOString())
          .lte('start_at', to.toISOString())
          .order('start_at', { ascending: true })
          .limit(3),
        supabase.rpc('shift_hours_stats', {
          p_org_id: orgId,
          p_from: from.toISOString(),
          p_to: toMonthEnd.toISOString(),
          p_user_id: userId,
        }),
        supabase
          .from('shift_requests')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('requester_id', userId)
          .in('status', ['submitted', 'accepted']),
        supabase
          .from('shift_requests')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .in('status', ['submitted', 'accepted']),
      ]);

      const fullNameNext = (p.data as { full_name?: string | null } | null)?.full_name ?? null;
      const orgNameNext = (o.data as { name?: string | null } | null)?.name ?? null;
      setFullName(fullNameNext);
      setOrgName(orgNameNext);

      const t0 = ((todayRes.data ?? [])[0] as ShiftRow | undefined) ?? null;
      const todayShiftNext = t0 ? { ...t0, organization_shift_types: normalizeShiftType(t0.organization_shift_types) } : null;
      setTodayShift(todayShiftNext);

      const list = ((nextRes.data ?? []) as ShiftRow[]).map((s) => ({
        ...s,
        organization_shift_types: normalizeShiftType(s.organization_shift_types),
      }));
      const upcomingNext = list as Array<ShiftRow & { organization_shift_types: ShiftType }>;
      setUpcoming(upcomingNext);

      const monthAgg = (monthRes.data as Array<{ shift_count: number; total_hours: number | string }> | null | undefined)?.[0];
      const monthShiftsCountNext = Number(monthAgg?.shift_count ?? 0);
      const monthHoursNext = Number(monthAgg?.total_hours ?? 0);
      setMonthShiftsCount(monthShiftsCountNext);
      setMonthHours(monthHoursNext);

      const myPendingRequestsCountNext = myPendingRes.count ?? 0;
      const pendingRequestsCountNext = pendingReqRes.count ?? 0;
      setMyPendingRequestsCount(myPendingRequestsCountNext);
      setPendingRequestsCount(pendingRequestsCountNext);

      // Defaults para caché (si no aplica rol)
      let managerWeekCountNext = 0;
      let managerWeekHoursNext = 0;
      let managerStaffActiveNext = 0;
      let managerTodayNext: ManagerCardShift[] = [];
      let adminMembersCountNext = 0;
      let adminInvitesPendingNext = 0;
      let adminShiftTypesCountNext = 0;

      // Manager (solo)
      if (canManageShifts && !canManageOrg) {
        const startToday = new Date();
        startToday.setHours(0, 0, 0, 0);
        const endToday = new Date();
        endToday.setHours(23, 59, 59, 999);
        const nowIso = new Date().toISOString();

        const [weekAggRes, activeRowsRes, todayOrgRes] = await Promise.all([
          supabase.rpc('shift_hours_stats', {
            p_org_id: orgId,
            p_from: monday.toISOString(),
            p_to: sunday.toISOString(),
            p_user_id: null,
          }),
          supabase
            .from('shifts')
            .select('assigned_user_id')
            .eq('org_id', orgId)
            .lte('start_at', nowIso)
            .gte('end_at', nowIso)
            .not('assigned_user_id', 'is', null)
            .limit(500),
          supabase
            .from('shifts')
            .select(
              `id, start_at, end_at, assigned_user_id, location,
               organization_shift_types (id, name, letter, color)`
            )
            .eq('org_id', orgId)
            .gte('start_at', startToday.toISOString())
            .lte('start_at', endToday.toISOString())
            .order('start_at', { ascending: true })
            .limit(10),
        ]);

        const weekAgg = (weekAggRes.data as Array<{ shift_count: number; total_hours: number | string }> | null | undefined)?.[0];
        const weekCount = Number(weekAgg?.shift_count ?? 0);
        const weekHours = Number(weekAgg?.total_hours ?? 0);
        setManagerWeekCount(weekCount);
        managerWeekCountNext = weekCount;
        setManagerWeekHours(weekHours);
        managerWeekHoursNext = weekHours;

        const activeIds = new Set<string>();
        ((activeRowsRes.data ?? []) as Array<{ assigned_user_id: string | null }>).forEach((r) => {
          if (r.assigned_user_id) activeIds.add(r.assigned_user_id);
        });
        setManagerStaffActive(activeIds.size);
        managerStaffActiveNext = activeIds.size;

        const rawToday = ((todayOrgRes.data ?? []) as ShiftRow[]).map((s) => ({
          ...s,
          organization_shift_types: normalizeShiftType(s.organization_shift_types),
        }));
        const ids = [...new Set(rawToday.map((s) => s.assigned_user_id).filter(Boolean))] as string[];
        const namesMap = ids.length > 0 ? await fetchProfilesMap(supabase, ids) : {};
        const todayList: ManagerCardShift[] = rawToday.map((s) => ({
          id: s.id,
          start_at: s.start_at,
          end_at: s.end_at,
          assigned_user_id: s.assigned_user_id,
          assigned_name: s.assigned_user_id ? (namesMap[s.assigned_user_id] ?? null) : null,
          type_name: s.organization_shift_types?.name ?? 'Turno',
          type_letter: s.organization_shift_types?.letter ?? '?',
          type_color: s.organization_shift_types?.color ?? null,
        }));
        setManagerToday(todayList);
        managerTodayNext = todayList;
      }

      // Admin
      if (canManageOrg) {
        const [{ count: membersCount }, { count: invitesPending }, { count: shiftTypesCount }] = await Promise.all([
          supabase.from('memberships').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
          supabase
            .from('organization_invitations')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', orgId)
            .eq('status', 'pending'),
          supabase.from('organization_shift_types').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
        ]);
        setAdminMembersCount(membersCount ?? 0);
        setAdminInvitesPending(invitesPending ?? 0);
        setAdminShiftTypesCount(shiftTypesCount ?? 0);
        adminMembersCountNext = membersCount ?? 0;
        adminInvitesPendingNext = invitesPending ?? 0;
        adminShiftTypesCountNext = shiftTypesCount ?? 0;
      }

      // Guardar caché del dashboard (por org + user + rol)
      setCache<DashboardCacheData>(key, {
        fullName: fullNameNext,
        orgName: orgNameNext,
        todayShift: todayShiftNext,
        upcoming: upcomingNext,
        monthShiftsCount: monthShiftsCountNext,
        monthHours: monthHoursNext,
        myPendingRequestsCount: myPendingRequestsCountNext,
        pendingRequestsCount: pendingRequestsCountNext,
        managerWeekCount: managerWeekCountNext,
        managerWeekHours: managerWeekHoursNext,
        managerStaffActive: managerStaffActiveNext,
        managerToday: managerTodayNext,
        adminMembersCount: adminMembersCountNext,
        adminInvitesPending: adminInvitesPendingNext,
        adminShiftTypesCount: adminShiftTypesCountNext,
      });
    } finally {
      setLoadingData(false);
    }
  }, [orgId, userId, canManageOrg, canManageShifts]);

  useEffect(() => {
    if (!orgId || !userId) return;
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [orgId, userId, load]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
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
        <h1 className="text-xl font-semibold text-text-primary">Dashboard</h1>
        <p className="mt-2 text-sm text-muted">Inicia sesión y asegúrate de tener una organización asignada.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/login" className="text-sm font-medium text-primary-600 hover:text-primary-700">
            Iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardDesktopHeader title={desktopTitle} subtitle={orgName ? `${orgName} • ${roleLabel}` : roleLabel} actions={headerActions} />

      {/* Header mobile (inspirado en "Dashboard - Mobile") */}
      <div className="flex items-center justify-between gap-4 md:hidden">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-text-primary">{greeting}</p>
          <p className="truncate text-sm text-text-secondary">
            {orgName ? `${orgName} • ${roleLabel}` : roleLabel}
          </p>
        </div>
        <Link
          href="/dashboard/notifications"
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background text-text-secondary hover:bg-subtle-bg"
          aria-label="Notificaciones"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
        </Link>
      </div>

      {canManageOrg ? (
        <AdminHome
          loading={loadingData}
          membersCount={adminMembersCount}
          invitesPending={adminInvitesPending}
          shiftTypesCount={adminShiftTypesCount}
          pendingRequestsCount={pendingRequestsCount}
          orgName={orgName}
          fullName={fullName}
        />
      ) : canManageShifts ? (
        <ManagerHome
          loading={loadingData}
          weekCount={managerWeekCount}
          weekHours={managerWeekHours}
          pendingRequestsCount={pendingRequestsCount}
          staffActive={managerStaffActive}
          today={managerToday}
          orgName={orgName}
          fullName={fullName}
        />
      ) : (
        <StaffHome
          loading={loadingData}
          todayShift={todayShift}
          upcoming={upcoming}
          orgName={orgName}
          fullName={fullName}
          monthShiftsCount={monthShiftsCount}
          monthHours={monthHours}
          myPendingRequestsCount={myPendingRequestsCount}
          orgPendingRequestsCount={pendingRequestsCount}
        />
      )}
    </div>
  );
}

function AdminHome({
  loading,
  membersCount,
  invitesPending,
  shiftTypesCount,
  pendingRequestsCount,
  orgName,
  fullName,
}: {
  loading: boolean;
  membersCount: number;
  invitesPending: number;
  shiftTypesCount: number;
  pendingRequestsCount: number;
  orgName: string | null;
  fullName: string | null;
}) {
  return (
    <div className="space-y-6">
      {/* Desktop welcome */}
      <div className="hidden md:block">
        <p className="text-2xl font-bold text-text-primary">
          {fullName?.trim() ? `Bienvenido, ${fullName.trim().split(' ')[0]} 👋` : 'Bienvenido 👋'}
        </p>
        <p className="mt-2 text-sm text-text-secondary">{orgName ? `${orgName} • Admin` : 'Admin'}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6">
        <div className="rounded-2xl border border-border bg-background p-4 md:rounded-xl md:p-6">
          <p className="text-2xl font-bold text-primary-600 md:text-4xl">{loading ? '…' : membersCount}</p>
          <p className="mt-1 text-xs text-muted md:text-sm">Usuarios totales</p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-4 md:rounded-xl md:p-6">
          <p className="text-2xl font-bold text-amber-600 md:text-4xl">{loading ? '…' : pendingRequestsCount}</p>
          <p className="mt-1 text-xs text-muted md:text-sm">Solicitudes pendientes</p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-4 md:rounded-xl md:p-6">
          <p className="text-2xl font-bold text-amber-600 md:text-4xl">{loading ? '…' : invitesPending}</p>
          <p className="mt-1 text-xs text-muted md:text-sm">Invitaciones pendientes</p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-4 md:rounded-xl md:p-6">
          <p className="text-2xl font-bold text-slate-700 md:text-4xl">{loading ? '…' : shiftTypesCount}</p>
          <p className="mt-1 text-xs text-muted md:text-sm">Tipos de turno</p>
        </div>
      </div>

      <div className="space-y-2 md:hidden">
        <p className="text-sm font-semibold text-text-secondary">Administración</p>
        <div className="overflow-hidden rounded-2xl border border-border bg-background md:rounded-xl">
          <MenuRow href="/dashboard/admin/invite" label="Invitar usuarios" />
          <MenuRow href="/dashboard/admin/members" label="Gestión de miembros" />
          <MenuRow href="/dashboard/admin/shift-types" label="Tipos de turno" />
          <MenuRow href="/dashboard/admin/exports" label="Exportar horarios" />
          <MenuRow href="/dashboard/admin/audit" label="Audit log" last />
        </div>
      </div>

      {/* Desktop: acciones rápidas (inspirado en XWjMG) */}
      <div className="hidden md:block">
        <p className="text-base font-semibold text-text-secondary">Administración Rápida</p>
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Link
            href="/dashboard/admin/invite"
            className="flex h-20 flex-col justify-center gap-2 rounded-xl border border-border bg-background p-5 hover:bg-subtle-bg"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-600" aria-hidden>
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8" cy="7" r="4" />
              <path d="M20 8v6" />
              <path d="M23 11h-6" />
            </svg>
            <span className="text-sm font-medium text-text-primary">Invitar usuarios</span>
          </Link>
          <Link
            href="/dashboard/admin/members"
            className="flex h-20 flex-col justify-center gap-2 rounded-xl border border-border bg-background p-5 hover:bg-subtle-bg"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-600" aria-hidden>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span className="text-sm font-medium text-text-primary">Gestionar miembros</span>
          </Link>
          <Link
            href="/dashboard/admin/shift-types"
            className="flex h-20 flex-col justify-center gap-2 rounded-xl border border-border bg-background p-5 hover:bg-subtle-bg"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-600" aria-hidden>
              <path d="M8 2v4" />
              <path d="M16 2v4" />
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M3 10h18" />
              <path d="M16 14v4" />
              <path d="M16 14h3" />
            </svg>
            <span className="text-sm font-medium text-text-primary">Tipos de turno</span>
          </Link>
          <Link
            href="/dashboard/admin/exports"
            className="flex h-20 flex-col justify-center gap-2 rounded-xl border border-border bg-background p-5 hover:bg-subtle-bg"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-600" aria-hidden>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <path d="M7 10l5 5 5-5" />
              <path d="M12 15V3" />
            </svg>
            <span className="text-sm font-medium text-text-primary">Exportar datos</span>
          </Link>
          <Link
            href="/dashboard/admin/audit"
            className="flex h-20 flex-col justify-center gap-2 rounded-xl border border-border bg-background p-5 hover:bg-subtle-bg"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-600" aria-hidden>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M16 13H8" />
              <path d="M16 17H8" />
              <path d="M10 9H8" />
            </svg>
            <span className="text-sm font-medium text-text-primary">Ver audit log</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function ManagerHome({
  loading,
  weekCount,
  weekHours,
  pendingRequestsCount,
  staffActive,
  today,
  orgName,
  fullName,
}: {
  loading: boolean;
  weekCount: number;
  weekHours: number;
  pendingRequestsCount: number;
  staffActive: number;
  today: ManagerCardShift[];
  orgName: string | null;
  fullName: string | null;
}) {
  return (
    <div className="space-y-6">
      {/* Desktop greeting (inspirado en QJp7C) */}
      <div className="hidden md:block">
        <p className="text-2xl font-bold text-text-primary">
          {fullName?.trim() ? `Bienvenido, ${fullName.trim().split(' ')[0]} 👋` : 'Bienvenido 👋'}
        </p>
        <p className="mt-2 text-sm text-text-secondary">{orgName ? `${orgName} • Manager` : 'Manager'}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6">
        <div className="rounded-2xl border border-border bg-background p-4 md:rounded-xl md:p-6">
          <p className="text-2xl font-bold text-primary-600 md:text-4xl">{loading ? '…' : weekCount}</p>
          <p className="mt-1 text-xs text-muted md:text-sm">Turnos esta semana</p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-4 md:rounded-xl md:p-6">
          <p className="text-2xl font-bold text-amber-600 md:text-4xl">{loading ? '…' : pendingRequestsCount}</p>
          <p className="mt-1 text-xs text-muted md:text-sm">Solicitudes pendientes</p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-4 md:rounded-xl md:p-6">
          <p className="text-2xl font-bold text-green-600 md:text-4xl">{loading ? '…' : staffActive}</p>
          <p className="mt-1 text-xs text-muted md:text-sm">Staff activo</p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-4 md:rounded-xl md:p-6">
          <p className="text-2xl font-bold text-slate-700 md:text-4xl">{loading ? '…' : formatHours(weekHours)}</p>
          <p className="mt-1 text-xs text-muted md:text-sm">Horas programadas</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-text-secondary">Acciones Rápidas</p>
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          {/* Desktop */}
          <Link
            href="/dashboard/manager?create=1"
            className="hidden min-h-12 items-center justify-center gap-2 rounded-lg bg-primary-600 px-6 text-sm font-semibold text-white hover:bg-primary-700 md:inline-flex"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            Crear Turno
          </Link>
          <Link
            href="/dashboard/manager/requests"
            className="hidden min-h-12 items-center justify-center gap-2 rounded-lg border border-border bg-background px-6 text-sm font-medium text-text-primary hover:bg-subtle-bg md:inline-flex"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M22 12h-6l-2 3h-4l-2-3H2" />
              <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
            </svg>
            Ver Solicitudes
          </Link>

          {/* Mobile */}
          <LinkButton href="/dashboard/manager?create=1" className="min-h-[56px] rounded-xl md:hidden">
            Nuevo turno
          </LinkButton>
          <LinkButton href="/dashboard/manager/requests" variant="secondary" className="min-h-[56px] rounded-xl md:hidden">
            Ver solicitudes
          </LinkButton>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-text-secondary">Turnos de Hoy</p>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-2xl md:rounded-xl" />
            <Skeleton className="h-20 w-full rounded-2xl md:rounded-xl" />
          </div>
        ) : today.length === 0 ? (
          <div className="rounded-2xl border border-border bg-background p-4 md:rounded-xl">
            <p className="text-sm text-muted">No hay turnos programados para hoy.</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="grid gap-3 md:hidden">
              {today.map((s) => (
                <Link
                  key={s.id}
                  href={`/dashboard/manager?shift=${encodeURIComponent(s.id)}`}
                  className="rounded-2xl border border-border bg-background p-4 hover:bg-subtle-bg md:rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-[52px]">
                      <p className="text-sm font-semibold text-text-primary">
                        {new Date(s.start_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-xs text-muted">
                        {new Date(s.end_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">{s.assigned_name?.trim() || 'Sin asignar'}</p>
                      <p className="mt-0.5 truncate text-sm text-text-secondary">{s.type_name}</p>
                    </div>
                    <ChevronRight />
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop table (QJp7C) */}
            <div className="hidden overflow-hidden rounded-2xl border border-border bg-background md:block md:rounded-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-subtle-bg">
                      <th className="w-[160px] px-5 py-3 text-left text-xs font-semibold text-muted">Horario</th>
                      <th className="w-[180px] px-5 py-3 text-left text-xs font-semibold text-muted">Tipo</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-muted">Staff Asignado</th>
                      <th className="w-[120px] px-5 py-3 text-left text-xs font-semibold text-muted">Estado</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-muted">Abrir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {today.map((s) => (
                      <tr key={s.id} className="border-b border-border last:border-0 hover:bg-subtle-bg/50">
                        <td className="px-5 py-4 font-medium text-text-primary">{formatTimeRange(s.start_at, s.end_at)}</td>
                        <td className="px-5 py-4">
                          <TypePill name={s.type_name} color={s.type_color} />
                        </td>
                        <td className="px-5 py-4 text-text-primary">{s.assigned_name?.trim() || 'Sin asignar'}</td>
                        <td className="px-5 py-4">
                          {(() => {
                            const st = getShiftStatus(s.start_at, s.end_at);
                            return <span className={st.className}>{st.label}</span>;
                          })()}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Link href={`/dashboard/manager?shift=${encodeURIComponent(s.id)}`} className="text-primary-600 hover:text-primary-700">
                            Ver →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StaffHome({
  loading,
  todayShift,
  upcoming,
  orgName,
  fullName,
  monthShiftsCount,
  monthHours,
  myPendingRequestsCount,
  orgPendingRequestsCount,
}: {
  loading: boolean;
  todayShift: (ShiftRow & { organization_shift_types: ShiftType }) | null;
  upcoming: (ShiftRow & { organization_shift_types: ShiftType })[];
  orgName: string | null;
  fullName: string | null;
  monthShiftsCount: number;
  monthHours: number;
  myPendingRequestsCount: number;
  orgPendingRequestsCount: number;
}) {
  const nextShift = upcoming[0] ?? null;
  return (
    <>
      <div className="hidden md:block">
        <p className="text-[28px] font-bold leading-tight text-text-primary">
          {fullName?.trim() ? `Bienvenido, ${fullName.trim().split(' ')[0]} 👋` : 'Bienvenido 👋'}
        </p>
        <p className="mt-2 text-sm text-text-secondary">{orgName ? `${orgName} • Staff` : 'Staff'}</p>
        <p className="mt-2 text-sm text-text-secondary">Aquí tienes un resumen de tus turnos</p>
      </div>

      {/* Desktop metrics + tabla (6sxe4) */}
      <section className="hidden md:block">
        <div className="grid grid-cols-4 gap-6">
          <div className="rounded-xl border border-border bg-background p-6">
            <p className="text-sm text-muted">Turnos este mes</p>
            <p className="mt-2 text-4xl font-bold text-text-primary">{loading ? '…' : monthShiftsCount}</p>
            <p className="mt-2 text-sm text-text-secondary">Asignados a ti</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-6">
            <p className="text-sm text-muted">Horas trabajadas</p>
            <p className="mt-2 text-4xl font-bold text-text-primary">{loading ? '…' : formatHours(monthHours)}</p>
            <p className="mt-2 text-sm text-text-secondary">Este mes</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-6">
            <p className="text-sm text-muted">Próximo turno</p>
            <p className="mt-2 text-4xl font-bold text-primary-600">{loading ? '…' : nextShift ? formatTableDate(nextShift.start_at) : '—'}</p>
            <p className="mt-2 text-sm text-text-secondary">
              {loading
                ? '—'
                : nextShift
                  ? `${formatTimeRange(nextShift.start_at, nextShift.end_at)} • ${nextShift.organization_shift_types?.name ?? 'Turno'}`
                  : 'Sin próximos turnos'}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background p-6">
            <p className="text-sm text-muted">Solicitudes pendientes</p>
            <p className="mt-2 text-4xl font-bold text-amber-600">{loading ? '…' : myPendingRequestsCount}</p>
            <p className="mt-2 text-sm text-text-secondary">{orgPendingRequestsCount > 0 ? 'Intercambios por aprobar' : '—'}</p>
          </div>
        </div>
      </section>

      <section className="hidden space-y-3 md:block">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold text-text-primary">Próximos turnos</p>
          <Link
            href="/dashboard/manager"
            className="min-h-[36px] rounded-lg border border-border bg-background px-3 text-sm font-medium text-text-secondary hover:bg-subtle-bg"
          >
            Ver calendario
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-subtle-bg">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted">Fecha</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted">Tipo</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted">Horario</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted">Ubicación</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-6 text-sm text-muted">
                      Cargando…
                    </td>
                  </tr>
                ) : upcoming.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-6 text-sm text-muted">
                      No tienes turnos próximos.
                    </td>
                  </tr>
                ) : (
                  upcoming.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0 hover:bg-subtle-bg/50">
                      <td className="px-5 py-4 font-medium text-text-primary">{formatTableDate(s.start_at)}</td>
                      <td className="px-5 py-4">
                        <TypeBadge
                          letter={s.organization_shift_types?.letter ?? '?'}
                          name={s.organization_shift_types?.name ?? 'Turno'}
                          color={s.organization_shift_types?.color ?? '#0D9488'}
                        />
                      </td>
                      <td className="px-5 py-4 text-text-secondary">{formatTimeRange(s.start_at, s.end_at)}</td>
                      <td className="px-5 py-4 text-text-secondary">{s.location?.trim() || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Mobile: contenido previo */}
      <section className="space-y-3 md:hidden">
        <p className="text-xs font-semibold tracking-[0.2em] text-muted">TU TURNO HOY</p>
        <div className="rounded-xl border border-border bg-background p-4">
          {loading ? (
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
          ) : todayShift ? (
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-100 text-xl font-bold text-primary-700" aria-hidden>
                {todayShift.organization_shift_types?.letter ?? '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text-primary">{todayShift.organization_shift_types?.name ?? 'Turno'}</p>
                <p className="mt-1 truncate text-sm text-text-secondary">{formatShortDate(todayShift.start_at, todayShift.end_at)}</p>
              </div>
              <Link href="/dashboard/manager" className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-subtle-bg" aria-label="Ver en calendario">
                <ChevronRight />
              </Link>
            </div>
          ) : (
            <p className="text-sm text-muted">No tienes turnos para hoy.</p>
          )}
        </div>
      </section>

      <section className="space-y-3 md:hidden">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold tracking-[0.2em] text-muted">PRÓXIMOS TURNOS</p>
          <Link href="/dashboard/manager" className="text-sm font-medium text-primary-600 hover:text-primary-700">
            Ver todos →
          </Link>
        </div>

        <div className="space-y-3">
          {loading ? (
            <>
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </>
          ) : upcoming.length === 0 ? (
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-sm text-muted">No tienes turnos próximos.</p>
            </div>
          ) : (
            upcoming.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border border-border bg-background p-4">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-background text-sm font-bold text-white"
                  style={{ backgroundColor: s.organization_shift_types?.color ?? '#0D9488' }}
                  aria-hidden
                >
                  {s.organization_shift_types?.letter ?? '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{s.organization_shift_types?.name ?? 'Turno'}</p>
                  <p className="mt-0.5 truncate text-sm text-text-secondary">{formatShortDate(s.start_at, s.end_at)}</p>
                </div>
                <ChevronRight />
              </div>
            ))
          )}
        </div>
      </section>

      <div className="flex flex-wrap gap-3 md:hidden">
        <Link
          href="/dashboard/staff"
          prefetch={true}
          className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
        >
          Ir a mi área
        </Link>
        <Link
          href="/dashboard/notifications"
          prefetch={true}
          className="rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-subtle-bg"
        >
          Notificaciones
        </Link>
        <Link
          href="/dashboard/staff/my-requests"
          prefetch={true}
          className="rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-subtle-bg"
        >
          Solicitudes
        </Link>
      </div>
    </>
  );
}

function MenuRow({ href, label, last = false }: { href: string; label: string; last?: boolean }) {
  return (
    <Link
      href={href}
      prefetch={true}
      className={`flex min-h-[52px] items-center justify-between px-4 text-sm text-text-primary hover:bg-subtle-bg ${last ? '' : 'border-b border-border'}`}
    >
      <span>{label}</span>
      <ChevronRight />
    </Link>
  );
}

