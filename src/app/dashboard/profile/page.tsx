'use client';

/**
 * Página "Mi perfil": hero con avatar + nombre + pills, 3 KPIs y secciones
 * Cuenta / Aplicación / Apariencia + logout.
 * Diseño: ref docs/design/screens/mobile.jsx MProfile (línea 788).
 */

import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { AccentPicker, ThemeSegmented } from '@/components/theme/theme';
import { Icons } from '@/components/ui/icons';
import { Pill } from '@/components/ui/Pill';
import { Section, SectionRow } from '@/components/ui/Section';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { cn } from '@/lib/cn';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  const { toast } = useToast();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [canManageOrg, setCanManageOrg] = useState(false);
  const [canManageShifts, setCanManageShifts] = useState(false);
  const [contextLoading, setContextLoading] = useState(true);

  const [fullName, setFullName] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ monthShifts: 0, monthHours: 0, approvedRequests: 0 });
  const [userOrganizations, setUserOrganizations] = useState<UserOrg[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showDataEditor, setShowDataEditor] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carga del contexto (org/user) en cliente para evitar dependencia inestable de useScheduleOrg
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setContextLoading(false);
        return;
      }
      setUserId(user.id);
      setEmail(user.email ?? null);
      const { data: m } = await supabase
        .from('memberships')
        .select('org_id, role')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (m) {
        setOrgId((m as { org_id?: string }).org_id ?? null);
        const role = (m as { role?: string }).role ?? 'user';
        setCanManageOrg(role === 'superadmin' || role === 'org_admin');
        setCanManageShifts(role === 'superadmin' || role === 'org_admin' || role === 'team_manager');
      }
      setContextLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const roleLabel = useMemo(() => {
    if (canManageOrg) return 'Admin';
    if (canManageShifts) return 'Manager';
    return 'Staff';
  }, [canManageOrg, canManageShifts]);

  const load = useCallback(async () => {
    if (!orgId || !userId) return;
    setLoadingData(true);
    const supabase = createClient();

    const [{ data: prof }, { data: org }, { data: accessibleOrgs }] = await Promise.all([
      supabase.from('profiles').select('full_name, avatar_url').eq('id', userId).maybeSingle(),
      supabase.from('organizations').select('name').eq('id', orgId).maybeSingle(),
      supabase.rpc('get_my_accessible_organizations'),
    ]);

    setFullName((prof as { full_name?: string | null; avatar_url?: string | null } | null)?.full_name ?? null);
    setAvatarUrl((prof as { full_name?: string | null; avatar_url?: string | null } | null)?.avatar_url ?? null);
    setOrgName((org as { name?: string | null } | null)?.name ?? null);

    const orgs: UserOrg[] = ((accessibleOrgs ?? []) as { id: string; name: string; parent_id: string | null; role: string }[])
      .flatMap((r) => {
        if (!r?.id || !r?.name) return [];
        return [{ id: r.id, name: r.name, role: r.role ?? 'viewer', parentId: r.parent_id ?? null }];
      })
      .sort((a, b) => {
        if (a.parentId && !b.parentId) return 1;
        if (!a.parentId && b.parentId) return -1;
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
    void load();
  }, [orgId, userId, load]);

  const handleSaveName = useCallback(async () => {
    if (!userId) return;
    setSavingProfile(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: (fullName ?? '').trim() || null })
      .eq('id', userId);
    setSavingProfile(false);
    if (error) {
      toast({ variant: 'error', title: 'No se pudo guardar', message: error.message });
      return;
    }
    toast({ variant: 'success', title: 'Perfil actualizado', message: 'Tus datos se guardaron correctamente.' });
    setShowDataEditor(false);
  }, [userId, fullName, toast]);

  const handleAvatarChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !userId) return;
      setUploadingAvatar(true);
      const supabase = createClient();
      try {
        const fileExt = file.name.split('.').pop() ?? 'jpg';
        const filePath = `${userId}-${Date.now()}.${fileExt}`;
        const bucket = 'avatars';
        const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file, { upsert: true });
        if (uploadError) {
          toast({ variant: 'error', title: 'No se pudo subir', message: 'Intenta con otra imagen.' });
          return;
        }
        const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);
        const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);
        if (updateError) {
          toast({ variant: 'error', title: 'No se pudo guardar', message: 'No se actualizó la foto.' });
          return;
        }
        setAvatarUrl(publicUrl);
        toast({ variant: 'success', title: 'Foto actualizada', message: 'Tu foto de perfil se guardó.' });
      } finally {
        setUploadingAvatar(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [userId, toast]
  );

  const handleLogout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/');
    router.refresh();
  }, [router]);

  if (contextLoading) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Mi perfil" subtitle="Tu información y preferencias" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (!orgId || !userId) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Mi perfil" subtitle="Tu información y preferencias" />
        <div className="rounded-2xl border border-border bg-surface p-6">
          <p className="text-sm text-muted">Inicia sesión y asegúrate de tener una organización asignada.</p>
          <div className="mt-3">
            <Link href="/login" className="text-[12.5px] font-semibold text-primary hover:underline">
              Iniciar sesión
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const displayName = fullName?.trim() || (email?.split('@')[0] ?? 'Usuario');

  return (
    <div className="space-y-4">
      <DashboardDesktopHeader
        title="Mi perfil"
        subtitle={orgName ? `${orgName} · ${roleLabel}` : roleLabel}
      />

      {/* Hero del perfil */}
      <ProfileHero
        name={displayName}
        email={email}
        avatarUrl={avatarUrl}
        roleLabel={roleLabel}
        orgName={orgName}
        uploading={uploadingAvatar}
        onPickAvatar={() => fileInputRef.current?.click()}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarChange}
      />

      {/* KPIs */}
      <KpiStrip stats={stats} loading={loadingData} />

      {/* Sección Cuenta */}
      <Section title="Cuenta">
        <button
          type="button"
          onClick={() => setShowDataEditor((v) => !v)}
          className="block w-full text-left"
        >
          <SectionRow icon={<Icons.user size={18} />} label="Datos personales" />
        </button>
        {showDataEditor ? (
          <div className="border-b border-border bg-subtle-2/40 p-4">
            <label htmlFor="profile-full-name" className="mb-1 block text-[11.5px] font-semibold text-text-sec">
              Nombre completo
            </label>
            <input
              id="profile-full-name"
              type="text"
              value={fullName ?? ''}
              onChange={(e) => setFullName(e.target.value)}
              className="block w-full rounded-xl border border-border bg-bg px-3 py-2 text-[13.5px] text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              placeholder="Tu nombre y apellido"
            />
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted">Visible para tu equipo en turnos y solicitudes.</p>
              <button
                type="button"
                disabled={savingProfile}
                onClick={() => void handleSaveName()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[12.5px] font-semibold text-white transition-transform hover:-translate-y-px disabled:opacity-50"
                style={{ boxShadow: '0 6px 16px -8px var(--primary)' }}
              >
                {savingProfile ? '…' : 'Guardar'}
              </button>
            </div>
          </div>
        ) : null}
        <Link href="/dashboard/profile" className="block">
          <SectionRow
            icon={<Icons.building size={18} />}
            label="Mis organizaciones"
            trailing={
              userOrganizations.length > 0 ? (
                <Pill tone="primary">{userOrganizations.length}</Pill>
              ) : (
                <Pill tone="muted">0</Pill>
              )
            }
          />
        </Link>
        <Link href="/forgot-password" className="block">
          <SectionRow icon={<Icons.lock size={18} />} label="Cambiar contraseña" last />
        </Link>
      </Section>

      {userOrganizations.length > 0 ? (
        <OrganizationsList orgs={userOrganizations} />
      ) : null}

      {/* Sección Aplicación */}
      <Section title="Aplicación">
        <Link href="/dashboard/notifications" className="block">
          <SectionRow icon={<Icons.bell size={18} />} label="Notificaciones" />
        </Link>
        <Link href="/dashboard/staff/availability" className="block">
          <SectionRow icon={<Icons.calendar size={18} />} label="Mi disponibilidad" />
        </Link>
        <Link href="/dashboard/transactions" className="block">
          <SectionRow icon={<Icons.history size={18} />} label="Actividad reciente" last />
        </Link>
      </Section>

      {/* Sección Apariencia */}
      <Section title="Apariencia">
        <div className="border-b border-border p-4">
          <div className="mb-2.5 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-subtle text-text-sec">
              <Icons.sparkle size={18} />
            </span>
            <span className="text-[13.5px] font-medium text-text">Modo</span>
          </div>
          <ThemeSegmented />
        </div>
        <div className="p-4">
          <div className="mb-3 flex items-start gap-3">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]"
              style={{ backgroundColor: 'color-mix(in oklab, var(--primary) 18%, transparent)', color: 'var(--primary)' }}
            >
              <Icons.zap size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium text-text">Color de acento</p>
              <p className="mt-px text-[11px] text-muted">Personaliza el color principal de la app</p>
            </div>
          </div>
          <AccentPicker />
        </div>
      </Section>

      {/* Logout */}
      <button
        type="button"
        onClick={handleLogout}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface text-[13.5px] font-semibold text-red transition-colors hover:bg-subtle-2"
      >
        <Icons.logout size={16} /> Cerrar sesión
      </button>

      {email ? (
        <p className="pt-1 text-center text-[11px] text-muted">{email}</p>
      ) : null}
    </div>
  );
}

function ProfileHero({
  name,
  email,
  avatarUrl,
  roleLabel,
  orgName,
  uploading,
  onPickAvatar,
}: {
  name: string;
  email: string | null;
  avatarUrl: string | null;
  roleLabel: string;
  orgName: string | null;
  uploading: boolean;
  onPickAvatar: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-5 py-6 text-center md:py-8">
      <div className="relative mx-auto inline-block">
        <button
          type="button"
          onClick={onPickAvatar}
          aria-label="Cambiar foto de perfil"
          className={cn(
            'relative flex h-[84px] w-[84px] items-center justify-center overflow-hidden rounded-full text-[30px] font-extrabold text-white',
            uploading ? 'opacity-70' : ''
          )}
          style={{
            background: 'linear-gradient(135deg, var(--primary), var(--primary-dark, var(--primary)))',
            boxShadow: '0 14px 30px -16px var(--primary)',
            fontFamily: 'var(--font-inter-tight), var(--font-inter), system-ui, sans-serif',
          }}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            initials(name)
          )}
          {uploading ? (
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[12px]">…</span>
          ) : null}
        </button>
        <span
          aria-hidden
          className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-bg"
          style={{ border: '2px solid var(--bg)' }}
        >
          <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-green text-white">
            <Icons.check size={11} stroke={3 as unknown as number} />
          </span>
        </span>
      </div>

      <p
        className="tn-h mt-3 text-[20px] font-bold tracking-[-0.015em] text-text"
        style={{ fontFamily: 'var(--font-inter-tight), var(--font-inter), system-ui, sans-serif' }}
      >
        {name}
      </p>
      {email ? <p className="mt-0.5 text-[13px] text-muted">{email}</p> : null}

      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
        <Pill tone="primary">{roleLabel}</Pill>
        {orgName ? <Pill tone="blue">{orgName}</Pill> : null}
      </div>
    </div>
  );
}

function KpiStrip({ stats, loading }: { stats: Stats; loading: boolean }) {
  const items = [
    { label: 'Turnos / mes', value: loading ? '…' : String(stats.monthShifts) },
    { label: 'Horas / mes', value: loading ? '…' : formatHours(stats.monthHours) },
    { label: 'Aprobadas', value: loading ? '…' : String(stats.approvedRequests) },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((it) => (
        <div key={it.label} className="rounded-2xl border border-border bg-subtle-2/40 p-3 text-center">
          <p
            className="tn-h text-[18px] font-extrabold text-text"
            style={{ fontFamily: 'var(--font-inter-tight), var(--font-inter), system-ui, sans-serif' }}
          >
            {it.value}
          </p>
          <p className="mt-0.5 text-[10.5px] font-medium text-muted">{it.label}</p>
        </div>
      ))}
    </div>
  );
}

function OrganizationsList({ orgs }: { orgs: UserOrg[] }) {
  return (
    <Section title="Mis organizaciones">
      {orgs.map((o, i) => (
        <div
          key={o.id}
          className={cn(
            'flex items-center gap-3 px-3.5 py-3',
            i < orgs.length - 1 ? 'border-b border-border' : '',
            o.parentId ? 'pl-7' : ''
          )}
        >
          {o.parentId ? <span className="text-muted shrink-0">↳</span> : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-subtle text-muted">
              <Icons.building size={14} />
            </span>
          )}
          <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-text">{o.name}</p>
          <Pill tone="primary">{roleToLabel(o.role)}</Pill>
        </div>
      ))}
    </Section>
  );
}
