'use client';

import { LogoutButton } from '@/components/auth/LogoutButton';
import { AdminPageMenu } from '@/components/dashboard/AdminPageMenu';
import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { PendingSwapsForYou } from '@/components/requests/PendingSwapsForYou';
import { LinkButton } from '@/components/ui/LinkButton';
import { LiveDot } from '@/components/ui/LiveDot';
import { Pill } from '@/components/ui/Pill';
import { ShiftLetter } from '@/components/ui/ShiftLetter';
import { Skeleton } from '@/components/ui/Skeleton';
import { Stat } from '@/components/ui/Stat';
import { Icons } from '@/components/ui/icons';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { getCacheEntry, setCache } from '@/lib/cache';
import { PENDING_INVITE_TOKEN_KEY } from '@/lib/invite';
import { createClient } from '@/lib/supabase/client';
import { fetchMembershipStaffPositionsMap, fetchProfilesMap } from '@/lib/supabase/queries';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

function formatLongDate(date: Date): string {
  const s = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  // Capitaliza primer carácter
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatTimeOnly(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function shiftDurationHours(startAt: string, endAt: string): number {
  const s = new Date(startAt).getTime();
  const e = new Date(endAt).getTime();
  if (!isFinite(s) || !isFinite(e) || e <= s) return 0;
  return (e - s) / (1000 * 60 * 60);
}

/** "empieza en 14h 32m" / "empieza en 12 min" / "en curso" / "" si ya pasó. */
function timeUntilLabel(startAt: string, endAt: string): string {
  const now = Date.now();
  const s = new Date(startAt).getTime();
  const e = new Date(endAt).getTime();
  if (!isFinite(s)) return '';
  if (now >= s && now <= e) return 'en curso';
  if (now > e) return '';
  const diffMs = s - now;
  const totalMin = Math.floor(diffMs / 60000);
  if (totalMin < 60) return `empieza en ${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h < 24) return `empieza en ${h}h ${m}m`;
  const d = Math.floor(h / 24);
  return `empieza en ${d}d ${h % 24}h`;
}

const SHORT_MONTH = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const SHORT_WEEKDAY = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** Formato compacto "MAR 14" para los bloques fecha del HERO. */
function formatHeroDate(iso: string): { weekday: string; day: number; month: string } {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { weekday: '—', day: 0, month: '—' };
  return {
    weekday: SHORT_WEEKDAY[d.getDay()].toUpperCase(),
    day: d.getDate(),
    month: SHORT_MONTH[d.getMonth()],
  };
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
  const router = useRouter();
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
  const [swapsRefreshKey, setSwapsRefreshKey] = useState(0);

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
    // Saludo personalizado para todos los roles ("Hola, Ana 👋")
    return greeting;
  }, [greeting]);

  const desktopSubtitle = useMemo(() => {
    const today = formatLongDate(new Date());
    return orgName ? `${today} · ${orgName} · ${roleLabel}` : `${today} · ${roleLabel}`;
  }, [orgName, roleLabel]);

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
        const [namesMap, staffPositionsMap] = await Promise.all([
          ids.length > 0 ? fetchProfilesMap(supabase, ids) : ({} as Record<string, string>),
          fetchMembershipStaffPositionsMap(supabase, orgId),
        ]);
        const todayList: ManagerCardShift[] = rawToday.map((s) => {
          const baseName = s.assigned_user_id ? (namesMap[s.assigned_user_id] ?? null) : null;
          const pos = s.assigned_user_id ? staffPositionsMap[s.assigned_user_id] : null;
          const assigned_name = baseName ? (pos ? `${baseName} (${pos})` : baseName) : null;
          return {
          id: s.id,
          start_at: s.start_at,
          end_at: s.end_at,
          assigned_user_id: s.assigned_user_id,
          assigned_name,
          type_name: s.organization_shift_types?.name ?? 'Turno',
          type_letter: s.organization_shift_types?.letter ?? '?',
          type_color: s.organization_shift_types?.color ?? null,
        };
        });
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

  const [redirectingToInvite, setRedirectingToInvite] = useState(false);
  useEffect(() => {
    if (!userId || orgId || typeof window === 'undefined') return;
    const token = sessionStorage.getItem(PENDING_INVITE_TOKEN_KEY);
    if (token) {
      setRedirectingToInvite(true);
      router.replace(`/invite?token=${encodeURIComponent(token)}`);
    }
  }, [userId, orgId, router]);

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
    const isLoggedInNoOrg = !!userId && !orgId;
    return (
      <div className="rounded-xl border border-border bg-background p-6">
        <h1 className="text-xl font-semibold text-text-primary">Dashboard</h1>
        {isLoggedInNoOrg ? (
          <>
            <p className="mt-2 text-sm text-muted">
              No tienes una organización asignada. Si te invitaron, abre el enlace de invitación que te
              enviamos por correo y pulsa «Aceptar invitación».
            </p>
            {redirectingToInvite ? (
              <p className="mt-2 text-sm text-primary-600">Redirigiendo a la invitación…</p>
            ) : (
              <div className="mt-4 flex flex-wrap gap-3">
                <LogoutButton />
              </div>
            )}
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">Inicia sesión y asegúrate de tener una organización asignada.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/login" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                Iniciar sesión
              </Link>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardDesktopHeader title={desktopTitle} subtitle={desktopSubtitle} actions={headerActions} />

      {/* Header mobile — saludo con avatar gradiente. Diseño: ref MHomeStaff. */}
      <div className="flex items-center gap-3 md:hidden">
        <span
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-[14px] font-bold text-white"
          style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))' }}
          aria-hidden
        >
          {(fullName?.trim()?.split(/\s+/).map((s) => s[0]).slice(0, 2).join('') || 'U').toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] text-muted">Hola,</p>
          <p className="tn-h truncate text-[18px] font-bold tracking-[-0.02em] text-text">
            {fullName?.trim() || 'Bienvenido'}
          </p>
        </div>
        {orgName ? (
          <span className="flex items-center gap-1.5 text-[12px] text-muted">
            <Icons.hospital size={13} /> {orgName}
          </span>
        ) : null}
      </div>

      {/* Intercambios pendientes de aceptación - visible para todos los usuarios */}
      <PendingSwapsForYou
        orgId={orgId}
        userId={userId}
        refreshKey={swapsRefreshKey}
        onResolved={() => setSwapsRefreshKey((k) => k + 1)}
      />

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
    <>
      {/* ============== Desktop ============== */}
      <div className="hidden space-y-4 md:block">
        <AdminOverviewHero
          loading={loading}
          pendingRequests={pendingRequestsCount}
          invitesPending={invitesPending}
          membersCount={membersCount}
        />

        {/* Stats row 4 columnas */}
        <div className="grid grid-cols-4 gap-3">
          <Stat
            label="Usuarios totales"
            value={loading ? '…' : membersCount}
            sub="En la organización"
            icon={<Icons.users size={16} />}
            accent="var(--primary)"
          />
          <Stat
            label="Solicitudes pendientes"
            value={loading ? '…' : pendingRequestsCount}
            sub={pendingRequestsCount > 0 ? 'Por aprobar' : 'Sin pendientes'}
            icon={<Icons.swap size={16} />}
            accent="var(--amber)"
          />
          <Stat
            label="Invitaciones pendientes"
            value={loading ? '…' : invitesPending}
            sub={invitesPending > 0 ? 'Sin aceptar' : 'Sin pendientes'}
            icon={<Icons.mail size={16} />}
            accent="var(--blue)"
          />
          <Stat
            label="Tipos de turno"
            value={loading ? '…' : shiftTypesCount}
            sub="Configurados"
            icon={<Icons.cal2 size={16} />}
            accent="var(--violet)"
          />
        </div>

        {/* Hub de cards */}
        <div>
          <h3 className="tn-h mb-3 text-[15px] font-bold text-text">Administración rápida</h3>
          <AdminPageMenu />
        </div>
      </div>

      {/* ============== Mobile ============== */}
      <div className="space-y-5 md:hidden">
        <AdminMobileKpiStrip
          loading={loading}
          members={membersCount}
          pending={pendingRequestsCount}
          invites={invitesPending}
        />
        <div>
          <h3 className="tn-h mb-2.5 text-[14px] font-bold text-text">Administración</h3>
          <AdminPageMenu />
        </div>
      </div>
    </>
  );
}

function AdminOverviewHero({
  loading,
  pendingRequests,
  invitesPending,
  membersCount,
}: {
  loading: boolean;
  pendingRequests: number;
  invitesPending: number;
  membersCount: number;
}) {
  if (loading) {
    return (
      <div
        className="relative overflow-hidden rounded-[20px] p-7 text-white"
        style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)' }}
      >
        <Skeleton className="h-3 w-40 bg-white/20" />
        <Skeleton className="mt-3 h-10 w-72 bg-white/20" />
        <Skeleton className="mt-2 h-4 w-56 bg-white/20" />
      </div>
    );
  }

  const totalAttention = pendingRequests + invitesPending;
  const hasAttention = totalAttention > 0;

  const headline = hasAttention ? 'Hay cosas que requieren tu atención' : 'Tu organización está al día';
  const subtitle = hasAttention
    ? `${pendingRequests} solicitud${pendingRequests === 1 ? '' : 'es'} y ${invitesPending} invitación${invitesPending === 1 ? '' : 'es'} esperando.`
    : `${membersCount} miembro${membersCount === 1 ? '' : 's'} activo${membersCount === 1 ? '' : 's'}, sin pendientes.`;

  return (
    <div
      className="relative overflow-hidden rounded-[20px] p-7 text-white shadow-[0_24px_50px_-28px_var(--primary)]"
      style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)' }}
    >
      <svg
        width="500"
        height="500"
        viewBox="0 0 100 100"
        className="pointer-events-none absolute -right-44 -top-44 opacity-[0.16]"
        aria-hidden
      >
        <circle cx="50" cy="50" r="48" stroke="#fff" strokeWidth=".4" fill="none" />
        <circle cx="50" cy="50" r="34" stroke="#fff" strokeWidth=".4" fill="none" />
        <circle cx="50" cy="50" r="20" stroke="#fff" strokeWidth=".4" fill="none" />
      </svg>

      <div className="relative">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] opacity-90">
          Resumen · Admin
        </p>

        <h2 className="tn-h mt-3 text-[36px] font-bold leading-[1.05] tracking-[-0.025em]">
          {headline}
        </h2>
        <p className="mt-2 max-w-xl text-base opacity-95">{subtitle}</p>

        <div className="mt-6 flex flex-wrap gap-2.5">
          {pendingRequests > 0 ? (
            <Link
              href="/dashboard/manager/requests"
              className="inline-flex h-[42px] items-center gap-1.5 rounded-[11px] bg-white px-4 text-[13.5px] font-bold"
              style={{ color: 'var(--primary-dark)' }}
            >
              <Icons.swap size={15} /> Revisar solicitudes
            </Link>
          ) : null}
          <Link
            href="/dashboard/admin/invite"
            className="inline-flex h-[42px] items-center gap-1.5 rounded-[11px] border border-white/30 bg-white/[0.16] px-4 text-[13.5px] font-semibold text-white"
          >
            <Icons.mail size={15} /> Invitar usuario
          </Link>
          <Link
            href="/dashboard/admin/members"
            className="inline-flex h-[42px] items-center gap-1.5 rounded-[11px] border border-white/30 bg-white/[0.16] px-4 text-[13.5px] font-semibold text-white"
          >
            <Icons.users size={15} /> Ver miembros
          </Link>
        </div>
      </div>
    </div>
  );
}

function AdminMobileKpiStrip({
  loading,
  members,
  pending,
  invites,
}: {
  loading: boolean;
  members: number;
  pending: number;
  invites: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {[
        { v: loading ? '…' : String(members), l: 'Miembros', accent: undefined as string | undefined },
        { v: loading ? '…' : String(pending), l: 'Solicitudes', accent: pending > 0 ? 'var(--amber)' : undefined },
        { v: loading ? '…' : String(invites), l: 'Invitaciones', accent: invites > 0 ? 'var(--blue)' : undefined },
      ].map((m, i) => (
        <div key={i} className="rounded-[14px] border border-border bg-surface p-3">
          <p
            className="tn-h text-[22px] font-extrabold leading-none tracking-[-0.02em]"
            style={m.accent ? { color: m.accent } : undefined}
          >
            {m.v}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-text">{m.l}</p>
        </div>
      ))}
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
    <>
      {/* ============== Desktop ============== */}
      <div className="hidden space-y-4 md:block">
        {/* HERO Acción del día + Solicitudes urgentes */}
        <div className="grid gap-4" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
          <ManagerActionHero
            loading={loading}
            pendingRequestsCount={pendingRequestsCount}
            todayCount={today.length}
            weekCount={weekCount}
          />
          <ManagerUrgentRequestsDesktop
            loading={loading}
            pendingCount={pendingRequestsCount}
          />
        </div>

        {/* Stats row 4 columnas */}
        <div className="grid grid-cols-4 gap-3">
          <Stat
            label="Turnos esta semana"
            value={loading ? '…' : weekCount}
            sub={loading ? '—' : `${formatHours(weekHours)} programadas`}
            icon={<Icons.calendar size={16} />}
            accent="var(--primary)"
          />
          <Stat
            label="Solicitudes pendientes"
            value={loading ? '…' : pendingRequestsCount}
            sub={pendingRequestsCount > 0 ? 'Esperan aprobación' : 'Sin pendientes'}
            icon={<Icons.swap size={16} />}
            accent="var(--amber)"
          />
          <Stat
            label="Staff activo"
            value={loading ? '…' : staffActive}
            sub="De guardia ahora"
            icon={<Icons.stethoscope size={16} />}
            accent="var(--green)"
          />
          <Stat
            label="Horas programadas"
            value={loading ? '…' : formatHours(weekHours)}
            sub="Esta semana"
            icon={<Icons.clock size={16} />}
            accent="var(--blue)"
          />
        </div>

        {/* Listas: Turnos de hoy + (Cobertura semanal + Promo) */}
        <div className="grid gap-4" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
          <ManagerTodayShiftsCard loading={loading} today={today} />
          <div className="flex flex-col gap-4">
            <ManagerWeekCoverageDesktop loading={loading} />
            <ManagerCreateShiftPromo />
          </div>
        </div>
      </div>

      {/* ============== Mobile ============== */}
      <div className="space-y-5 md:hidden">
        <ManagerKpiStrip
          loading={loading}
          weekCount={weekCount}
          weekHours={weekHours}
          pendingRequestsCount={pendingRequestsCount}
        />
        <ManagerCreateShiftCta />
        <ManagerWeekCoverageCard loading={loading} />
        <ManagerUrgentRequestsCard
          loading={loading}
          today={today}
          pendingCount={pendingRequestsCount}
        />
      </div>
    </>
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
      {/* ============== Desktop ============== */}
      <div className="hidden space-y-4 md:block">
        {/* HERO + On-call now */}
        <div className="grid gap-4" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
          <NextShiftHero loading={loading} shift={nextShift} />
          <OnCallNowCard />
        </div>

        {/* Stats row 4 columnas */}
        <div className="grid grid-cols-4 gap-3">
          <Stat
            label="Turnos este mes"
            value={loading ? '…' : monthShiftsCount}
            sub="Asignados a ti"
            icon={<Icons.calendar size={16} />}
            accent="var(--primary)"
          />
          <Stat
            label="Horas trabajadas"
            value={loading ? '…' : formatHours(monthHours)}
            sub="Este mes"
            icon={<Icons.clock size={16} />}
            accent="var(--blue)"
          />
          <Stat
            label="Solicitudes pendientes"
            value={loading ? '…' : myPendingRequestsCount}
            sub={orgPendingRequestsCount > 0 ? 'Por aprobar' : 'Sin pendientes'}
            icon={<Icons.swap size={16} />}
            accent="var(--amber)"
          />
          <Stat
            label="Próximo turno"
            value={loading ? '…' : nextShift ? formatTableDate(nextShift.start_at) : '—'}
            sub={
              loading
                ? '—'
                : nextShift
                  ? `${formatTimeRange(nextShift.start_at, nextShift.end_at)} · ${nextShift.organization_shift_types?.name ?? 'Turno'}`
                  : 'Sin próximos turnos'
            }
            icon={<Icons.trend size={16} />}
            accent="var(--green)"
          />
        </div>

        {/* Listas: próximos turnos + actividad/promo */}
        <div className="grid gap-4" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
          <UpcomingShiftsCard loading={loading} shifts={upcoming} />
          <div className="flex flex-col gap-4">
            <ActivityFeedCard pendingForYou={orgPendingRequestsCount} />
            <OpenShiftsPromoCard />
          </div>
        </div>
      </div>

      {/* ============== Mobile ============== */}
      <div className="space-y-5 md:hidden">
        <MobileNextShiftHero loading={loading} shift={nextShift} />

        <MobileOnCallStrip />

        <MobileMonthStats
          loading={loading}
          shifts={monthShiftsCount}
          hours={monthHours}
          pending={myPendingRequestsCount}
        />

        <MobileQuickActions
          openShiftsHint="Disponibles"
          pendingCount={myPendingRequestsCount}
        />
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────
// StaffHome desktop — sub-componentes
// Diseño: ref docs/design/screens/desktop.jsx DStaffHome (línea 592)
// ────────────────────────────────────────────────────────────

function NextShiftHero({
  loading,
  shift,
}: {
  loading: boolean;
  shift: (ShiftRow & { organization_shift_types: ShiftType }) | null;
}) {
  if (loading) {
    return (
      <div
        className="relative overflow-hidden rounded-[20px] p-7 text-white"
        style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)' }}
      >
        <Skeleton className="h-3 w-40 bg-white/20" />
        <Skeleton className="mt-3 h-10 w-64 bg-white/20" />
        <Skeleton className="mt-2 h-4 w-48 bg-white/20" />
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="flex h-full flex-col justify-center rounded-[20px] border border-border bg-surface p-7">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Tu próximo turno</p>
        <p className="tn-h mt-3 text-[24px] font-bold text-text">No tienes turnos próximos</p>
        <p className="mt-1 text-sm text-text-sec">Disfruta tu descanso. Te avisaremos cuando publiquen nuevos turnos.</p>
      </div>
    );
  }

  const type = shift.organization_shift_types;
  const date = formatHeroDate(shift.start_at);
  const time = `${formatTimeOnly(shift.start_at)} — ${formatTimeOnly(shift.end_at)}`;
  const dur = shiftDurationHours(shift.start_at, shift.end_at);
  const typeName = type?.name ?? 'Turno';
  const location = shift.location?.trim();
  const until = timeUntilLabel(shift.start_at, shift.end_at);

  return (
    <div
      className="relative overflow-hidden rounded-[20px] p-7 text-white shadow-[0_24px_50px_-28px_var(--primary)]"
      style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)' }}
    >
      {/* Patrón concéntrico decorativo */}
      <svg
        width="500"
        height="500"
        viewBox="0 0 100 100"
        className="pointer-events-none absolute -right-44 -top-44 opacity-[0.16]"
        aria-hidden
      >
        <circle cx="50" cy="50" r="48" stroke="#fff" strokeWidth=".4" fill="none" />
        <circle cx="50" cy="50" r="34" stroke="#fff" strokeWidth=".4" fill="none" />
        <circle cx="50" cy="50" r="20" stroke="#fff" strokeWidth=".4" fill="none" />
      </svg>

      <div className="relative">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] opacity-90">
          Tu próximo turno{until ? ` · ${until}` : ''}
        </p>

        <div className="mt-3.5 flex items-end gap-6">
          {/* Bloque fecha 92×92 */}
          <div className="flex h-[92px] w-[92px] flex-col items-center justify-center rounded-[18px] bg-white/[0.18] backdrop-blur">
            <span className="text-[12px] font-bold tracking-[0.08em] opacity-85">{date.weekday}</span>
            <span className="tn-h mt-0.5 text-[44px] font-extrabold leading-none">{date.day}</span>
          </div>

          <div className="min-w-0">
            <h2 className="tn-h text-[32px] font-bold leading-[1.05] tracking-[-0.025em]">
              {typeName}
            </h2>
            <p className="mt-1.5 text-base opacity-95">
              {time}
              {dur > 0 ? ` · ${formatHours(dur)}` : ''}
            </p>
            {location ? (
              <p className="mt-1 flex items-center gap-1.5 text-sm opacity-85">
                <Icons.pin size={14} />
                {location}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex gap-2.5">
          <Link
            href={`/dashboard/my-shifts?shift=${encodeURIComponent(shift.id)}`}
            className="inline-flex h-[42px] items-center gap-1.5 rounded-[11px] bg-white px-4 text-[13.5px] font-bold"
            style={{ color: 'var(--primary-dark)' }}
          >
            <Icons.eye size={15} /> Ver detalle
          </Link>
          <Link
            href={`/dashboard/staff/my-requests?from=${encodeURIComponent(shift.id)}`}
            className="inline-flex h-[42px] items-center gap-1.5 rounded-[11px] border border-white/30 bg-white/[0.16] px-4 text-[13.5px] font-semibold text-white"
          >
            <Icons.swap size={15} /> Solicitar cambio
          </Link>
        </div>
      </div>
    </div>
  );
}

function OnCallNowCard() {
  return (
    <div className="flex h-full flex-col rounded-[20px] border border-border bg-surface p-5">
      <div className="mb-4 flex items-center gap-2">
        <LiveDot color="var(--green)" size={9} />
        <h3 className="tn-h text-base font-bold text-text">De guardia ahora</h3>
        <span className="ml-auto text-[11.5px] text-muted">
          {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center text-center">
        <div>
          <Icons.stethoscope size={32} className="mx-auto text-muted/60" />
          <p className="mt-3 text-sm text-text-sec">Conectando con el equipo activo…</p>
          <Link
            href="/dashboard/active-now"
            className="mt-3 inline-flex h-9 items-center rounded-[10px] border border-border bg-bg px-3 text-[12.5px] font-medium text-text-sec hover:bg-subtle"
          >
            Ver toda la guardia →
          </Link>
        </div>
      </div>
    </div>
  );
}

function UpcomingShiftsCard({
  loading,
  shifts,
}: {
  loading: boolean;
  shifts: (ShiftRow & { organization_shift_types: ShiftType })[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="tn-h text-[15px] font-bold text-text">Próximos turnos</h3>
        <Link href="/dashboard/my-shifts" className="text-[12.5px] font-semibold text-primary">
          Ver calendario →
        </Link>
      </div>
      {loading ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : shifts.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted">No tienes turnos próximos.</p>
      ) : (
        shifts.map((s, i) => {
          const type = s.organization_shift_types;
          const color = type?.color ?? '#14B8A6';
          const date = formatHeroDate(s.start_at);
          const isFirst = i === 0;
          return (
            <Link
              key={s.id}
              href={`/dashboard/my-shifts?shift=${encodeURIComponent(s.id)}`}
              className={
                'relative flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-subtle ' +
                (i < shifts.length - 1 ? 'border-b border-border' : '')
              }
            >
              <span
                aria-hidden
                className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
                style={{ backgroundColor: color }}
              />
              <div className="w-[50px] text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted">{date.weekday}</p>
                <p className="tn-h mt-0.5 text-[22px] font-extrabold leading-none text-text">{date.day}</p>
              </div>
              <ShiftLetter letter={type?.letter ?? '?'} color={color} size={38} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-text">{type?.name ?? 'Turno'}</p>
                <p className="mt-0.5 truncate text-[11.5px] text-muted">
                  {formatTimeRange(s.start_at, s.end_at)}
                  {s.location?.trim() ? ` · ${s.location.trim()}` : ''}
                </p>
              </div>
              {isFirst ? <Pill tone="primary">Empieza pronto</Pill> : null}
              <Icons.chevronR size={16} className="text-muted" />
            </Link>
          );
        })
      )}
    </div>
  );
}

function ActivityFeedCard({ pendingForYou }: { pendingForYou: number }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="tn-h text-[15px] font-bold text-text">Actividad reciente</h3>
        <Link href="/dashboard/notifications" className="text-[12px] font-semibold text-primary">
          Ver todo
        </Link>
      </div>
      <div className="space-y-2">
        <ActivityRow
          icon={<Icons.swap size={13} />}
          color="var(--primary)"
          title={pendingForYou > 0 ? `Tienes ${pendingForYou} solicitud${pendingForYou === 1 ? '' : 'es'} por revisar` : 'Sin solicitudes pendientes'}
          time="ahora"
        />
        <ActivityRow
          icon={<Icons.bell size={13} />}
          color="var(--blue)"
          title="Revisa tus notificaciones recientes"
          time=""
        />
      </div>
    </div>
  );
}

function ActivityRow({
  icon,
  color,
  title,
  time,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  time: string;
}) {
  return (
    <div className="flex gap-2.5 py-1.5">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`, color }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-medium text-text">{title}</p>
        {time ? <p className="mt-0.5 text-[11px] text-muted">{time}</p> : null}
      </div>
    </div>
  );
}

function OpenShiftsPromoCard() {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        borderColor: 'color-mix(in oklab, var(--primary) 30%, transparent)',
        background: 'linear-gradient(135deg, color-mix(in oklab, var(--primary) 10%, transparent), color-mix(in oklab, var(--primary) 4%, transparent))',
      }}
    >
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-primary">
        <Icons.takeOpen size={13} /> Turnos abiertos
      </div>
      <p className="tn-h mt-1.5 text-[22px] font-extrabold tracking-[-0.02em] text-text">Disponibles ahora</p>
      <p className="mt-1 text-[12.5px] leading-[1.5] text-text-sec">
        Hay turnos sin asignar que pueden coincidir con tu disponibilidad.
      </p>
      <Link
        href="/dashboard/open-shifts"
        className="mt-3.5 inline-flex h-[38px] items-center gap-1.5 rounded-[10px] bg-primary px-4 text-[13px] font-semibold text-white"
      >
        Ver turnos abiertos <Icons.arrowR size={14} stroke={2.4} />
      </Link>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// StaffHome mobile — sub-componentes
// Diseño: ref docs/design/screens/mobile.jsx MHomeStaff (línea 157)
// ────────────────────────────────────────────────────────────

function MobileNextShiftHero({
  loading,
  shift,
}: {
  loading: boolean;
  shift: (ShiftRow & { organization_shift_types: ShiftType }) | null;
}) {
  if (loading) {
    return (
      <div
        className="relative overflow-hidden rounded-[22px] p-5 text-white"
        style={{ background: 'linear-gradient(150deg, var(--primary) 0%, var(--primary-dark) 100%)' }}
      >
        <Skeleton className="h-3 w-32 bg-white/20" />
        <Skeleton className="mt-3 h-7 w-48 bg-white/20" />
        <Skeleton className="mt-2 h-3 w-40 bg-white/20" />
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="rounded-[22px] border border-border bg-surface p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Tu próximo turno</p>
        <p className="tn-h mt-2 text-[20px] font-bold text-text">Sin turnos próximos</p>
        <p className="mt-1 text-[13px] text-text-sec">Te avisaremos cuando publiquen nuevos turnos.</p>
      </div>
    );
  }

  const type = shift.organization_shift_types;
  const date = formatHeroDate(shift.start_at);
  const time = `${formatTimeOnly(shift.start_at)} — ${formatTimeOnly(shift.end_at)}`;
  const dur = shiftDurationHours(shift.start_at, shift.end_at);
  const typeName = type?.name ?? 'Turno';
  const location = shift.location?.trim();
  const until = timeUntilLabel(shift.start_at, shift.end_at);

  return (
    <div
      className="relative overflow-hidden rounded-[22px] p-5 text-white shadow-[0_14px_30px_-16px_var(--primary)]"
      style={{ background: 'linear-gradient(150deg, var(--primary) 0%, var(--primary-dark) 100%)' }}
    >
      <svg
        width="240"
        height="240"
        viewBox="0 0 100 100"
        className="pointer-events-none absolute -right-16 -top-16 opacity-[0.18]"
        aria-hidden
      >
        <circle cx="50" cy="50" r="40" stroke="#fff" strokeWidth="0.6" fill="none" />
        <circle cx="50" cy="50" r="28" stroke="#fff" strokeWidth="0.6" fill="none" />
        <circle cx="50" cy="50" r="16" stroke="#fff" strokeWidth="0.6" fill="none" />
      </svg>

      <div className="relative flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] opacity-90">Tu próximo turno</p>
        {until ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.18] px-2.5 py-1 text-[11px] font-semibold">
            <span className="tn-blink h-[7px] w-[7px] rounded-full bg-white" />
            {until.replace('empieza en ', 'En ')}
          </span>
        ) : null}
      </div>

      <div className="relative mt-3.5 flex items-end gap-3.5">
        <div className="flex h-16 w-16 flex-col items-center justify-center rounded-[18px] bg-white/[0.18] backdrop-blur">
          <span className="text-[10px] font-bold tracking-[0.06em] opacity-85">{date.weekday}</span>
          <span className="tn-h mt-0.5 text-[28px] font-extrabold leading-none">{date.day}</span>
        </div>
        <div className="min-w-0">
          <h2 className="tn-h truncate text-[22px] font-bold leading-[1.1] tracking-[-0.02em]">
            {typeName}
          </h2>
          <p className="mt-1 text-[14px] opacity-95">
            {time}
            {dur > 0 ? ` · ${formatHours(dur)}` : ''}
          </p>
          {location ? (
            <p className="mt-0.5 flex items-center gap-1 text-[13px] opacity-85">
              <Icons.pin size={12} /> {location}
            </p>
          ) : null}
        </div>
      </div>

      <div className="relative mt-4 flex gap-2">
        <Link
          href={`/dashboard/my-shifts?shift=${encodeURIComponent(shift.id)}`}
          className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[12px] bg-white/95 text-[13.5px] font-bold"
          style={{ color: 'var(--primary-dark)' }}
        >
          <Icons.eye size={15} /> Ver detalle
        </Link>
        <Link
          href={`/dashboard/staff/my-requests?from=${encodeURIComponent(shift.id)}`}
          className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[12px] border border-white/30 bg-white/[0.18] text-[13.5px] font-semibold text-white"
        >
          <Icons.swap size={15} /> Solicitar cambio
        </Link>
      </div>
    </div>
  );
}

function MobileOnCallStrip() {
  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LiveDot color="var(--green)" size={8} />
          <h3 className="tn-h text-base font-bold tracking-[-0.015em] text-text">De guardia ahora</h3>
        </div>
        <Link href="/dashboard/active-now" className="text-[12px] font-semibold text-primary">
          Ver todos →
        </Link>
      </div>
      <Link
        href="/dashboard/active-now"
        className="flex items-center gap-3 rounded-[16px] border border-dashed border-border bg-surface px-4 py-3.5"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-subtle text-text-sec">
          <Icons.stethoscope size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-text">Consulta el equipo activo</p>
          <p className="text-[11.5px] text-muted">Quién está cubriendo ahora mismo</p>
        </div>
        <Icons.chevronR size={16} className="text-muted" />
      </Link>
    </div>
  );
}

function MobileMonthStats({
  loading,
  shifts,
  hours,
  pending,
}: {
  loading: boolean;
  shifts: number;
  hours: number;
  pending: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {[
        { v: loading ? '…' : String(shifts), l: 'Turnos', sub: 'este mes', accent: undefined as string | undefined },
        { v: loading ? '…' : formatHours(hours), l: 'Horas', sub: 'trabajadas', accent: undefined },
        { v: loading ? '…' : String(pending), l: 'Solicitudes', sub: 'pendientes', accent: pending > 0 ? 'var(--amber)' : undefined },
      ].map((m, i) => (
        <div key={i} className="rounded-[14px] border border-border bg-surface p-3">
          <p
            className="tn-h text-[22px] font-extrabold leading-none tracking-[-0.02em]"
            style={m.accent ? { color: m.accent } : undefined}
          >
            {m.v}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-text">{m.l}</p>
          <p className="text-[11px] text-muted">{m.sub}</p>
        </div>
      ))}
    </div>
  );
}

function MobileQuickActions({
  openShiftsHint,
  pendingCount,
}: {
  openShiftsHint: string;
  pendingCount: number;
}) {
  const actions: Array<{
    href: string;
    label: string;
    sub: string;
    icon: React.ReactNode;
    color: string;
  }> = [
    { href: '/dashboard/open-shifts', label: 'Turnos abiertos', sub: openShiftsHint, icon: <Icons.takeOpen size={18} />, color: 'var(--primary)' },
    { href: '/dashboard/staff/availability', label: 'Mi disponibilidad', sub: 'Vacaciones, libres…', icon: <Icons.beach size={18} />, color: 'var(--blue)' },
    { href: '/dashboard/staff/my-requests', label: 'Mis solicitudes', sub: pendingCount > 0 ? `${pendingCount} pendiente${pendingCount === 1 ? '' : 's'}` : 'Sin pendientes', icon: <Icons.swap size={18} />, color: 'var(--amber)' },
    { href: '/dashboard/staff', label: 'Compañeros', sub: 'Ver equipo', icon: <Icons.users size={18} />, color: 'var(--violet)' },
  ];

  return (
    <div>
      <h3 className="tn-h mb-2.5 text-[14px] font-bold text-text">Acciones rápidas</h3>
      <div className="grid grid-cols-2 gap-2.5">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex flex-col gap-2 rounded-[16px] border border-border bg-surface p-3.5"
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-[11px]"
              style={{ backgroundColor: `color-mix(in oklab, ${a.color} 14%, transparent)`, color: a.color }}
            >
              {a.icon}
            </span>
            <div>
              <p className="text-[13px] font-semibold text-text">{a.label}</p>
              <p className="mt-0.5 text-[11.5px] text-muted">{a.sub}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// ManagerHome mobile — sub-componentes
// Diseño: ref docs/design/screens/mobile.jsx MManagerHome (línea 935)
// ────────────────────────────────────────────────────────────

function ManagerKpiStrip({
  loading,
  weekCount,
  weekHours,
  pendingRequestsCount,
}: {
  loading: boolean;
  weekCount: number;
  weekHours: number;
  pendingRequestsCount: number;
}) {
  const coveragePct = weekCount > 0 ? Math.min(100, Math.round((weekHours / (weekCount * 8)) * 100)) : 0;
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-2xl border border-border bg-surface p-3.5">
        <p className="text-[11px] font-semibold text-muted">Esta semana</p>
        <p className="tn-h mt-0.5 text-[26px] font-extrabold leading-none tracking-[-0.02em] text-text">
          {loading ? '…' : weekCount}{' '}
          <span className="text-[13px] font-semibold text-muted">turnos</span>
        </p>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-subtle-2">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${loading ? 0 : Math.min(100, coveragePct)}%` }}
          />
        </div>
        <p className="mt-1 text-[11px] text-muted">
          {loading ? '—' : `${formatHours(weekHours)} programadas`}
        </p>
      </div>
      <div
        className="rounded-2xl border p-3.5"
        style={{
          borderColor: 'color-mix(in oklab, var(--amber) 55%, transparent)',
          backgroundColor: 'color-mix(in oklab, var(--amber) 8%, transparent)',
        }}
      >
        <p className="text-[11px] font-bold text-amber">Atención</p>
        <p
          className="tn-h mt-0.5 text-[26px] font-extrabold leading-none tracking-[-0.02em]"
          style={{ color: 'var(--amber)' }}
        >
          {loading ? '…' : pendingRequestsCount}
        </p>
        <p className="mt-1 text-[11.5px] font-medium text-text">Solicitudes pendientes</p>
      </div>
    </div>
  );
}

function ManagerCreateShiftCta() {
  return (
    <Link
      href="/dashboard/manager?create=1"
      className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-white shadow-[0_12px_26px_-12px_var(--primary)]"
    >
      <Icons.plus size={18} stroke={2.6} /> Crear nuevo turno
    </Link>
  );
}

/**
 * Tarjeta de cobertura semanal (7 mini-cards).
 * Datos: por ahora estáticos demo — pendiente conectar endpoint de cobertura por día.
 */
function ManagerWeekCoverageCard({ loading }: { loading: boolean }) {
  const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  // Cobertura de demo (mockup). Se reemplazará con datos reales cuando estén disponibles.
  const cov = [100, 100, 95, 80, 60, 100, 75];

  function colorFor(pct: number): string {
    if (pct >= 95) return 'var(--green)';
    if (pct >= 80) return 'var(--primary)';
    if (pct >= 70) return 'var(--amber)';
    return 'var(--red)';
  }

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="tn-h text-[14px] font-bold text-text">Cobertura semanal</h3>
        <Link href="/dashboard/manager" className="text-[12px] font-semibold text-primary">
          Ver calendario →
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const pct = loading ? 0 : cov[i];
          const c = colorFor(pct);
          return (
            <div key={d} className="rounded-xl border border-border bg-surface px-1 py-2.5 text-center">
              <p className="text-[10px] font-semibold text-muted">{d}</p>
              <p
                className="tn-h mt-1 text-[14px] font-bold leading-none"
                style={{ color: c }}
              >
                {loading ? '…' : `${pct}%`}
              </p>
              <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-subtle-2">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ManagerUrgentRequestsCard({
  loading,
  today,
  pendingCount,
}: {
  loading: boolean;
  today: ManagerCardShift[];
  pendingCount: number;
}) {
  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="tn-h text-[14px] font-bold text-text">
          {pendingCount > 0 ? 'Solicitudes urgentes' : 'Turnos de hoy'}
        </h3>
        <Link
          href={pendingCount > 0 ? '/dashboard/manager/requests' : '/dashboard/manager'}
          className="text-[12px] font-semibold text-primary"
        >
          Ver todo →
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : pendingCount > 0 ? (
        <Link
          href="/dashboard/manager/requests"
          className="block rounded-2xl border border-border bg-surface p-3.5"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-amber-soft text-amber">
              <Icons.swap size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-text">
                {pendingCount} solicitud{pendingCount === 1 ? '' : 'es'} pendiente{pendingCount === 1 ? '' : 's'}
              </p>
              <p className="mt-0.5 text-[11.5px] text-muted">Toca para revisar y aprobar</p>
            </div>
            <Pill tone="amber">Pendiente{pendingCount === 1 ? '' : 's'}</Pill>
          </div>
        </Link>
      ) : today.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm text-muted">No hay turnos programados para hoy.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {today.slice(0, 3).map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/manager?shift=${encodeURIComponent(s.id)}`}
              className="block rounded-2xl border border-border bg-surface p-3.5"
            >
              <div className="flex items-center gap-3">
                <ShiftLetter
                  letter={s.type_letter || '?'}
                  color={s.type_color || '#14B8A6'}
                  size={38}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-text">
                    {s.assigned_name?.trim() || 'Sin asignar'}
                  </p>
                  <p className="mt-0.5 truncate text-[11.5px] text-muted">
                    {formatTimeRange(s.start_at, s.end_at)} · {s.type_name}
                  </p>
                </div>
                <Icons.chevronR size={16} className="text-muted" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// ManagerHome desktop — sub-componentes
// Diseño: ref docs/design/screens/desktop.jsx (DStaffHome adaptado a manager) + extras2
// ────────────────────────────────────────────────────────────

function ManagerActionHero({
  loading,
  pendingRequestsCount,
  todayCount,
  weekCount,
}: {
  loading: boolean;
  pendingRequestsCount: number;
  todayCount: number;
  weekCount: number;
}) {
  if (loading) {
    return (
      <div
        className="relative overflow-hidden rounded-[20px] p-7 text-white"
        style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)' }}
      >
        <Skeleton className="h-3 w-40 bg-white/20" />
        <Skeleton className="mt-3 h-10 w-72 bg-white/20" />
        <Skeleton className="mt-2 h-4 w-56 bg-white/20" />
      </div>
    );
  }

  const hasPending = pendingRequestsCount > 0;
  const subtitle = hasPending
    ? `Tienes ${pendingRequestsCount} solicitud${pendingRequestsCount === 1 ? '' : 'es'} esperando aprobación.`
    : `Tu equipo va al día. ${todayCount} turno${todayCount === 1 ? '' : 's'} hoy · ${weekCount} esta semana.`;

  const headline = hasPending ? 'Acción del día' : 'Buen ritmo de equipo';

  return (
    <div
      className="relative overflow-hidden rounded-[20px] p-7 text-white shadow-[0_24px_50px_-28px_var(--primary)]"
      style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)' }}
    >
      <svg
        width="500"
        height="500"
        viewBox="0 0 100 100"
        className="pointer-events-none absolute -right-44 -top-44 opacity-[0.16]"
        aria-hidden
      >
        <circle cx="50" cy="50" r="48" stroke="#fff" strokeWidth=".4" fill="none" />
        <circle cx="50" cy="50" r="34" stroke="#fff" strokeWidth=".4" fill="none" />
        <circle cx="50" cy="50" r="20" stroke="#fff" strokeWidth=".4" fill="none" />
      </svg>

      <div className="relative">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] opacity-90">
          {hasPending ? 'Atención · Manager' : 'Resumen · Manager'}
        </p>

        <h2 className="tn-h mt-3 text-[36px] font-bold leading-[1.05] tracking-[-0.025em]">
          {headline}
        </h2>
        <p className="mt-2 max-w-xl text-base opacity-95">{subtitle}</p>

        <div className="mt-6 flex gap-2.5">
          <Link
            href="/dashboard/manager/requests"
            className="inline-flex h-[42px] items-center gap-1.5 rounded-[11px] bg-white px-4 text-[13.5px] font-bold"
            style={{ color: 'var(--primary-dark)' }}
          >
            <Icons.swap size={15} /> {hasPending ? 'Revisar solicitudes' : 'Ver solicitudes'}
          </Link>
          <Link
            href="/dashboard/manager?create=1"
            className="inline-flex h-[42px] items-center gap-1.5 rounded-[11px] border border-white/30 bg-white/[0.16] px-4 text-[13.5px] font-semibold text-white"
          >
            <Icons.plus size={15} stroke={2.6} /> Crear nuevo turno
          </Link>
          <div className="ml-auto inline-flex h-[42px] items-center gap-1.5 rounded-[11px] bg-white/[0.12] px-4 text-[12px]">
            <Icons.calendar size={13} /> {weekCount} turnos esta semana
          </div>
        </div>
      </div>
    </div>
  );
}

function ManagerUrgentRequestsDesktop({
  loading,
  pendingCount,
}: {
  loading: boolean;
  pendingCount: number;
}) {
  if (loading) {
    return (
      <div className="rounded-[20px] border border-border bg-surface p-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-4 h-12 w-full" />
      </div>
    );
  }
  if (pendingCount === 0) {
    return (
      <div className="flex h-full flex-col rounded-[20px] border border-border bg-surface p-5">
        <h3 className="tn-h text-base font-bold text-text">Solicitudes urgentes</h3>
        <div className="flex flex-1 items-center justify-center text-center">
          <div>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-soft text-green">
              <Icons.check size={20} stroke={2.6} />
            </span>
            <p className="mt-3 text-[13.5px] font-medium text-text">Sin solicitudes pendientes</p>
            <p className="mt-1 text-[12px] text-muted">Tu equipo está al día.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-[20px] border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h3 className="tn-h text-base font-bold text-text">Solicitudes urgentes</h3>
        <Pill tone="amber">{pendingCount}</Pill>
      </div>
      <p className="mt-2 text-[13px] text-text-sec">
        Hay solicitudes esperando tu aprobación. Revisa la bandeja para gestionarlas.
      </p>
      <Link
        href="/dashboard/manager/requests"
        className="mt-auto inline-flex h-[42px] items-center justify-center gap-1.5 rounded-[11px] bg-primary text-[13.5px] font-bold text-white"
      >
        <Icons.inbox size={15} /> Ir a la bandeja
      </Link>
    </div>
  );
}

function ManagerTodayShiftsCard({
  loading,
  today,
}: {
  loading: boolean;
  today: ManagerCardShift[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="tn-h text-[15px] font-bold text-text">Turnos de hoy</h3>
        <Link href="/dashboard/manager" className="text-[12.5px] font-semibold text-primary">
          Ver calendario →
        </Link>
      </div>
      {loading ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : today.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted">No hay turnos programados para hoy.</p>
      ) : (
        today.slice(0, 6).map((s, i) => {
          const status = getShiftStatus(s.start_at, s.end_at);
          const isUnassigned = !s.assigned_name?.trim();
          return (
            <Link
              key={s.id}
              href={`/dashboard/manager?shift=${encodeURIComponent(s.id)}`}
              className={
                'flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-subtle ' +
                (i < Math.min(today.length, 6) - 1 ? 'border-b border-border' : '')
              }
            >
              <div className="w-[110px] text-[12px] text-text-sec">
                {formatTimeRange(s.start_at, s.end_at)}
              </div>
              <ShiftLetter
                letter={s.type_letter || '?'}
                color={s.type_color || '#14B8A6'}
                size={38}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-text">
                  {isUnassigned ? 'Sin asignar' : s.assigned_name}
                </p>
                <p className="mt-0.5 truncate text-[11.5px] text-muted">{s.type_name}</p>
              </div>
              {isUnassigned ? (
                <Pill tone="amber">Vacante</Pill>
              ) : (
                <span className={status.className + ' text-[12px] font-semibold'}>{status.label}</span>
              )}
              <Icons.chevronR size={16} className="text-muted" />
            </Link>
          );
        })
      )}
    </div>
  );
}

function ManagerWeekCoverageDesktop({ loading }: { loading: boolean }) {
  // Datos demo (mockup). Sustituir cuando exista endpoint de cobertura por día.
  const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const cov = [100, 100, 95, 80, 60, 100, 75];

  function colorFor(pct: number): string {
    if (pct >= 95) return 'var(--green)';
    if (pct >= 80) return 'var(--primary)';
    if (pct >= 70) return 'var(--amber)';
    return 'var(--red)';
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="tn-h text-[15px] font-bold text-text">Cobertura semanal</h3>
        <Link href="/dashboard/manager" className="text-[12px] font-semibold text-primary">
          Ver →
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d, i) => {
          const pct = loading ? 0 : cov[i];
          const c = colorFor(pct);
          return (
            <div key={d} className="rounded-xl border border-border bg-bg px-1 py-2.5 text-center">
              <p className="text-[10px] font-semibold text-muted">{d}</p>
              <p className="tn-h mt-1 text-[14px] font-bold leading-none" style={{ color: c }}>
                {loading ? '…' : `${pct}%`}
              </p>
              <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-subtle-2">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ManagerCreateShiftPromo() {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        borderColor: 'color-mix(in oklab, var(--primary) 30%, transparent)',
        background: 'linear-gradient(135deg, color-mix(in oklab, var(--primary) 10%, transparent), color-mix(in oklab, var(--primary) 4%, transparent))',
      }}
    >
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-primary">
        <Icons.plus size={13} stroke={2.6} /> Plantilla rápida
      </div>
      <p className="tn-h mt-1.5 text-[22px] font-extrabold tracking-[-0.02em] text-text">Crea un turno</p>
      <p className="mt-1 text-[12.5px] leading-[1.5] text-text-sec">
        Genera un nuevo turno con tipo, fecha y miembro asignado.
      </p>
      <Link
        href="/dashboard/manager?create=1"
        className="mt-3.5 inline-flex h-[38px] items-center gap-1.5 rounded-[10px] bg-primary px-4 text-[13px] font-semibold text-white"
      >
        Crear nuevo <Icons.arrowR size={14} stroke={2.4} />
      </Link>
    </div>
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

