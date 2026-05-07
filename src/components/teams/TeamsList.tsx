'use client';

import { Pill } from '@/components/ui/Pill';
import {
  BriefcaseIcon,
  PlusIcon,
  SettingsIcon,
  UsersIcon,
} from '@/components/ui/icons';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useCallback, useMemo } from 'react';
import useSWR from 'swr';

const TEAM_PALETTE = ['#14B8A6', '#7C3AED', '#F97316', '#0EA5E9', '#A78BFA', '#F59E0B', '#22C55E', '#EC4899'];

function colorForTeam(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return TEAM_PALETTE[Math.abs(hash) % TEAM_PALETTE.length];
}

type Team = {
  id: string;
  name: string;
  slug: string | null;
  parent_id: string | null;
  members: number;
  shifts_month: number;
  coverage: number;
  manager: string | null;
};

type Props = {
  /** Org padre para mostrar sus sub-organizaciones como "equipos". */
  parentOrgId: string;
  /** Si es superadmin, también permite ver orgs de nivel raíz como "equipos". */
  isSuperadmin?: boolean;
};

const PAGE_FETCH_LIMIT = 60;

export function TeamsList({ parentOrgId, isSuperadmin = false }: Props) {
  const swrKey = useMemo(() => ['teamsList', parentOrgId, isSuperadmin] as const, [parentOrgId, isSuperadmin]);

  const fetcher = useCallback(async (): Promise<{ teams: Team[]; parentName: string | null }> => {
    const supabase = createClient();

    const orgsQuery = supabase
      .from('organizations')
      .select('id, name, slug, parent_id')
      .order('name')
      .limit(PAGE_FETCH_LIMIT);

    const parentInfoP = supabase
      .from('organizations')
      .select('name')
      .eq('id', parentOrgId)
      .maybeSingle();

    /* Como "teams" usamos las sub-orgs del parent. */
    const subOrgsP = orgsQuery.eq('parent_id', parentOrgId);

    const [subOrgsRes, parentRes] = await Promise.all([subOrgsP, parentInfoP]);
    if (subOrgsRes.error) throw new Error(subOrgsRes.error.message);

    const subOrgs = (subOrgsRes.data ?? []) as { id: string; name: string; slug: string | null; parent_id: string | null }[];
    const parentName = (parentRes.data as { name?: string } | null)?.name ?? null;

    if (subOrgs.length === 0) return { teams: [], parentName };

    const orgIds = subOrgs.map((o) => o.id);

    /* Conteo de miembros y manager principal por org. */
    const { data: memberships } = await supabase
      .from('memberships')
      .select('org_id, user_id, role')
      .in('org_id', orgIds);

    const memberCounts = new Map<string, number>();
    const managerByOrg = new Map<string, string>();
    for (const m of (memberships ?? []) as { org_id: string; user_id: string; role: string }[]) {
      memberCounts.set(m.org_id, (memberCounts.get(m.org_id) || 0) + 1);
      if ((m.role === 'team_manager' || m.role === 'org_admin') && !managerByOrg.has(m.org_id)) {
        managerByOrg.set(m.org_id, m.user_id);
      }
    }

    /* Mapear nombres de managers. */
    const managerIds = Array.from(new Set(managerByOrg.values()));
    let managerNames: Record<string, string> = {};
    if (managerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', managerIds);
      managerNames = (profiles ?? []).reduce<Record<string, string>>((acc, p: { user_id: string; full_name: string | null }) => {
        if (p.full_name) acc[p.user_id] = p.full_name;
        return acc;
      }, {});
    }

    /* Conteo de turnos del mes y cobertura. */
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const { data: shifts } = await supabase
      .from('shifts')
      .select('org_id, assigned_user_id')
      .in('org_id', orgIds)
      .gte('start_at', firstDay)
      .lte('start_at', lastDay);

    const shiftCounts = new Map<string, { total: number; assigned: number }>();
    for (const s of (shifts ?? []) as { org_id: string; assigned_user_id: string | null }[]) {
      const cur = shiftCounts.get(s.org_id) ?? { total: 0, assigned: 0 };
      cur.total++;
      if (s.assigned_user_id) cur.assigned++;
      shiftCounts.set(s.org_id, cur);
    }

    const teams: Team[] = subOrgs.map((o) => {
      const sc = shiftCounts.get(o.id) ?? { total: 0, assigned: 0 };
      const coverage = sc.total > 0 ? Math.round((sc.assigned / sc.total) * 100) : 0;
      const managerId = managerByOrg.get(o.id);
      return {
        id: o.id,
        name: o.name,
        slug: o.slug,
        parent_id: o.parent_id,
        members: memberCounts.get(o.id) ?? 0,
        shifts_month: sc.total,
        coverage,
        manager: managerId ? managerNames[managerId] ?? null : null,
      };
    });

    return { teams, parentName };
  }, [parentOrgId]);

  const { data, error, isLoading } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-44 animate-pulse rounded-2xl bg-subtle-bg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-bg p-6">
        <p className="text-sm text-red">{String((error as Error).message ?? error)}</p>
      </div>
    );
  }

  const teams = data?.teams ?? [];
  const parentName = data?.parentName;

  if (teams.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-bg p-8 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{
            background: 'color-mix(in oklab, var(--color-primary) 14%, transparent)',
            color: 'var(--color-primary)',
          }}
          aria-hidden
        >
          <BriefcaseIcon size={22} />
        </div>
        <p className="text-[13.5px] font-semibold text-text">Sin equipos definidos</p>
        <p className="max-w-sm text-[12.5px] text-muted">
          Los equipos se modelan como sub-organizaciones de{' '}
          {parentName ? <strong className="text-text">{parentName}</strong> : 'tu organización'}.
          Crea uno desde Organizaciones para empezar.
        </p>
        <Link
          href="/dashboard/admin/organizations"
          className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-semibold text-white shadow-[0_4px_12px_-6px_var(--color-primary)]"
        >
          <PlusIcon size={14} stroke={2.6} /> Nueva sub-organización
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {teams.map((t) => {
        const color = colorForTeam(t.id);
        const coverageColor = t.coverage >= 85 ? 'var(--green)' : t.coverage >= 70 ? 'var(--amber)' : 'var(--red)';
        return (
          <article
            key={t.id}
            className="relative overflow-hidden rounded-2xl border border-border bg-bg p-4"
          >
            {/* Franja vertical 4px del color del equipo */}
            <span
              className="absolute left-0 top-0 bottom-0 w-1"
              style={{ background: color }}
              aria-hidden
            />
            <div className="flex items-start gap-3 pl-1.5">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: `color-mix(in oklab, ${color} 18%, transparent)`,
                  color,
                }}
                aria-hidden
              >
                <BriefcaseIcon size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="tn-h truncate text-[15px] font-bold text-text">{t.name}</h3>
                <p className="mt-0.5 truncate text-[11.5px] text-muted">
                  {t.manager ?? 'Sin manager asignado'}
                </p>
              </div>
              <Link
                href={`/dashboard/admin/organizations?edit=${t.id}`}
                aria-label="Configurar equipo"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-sec hover:bg-subtle-2"
              >
                <SettingsIcon size={14} />
              </Link>
            </div>

            <div className="mt-4 flex items-start gap-5 pl-1.5">
              <div>
                <div className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted">
                  <UsersIcon size={11} /> Miembros
                </div>
                <div className="tn-h mt-0.5 text-[22px] font-extrabold">{t.members}</div>
              </div>
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted">
                  Turnos / mes
                </div>
                <div className="tn-h mt-0.5 text-[22px] font-extrabold">{t.shifts_month}</div>
              </div>
            </div>

            <div className="mt-3 pl-1.5">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-muted">Cobertura</span>
                <span className="font-bold" style={{ color: coverageColor }}>
                  {t.coverage}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-subtle-2">
                <div
                  className="h-full rounded-full transition-[width] duration-500 ease-out"
                  style={{ width: `${t.coverage}%`, background: coverageColor }}
                />
              </div>
            </div>

            {t.shifts_month === 0 ? (
              <div className="mt-3 flex justify-end pl-1.5">
                <Pill tone="muted">Sin actividad este mes</Pill>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
