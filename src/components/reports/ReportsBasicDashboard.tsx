'use client';

/**
 * Dashboard de reportes básicos: turnos por usuario, distribución noche/fin de semana,
 * turnos sin asignar, solicitudes por estado.
 * @see project-roadmap.md Módulo 7.2
 */

import { createClient } from '@/lib/supabase/client';
import { fetchProfilesMap } from '@/lib/supabase/queries';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import useSWR from 'swr';

type Props = { orgId: string };

type ReportByUserTypeRow = {
  user_id: string | null;
  shift_type_name: string;
  shift_type_letter: string;
  shift_count: number;
};

type ReportSummaryRow = {
  unassigned_count: number;
  night_count: number;
  weekend_count: number;
};

type ReportRequestsStatusRow = {
  status: string;
  request_count: number;
};

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toStartISO(dateStr: string): string {
  return `${dateStr}T00:00:00.000Z`;
}

function toEndISO(dateStr: string): string {
  return `${dateStr}T23:59:59.999Z`;
}

const REQUEST_STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  submitted: 'Enviada',
  accepted: 'Aceptada',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
};

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#6B7280'];

export function ReportsBasicDashboard({ orgId }: Props) {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [start, setStart] = useState(toDateInput(firstDay));
  const [end, setEnd] = useState(toDateInput(lastDay));
  const swrKey = useMemo(() => ['reportsBasic', orgId, start, end] as const, [orgId, start, end]);

  const fetcher = useCallback(async () => {
    const supabase = createClient();
    const startISO = toStartISO(start);
    const endISO = toEndISO(end);

    const [byUserTypeRes, summaryRes, byStatusRes] = await Promise.all([
      supabase.rpc('report_shift_counts_by_user_type', { p_org_id: orgId, p_from: startISO, p_to: endISO }),
      supabase.rpc('report_shift_counts_summary', { p_org_id: orgId, p_from: startISO, p_to: endISO }),
      supabase.rpc('report_shift_requests_status_counts', { p_org_id: orgId, p_from: startISO, p_to: endISO }),
    ]);

    if (byUserTypeRes.error) throw new Error(byUserTypeRes.error.message);
    if (summaryRes.error) throw new Error(summaryRes.error.message);
    if (byStatusRes.error) throw new Error(byStatusRes.error.message);

    const byUserType = (byUserTypeRes.data ?? []) as unknown as ReportByUserTypeRow[];
    const summary = (summaryRes.data?.[0] ?? { unassigned_count: 0, night_count: 0, weekend_count: 0 }) as ReportSummaryRow;
    const byStatus = (byStatusRes.data ?? []) as unknown as ReportRequestsStatusRow[];

    const userIds = Array.from(new Set(byUserType.map((r) => r.user_id).filter(Boolean))) as string[];
    const names = userIds.length > 0 ? await fetchProfilesMap(supabase, userIds, { fallbackName: (id) => id.slice(0, 8) }) : {};

    const allTypes = Array.from(new Set(byUserType.map((r) => r.shift_type_name))).sort();

    const userTypeCount = new Map<string, Map<string, number>>();
    for (const r of byUserType) {
      const uid = r.user_id ?? '__unassigned__';
      if (!userTypeCount.has(uid)) userTypeCount.set(uid, new Map());
      userTypeCount.get(uid)!.set(r.shift_type_name, Number(r.shift_count ?? 0));
    }

    const byUserRows: { user: string; total: number;[type: string]: string | number }[] = [];
    for (const [uid, typeMap] of userTypeCount) {
      const userLabel = uid === '__unassigned__' ? '— Sin asignar' : names[uid] ?? uid.slice(0, 8);
      const total = Array.from(typeMap.values()).reduce((a, b) => a + b, 0);
      const row: { user: string; total: number;[k: string]: string | number } = { user: userLabel, total };
      for (const t of allTypes) row[t] = typeMap.get(t) ?? 0;
      byUserRows.push(row);
    }
    byUserRows.sort((a, b) => b.total - a.total);

    const statusRows = (byStatus ?? [])
      .map((r) => ({
        status: r.status,
        label: REQUEST_STATUS_LABELS[r.status] ?? r.status,
        count: Number(r.request_count ?? 0),
      }))
      .sort((a, b) => b.count - a.count);

    return {
      typeNames: allTypes,
      byUser: byUserRows,
      unassignedCount: Number(summary.unassigned_count ?? 0),
      nightCount: Number(summary.night_count ?? 0),
      weekendCount: Number(summary.weekend_count ?? 0),
      byStatus: statusRows,
    };
  }, [orgId, start, end]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
  });

  const loading = isLoading || (isValidating && !data);
  const byUser = data?.byUser ?? [];
  const nightCount = data?.nightCount ?? 0;
  const weekendCount = data?.weekendCount ?? 0;
  const unassignedCount = data?.unassignedCount ?? 0;
  const byStatus = data?.byStatus ?? [];
  const typeNames = data?.typeNames ?? [];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 animate-pulse rounded bg-subtle-bg" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-subtle-bg" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl bg-subtle-bg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {String((error as Error).message ?? error)}
        <button
          type="button"
          onClick={() => void mutate()}
          className="ml-2 font-medium underline hover:no-underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const distData = [
    { name: 'Turnos de tipo nocturno', count: nightCount, fill: '#6366F1' },
    { name: 'Turnos en fin de semana', count: weekendCount, fill: '#8B5CF6' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="rep-start" className="block text-sm font-medium text-text-primary">
            Desde
          </label>
          <input
            id="rep-start"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label htmlFor="rep-end" className="block text-sm font-medium text-text-primary">
            Hasta
          </label>
          <input
            id="rep-end"
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            min={start}
            className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Resumen en cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
          <p className="text-sm font-medium text-text-secondary">Turnos sin asignar</p>
          <p className="mt-1 text-2xl font-semibold text-text-primary">{unassignedCount}</p>
          <Link
            href="/dashboard/manager/shifts"
            className="mt-2 inline-block text-sm text-primary-600 hover:text-primary-700"
          >
            Ver lista de turnos →
          </Link>
        </div>
        <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
          <p className="text-sm font-medium text-text-secondary">Tipos nocturnos</p>
          <p className="mt-1 text-2xl font-semibold text-text-primary">{nightCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
          <p className="text-sm font-medium text-text-secondary">Fines de semana</p>
          <p className="mt-1 text-2xl font-semibold text-text-primary">{weekendCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
          <p className="text-sm font-medium text-text-secondary">Solicitudes (período)</p>
          <p className="mt-1 text-2xl font-semibold text-text-primary">
            {byStatus.reduce((a, b) => a + b.count, 0)}
          </p>
        </div>
      </div>

      {/* Turnos por usuario: tabla */}
      <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
        <h2 className="text-base font-semibold text-text-primary">Turnos por usuario</h2>
        <p className="mt-1 text-sm text-text-secondary">Conteo por tipo de turno en el período.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead>
              <tr>
                <th className="bg-subtle-bg px-3 py-2 text-left font-medium text-text-primary">
                  Usuario
                </th>
                {typeNames.map((t) => (
                  <th key={t} className="bg-subtle-bg px-3 py-2 text-right font-medium text-text-primary">
                    {t}
                  </th>
                ))}
                <th className="bg-subtle-bg px-3 py-2 text-right font-medium text-text-primary">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {byUser.map((r) => (
                <tr key={r.user} className="divide-y divide-border">
                  <td className="px-3 py-2 text-text-primary">{r.user}</td>
                  {typeNames.map((t) => (
                    <td key={t} className="px-3 py-2 text-right text-text-secondary">
                      {String(r[t] ?? 0)}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-medium text-text-primary">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {byUser.length === 0 && (
            <p className="py-6 text-center text-sm text-text-secondary">No hay turnos en el período.</p>
          )}
        </div>
      </div>

      {/* Gráfico: distribución noche / fin de semana */}
      <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
        <h2 className="text-base font-semibold text-text-primary">Distribución: nocturnos y fines de semana</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Turnos de tipo nocturno (nombre/letra N) y turnos que caen en sábado o domingo.
        </p>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => [v ?? 0, 'Turnos']} />
              <Bar dataKey="count" name="Turnos" radius={[0, 4, 4, 0]}>
                {distData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Solicitudes por estado: gráfico de torta + tabla */}
      <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
        <h2 className="text-base font-semibold text-text-primary">Solicitudes por estado</h2>
        <p className="mt-1 text-sm text-text-secondary">Solicitudes creadas en el período.</p>
        {byStatus.length > 0 ? (
          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="h-64 w-full shrink-0 lg:w-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byStatus}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(e: { name?: string; value?: number }) => `${e.name ?? ''}: ${e.value ?? 0}`}
                  >
                    {byStatus.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, _n, p) => [v ?? 0, (p as { payload: { label: string } }).payload.label]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="min-w-0 flex-1">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead>
                  <tr>
                    <th className="bg-subtle-bg px-3 py-2 text-left font-medium text-text-primary">Estado</th>
                    <th className="bg-subtle-bg px-3 py-2 text-right font-medium text-text-primary">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {byStatus.map((r) => (
                    <tr key={r.status} className="divide-y divide-border">
                      <td className="px-3 py-2 text-text-primary">{r.label}</td>
                      <td className="px-3 py-2 text-right font-medium text-text-secondary">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="mt-4 py-6 text-center text-sm text-text-secondary">No hay solicitudes en el período.</p>
        )}
      </div>
    </div>
  );
}
