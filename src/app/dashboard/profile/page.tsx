'use client';

import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { ThemeSelect } from '@/components/theme/theme';
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

type UserOrg = {
  id: string;
  name: string;
  role: string;
  parentId?: string | null;
};

function roleToLabel(role: string): string {
  switch (role) {
    case 'superadmin':
      return 'Superadmin';
    case 'org_admin':
      return 'Admin';
    case 'team_manager':
      return 'Manager';
    case 'user':
      return 'Staff';
    case 'viewer':
      return 'Viewer';
    default:
      return role;
  }
}

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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ monthShifts: 0, monthHours: 0, approvedRequests: 0 });
  const [userOrganizations, setUserOrganizations] = useState<UserOrg[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const roleLabel = useMemo(() => {
    if (canManageOrg) return 'Admin';
    if (canManageShifts) return 'Manager';
    return 'Staff';
  }, [canManageOrg, canManageShifts]);

  const load = useCallback(async () => {
    if (!orgId || !userId) return;
    setLoadingData(true);
    const supabase = createClient();

    const [{ data: prof }, { data: org }, { data: au }, { data: accessibleOrgs }] = await Promise.all([
      supabase.from('profiles').select('full_name, avatar_url').eq('id', userId).maybeSingle(),
      supabase.from('organizations').select('name').eq('id', orgId).maybeSingle(),
      supabase.auth.getUser(),
      supabase.rpc('get_my_accessible_organizations'),
    ]);

    setFullName((prof as { full_name?: string | null; avatar_url?: string | null } | null)?.full_name ?? null);
    setAvatarUrl((prof as { full_name?: string | null; avatar_url?: string | null } | null)?.avatar_url ?? null);
    setOrgName((org as { name?: string | null } | null)?.name ?? null);
    setEmail(au.user?.email ?? null);

    const orgs: UserOrg[] = ((accessibleOrgs ?? []) as { id: string; name: string; parent_id: string | null; role: string }[])
      .map((r) => {
        if (!r?.id || !r?.name) return null;
        return { id: r.id, name: r.name, role: r.role ?? 'viewer', parentId: r.parent_id ?? null };
      })
      .filter((o): o is UserOrg => o !== null)
      .sort((a, b) => {
        if (a.parentId && !b.parentId) return 1;
        if (!a.parentId && b.parentId) return -1;
        if (a.parentId && b.parentId && a.parentId !== b.parentId) return a.parentId.localeCompare(b.parentId) || a.name.localeCompare(b.name);
        return a.name.localeCompare(b.name);
      });
    setUserOrganizations(orgs);

    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const { data: monthAgg } = await supabase.rpc('shift_hours_stats', {
      p_org_id: orgId,
      p_from: from.toISOString(),
      p_to: to.toISOString(),
      p_user_id: userId,
    });
    const row = (monthAgg as Array<{ shift_count: number; total_hours: number | string }> | null | undefined)?.[0];
    const monthShifts = Number(row?.shift_count ?? 0);
    const monthHours = Number(row?.total_hours ?? 0);

    const { count: approvedRequests } = await supabase
      .from('shift_requests')
      .select('id', { count: 'exact', head: true })
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

  const handleSaveProfile = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!userId) return;
      setProfileError(null);
      setProfileSuccess(null);
      setSavingProfile(true);
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ full_name: (fullName ?? '').trim() || null })
        .eq('id', userId);
      setSavingProfile(false);
      if (updateError) {
        setProfileError('No se pudieron guardar los cambios. Intenta de nuevo.');
        return;
      }
      setProfileSuccess('Perfil actualizado.');
      window.setTimeout(() => setProfileSuccess(null), 2500);
    },
    [userId, fullName]
  );

  const handleAvatarChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !userId) return;
      setProfileError(null);
      setProfileSuccess(null);
      setUploadingAvatar(true);
      const supabase = createClient();

      try {
        const fileExt = file.name.split('.').pop() ?? 'jpg';
        const filePath = `${userId}-${Date.now()}.${fileExt}`;

        // Usa el bucket "avatars" (debe existir en Supabase y ser público)
        const bucket = 'avatars';

        const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file, {
          upsert: true,
        });
        if (uploadError) {
          setProfileError('No se pudo subir la foto. Intenta con otra imagen.');
          setUploadingAvatar(false);
          return;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from(bucket).getPublicUrl(filePath);

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar_url: publicUrl })
          .eq('id', userId);
        if (updateError) {
          setProfileError('No se pudo guardar la foto de perfil.');
          setUploadingAvatar(false);
          return;
        }

        setAvatarUrl(publicUrl);
        setProfileSuccess('Foto de perfil actualizada.');
        window.setTimeout(() => setProfileSuccess(null), 2500);
      } finally {
        setUploadingAvatar(false);
      }
    },
    [userId]
  );

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
        <h1 className="text-xl font-semibold text-text-primary">Preferencia y perfil</h1>
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
      <DashboardDesktopHeader title="Preferencia y perfil" subtitle={orgName ? `${orgName} • ${roleLabel}` : roleLabel} />

      {/* Header (móvil) */}
      <div className="flex items-center justify-center md:hidden">
        <h1 className="text-lg font-semibold text-text-primary">Preferencia y perfil</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-[320px_1fr] md:gap-8">
        {/* Left */}
        <div className="space-y-4 md:space-y-6">
          <div className="rounded-2xl border border-border bg-background p-5 md:p-8">
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={name}
                    className="h-20 w-20 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-100 text-[28px] font-semibold text-primary-700">
                    {initials(fullName)}
                  </div>
                )}
                <label className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                  <span className="text-[0.7rem] font-medium text-text-secondary">{uploadingAvatar ? '…' : '✎'}</span>
                </label>
              </div>

              <p className="mt-4 text-xl font-semibold text-text-primary">{name}</p>
              <span className="mt-3 inline-flex h-7 items-center rounded-full bg-primary-50 px-3 text-[13px] font-medium text-primary-700">
                {roleLabel}
              </span>
              {orgName ? <p className="mt-2 text-sm text-text-secondary">{orgName}</p> : null}
              {email ? <p className="mt-2 text-xs text-muted md:hidden">{email}</p> : null}
              <p className="mt-3 text-xs text-muted">Puedes actualizar tu foto haciendo clic en el icono sobre el avatar.</p>
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

          <div className="rounded-2xl border border-border bg-background p-5 md:rounded-xl md:p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Organizaciones</h3>
            {loadingData ? (
              <p className="text-sm text-muted">Cargando…</p>
            ) : userOrganizations.length === 0 ? (
              <p className="text-sm text-muted">No perteneces a ninguna organización.</p>
            ) : (
              <ul className="space-y-2">
                {userOrganizations.map((o) => (
                  <li
                    key={o.id}
                    className={`flex items-center justify-between gap-2 rounded-lg border border-border bg-subtle-bg/50 px-3 py-2 ${o.parentId ? 'pl-5' : ''}`}
                  >
                    {o.parentId ? <span className="text-muted mr-1 shrink-0">↳</span> : null}
                    <span className="min-w-0 truncate text-sm font-medium text-text-primary">{o.name}</span>
                    <span className="shrink-0 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700">
                      {roleToLabel(o.role)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="space-y-4">
          <p className="hidden text-base font-semibold text-text-secondary md:block">Configuración</p>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-border bg-background p-5 md:rounded-xl md:p-6 space-y-4">
              <h2 className="text-sm font-semibold text-text-primary">Datos de perfil</h2>

              {profileError && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-xs text-red-700" role="alert">
                  {profileError}
                </div>
              )}
              {profileSuccess && (
                <div className="rounded-lg bg-green-50 px-4 py-3 text-xs text-green-800" role="status">
                  {profileSuccess}
                </div>
              )}

              <div className="space-y-1">
                <label htmlFor="full_name" className="text-xs font-medium text-text-secondary">
                  Nombre completo
                </label>
                <input
                  id="full_name"
                  type="text"
                  value={fullName ?? ''}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-muted focus-visible:outline-none"
                  placeholder="Tu nombre y apellido"
                />
                <p className="text-[11px] text-muted">Este nombre se muestra a tu equipo en los turnos y solicitudes.</p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-text-secondary">Correo electrónico</span>
                <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-subtle-bg px-3 py-2">
                  <span className="truncate text-xs text-text-secondary">{email ?? 'Sin correo'}</span>
                  <span className="text-[11px] text-muted">No editable desde aquí</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="inline-flex min-h-[36px] items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-60"
                >
                  {savingProfile ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </form>

          <div className="overflow-hidden rounded-2xl border border-border bg-background p-5 md:rounded-xl md:p-5 space-y-4">
            <h2 className="text-sm font-semibold text-text-primary">Preferencias</h2>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-text-secondary">Apariencia</span>
              <ThemeSelect className="min-h-[36px] w-[140px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none" />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-background md:rounded-xl">
            <MenuLink href="/dashboard/notifications" label="Notificaciones" icon="bell" />
            <MenuLink href="/dashboard/staff/availability" label="Mi disponibilidad" icon="calendar" />
            <MenuLink href="/forgot-password" label="Cambiar contraseña" icon="lock" />
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

function Icon({ name }: { name: 'pencil' | 'bell' | 'calendar' | 'log-out' | 'lock' }) {
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
    case 'lock':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
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

