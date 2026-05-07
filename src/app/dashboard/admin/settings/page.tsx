'use client';

import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import {
  OrgSettingsForm,
  type SettingsSection,
} from '@/components/organizations/OrgSettingsForm';
import {
  BuildingIcon,
  CheckIcon,
  ClockIcon,
  DocIcon,
  type IconProps,
  MailIcon,
  ShieldIcon,
  ZapIcon,
} from '@/components/ui/icons';
import { useCurrentOrg } from '@/hooks/useCurrentOrg';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import * as React from 'react';
import useSWR from 'swr';

type OrgOption = { id: string; name: string };

type NavItem = {
  key: SettingsSection;
  label: string;
  icon: React.FC<IconProps>;
  needsBackend?: boolean;
};

const NAV: ReadonlyArray<NavItem> = [
  { key: 'approvals', label: 'Aprobaciones', icon: CheckIcon },
  { key: 'rest', label: 'Descanso', icon: ClockIcon },
  { key: 'notifications', label: 'Notificaciones', icon: MailIcon, needsBackend: true },
  { key: 'integrations', label: 'Integraciones', icon: ZapIcon, needsBackend: true },
  { key: 'security', label: 'Seguridad', icon: ShieldIcon, needsBackend: true },
  { key: 'billing', label: 'Facturación', icon: DocIcon, needsBackend: true },
];

export default function AdminSettingsPage() {
  const { orgId, isSuperadmin, isLoading, error } = useCurrentOrg();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [section, setSection] = useState<SettingsSection>('approvals');

  const orgsKey = useMemo(() => (isSuperadmin ? (['adminSettingsOrgs'] as const) : null), [isSuperadmin]);
  const orgsFetcher = useMemo(() => {
    if (!isSuperadmin) return null;
    return async (): Promise<OrgOption[]> => {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from('organizations')
        .select('id, name')
        .order('name');
      if (err) throw new Error(err.message);
      return (data ?? []) as OrgOption[];
    };
  }, [isSuperadmin]);

  const { data: orgs = [], isLoading: orgsLoading } = useSWR(orgsKey, orgsFetcher as never, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 10_000,
  });

  useEffect(() => {
    if (!isSuperadmin) {
      setSelectedOrgId(orgId);
      return;
    }
    if (!selectedOrgId && orgs.length > 0) setSelectedOrgId(orgs[0].id);
  }, [isSuperadmin, orgId, orgs, selectedOrgId]);

  const effectiveOrgId = isSuperadmin ? selectedOrgId : orgId;
  const canEdit = isSuperadmin || !!orgId;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader
          title="Configuración"
          subtitle="Cargando…"
        />
        <div className="rounded-2xl border border-border bg-bg p-6 text-sm text-text-sec">Cargando…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Configuración" />
        <div className="rounded-2xl border border-border bg-bg p-6 text-sm text-red">{error}</div>
        <Link href="/dashboard/admin" className="text-sm text-primary">
          ← Admin
        </Link>
      </div>
    );
  }

  if (!orgId && !isSuperadmin) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Configuración" />
        <p className="rounded-2xl border border-border bg-bg p-6 text-sm text-text-sec">
          Solo org_admin y superadmin pueden acceder a la configuración.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <DashboardDesktopHeader
        title="Configuración"
        subtitle="Aprobaciones, descanso mínimo y reglas de la organización"
      />

      {isSuperadmin ? (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-bg p-3">
          <BuildingIcon size={16} className="text-muted" />
          <label htmlFor="org-select-settings" className="text-[12.5px] font-semibold text-text-sec">
            Organización
          </label>
          <select
            id="org-select-settings"
            value={selectedOrgId ?? ''}
            onChange={(e) => setSelectedOrgId(e.target.value || null)}
            disabled={orgsLoading}
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text"
          >
            <option value="">Seleccionar…</option>
            {orgs.map((o: OrgOption) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {!effectiveOrgId ? (
        <div className="rounded-2xl border border-border bg-bg p-6 text-sm text-text-sec">
          Selecciona una organización para ver su configuración.
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[240px_1fr] lg:items-start">
          {/* Sidebar interna */}
          <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-bg p-2 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:p-2">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = section === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSection(item.key)}
                  className={
                    'flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-semibold transition-colors lg:w-full ' +
                    (active
                      ? 'bg-primary-soft text-primary'
                      : 'text-text-sec hover:bg-subtle-2')
                  }
                >
                  <Icon size={16} stroke={active ? 2.4 : 2} />
                  <span className="flex-1 whitespace-nowrap">{item.label}</span>
                  {item.needsBackend ? (
                    <span className="hidden rounded-full bg-subtle-2 px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-muted lg:inline">
                      Pronto
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          {/* Contenido */}
          <div>
            <OrgSettingsForm orgId={effectiveOrgId} canEdit={canEdit} section={section} />
          </div>
        </div>
      )}
    </div>
  );
}
