'use client';

import { DashboardDesktopHeader } from '@/components/dashboard/DashboardDesktopHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { useScheduleOrg } from '@/hooks/useScheduleOrg';
import { useStatistics } from '@/hooks/useStatistics';
import { useCallback, useMemo, useState } from 'react';
import { HoursByUserChart } from './HoursByUserChart';
import { ShiftsByTypeChart } from './ShiftsByTypeChart';
import { ShiftsByDayChart } from './ShiftsByDayChart';
import { ShiftsByDateChart } from './ShiftsByDateChart';
import { RequestsStatsChart } from './RequestsStatsChart';
import { StatisticsFilters } from './StatisticsFilters';
import { StatisticsSummary } from './StatisticsSummary';

export default function StatisticsPage() {
  const { orgId, userId, isLoading: orgLoading, error: orgError } = useScheduleOrg();
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { start, end };
  });

  // Siempre filtrar por usuario actual
  const { data, isLoading, error, refetch } = useStatistics(
    orgId,
    dateRange.start,
    dateRange.end,
    userId ?? undefined
  );

  const handleDateRangeChange = useCallback((start: Date, end: Date) => {
    setDateRange({ start, end });
  }, []);

  if (orgLoading) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Estadísticas" subtitle="Análisis de turnos y guardias" />
        <div className="rounded-xl border border-border bg-background p-6">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="mt-2 h-4 w-48" />
        </div>
      </div>
    );
  }

  if (orgError) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Estadísticas" subtitle="Análisis de turnos y guardias" />
        <div className="rounded-xl border border-border bg-background p-6">
          <p className="text-sm text-red-600">{orgError}</p>
        </div>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="space-y-4">
        <DashboardDesktopHeader title="Estadísticas" subtitle="Análisis de turnos y guardias" />
        <div className="rounded-xl border border-border bg-background p-6">
          <h1 className="text-xl font-semibold text-text-primary">Estadísticas</h1>
          <p className="mt-2 text-sm text-muted">
            No tienes una organización asignada. Contacta a un administrador para unirte a una.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardDesktopHeader title="Mis Estadísticas" subtitle="Análisis de tus turnos y guardias" />

      <StatisticsFilters
        startDate={dateRange.start}
        endDate={dateRange.end}
        onDateRangeChange={handleDateRangeChange}
        showUserFilter={false}
      />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-600">Error al cargar estadísticas: {error}</p>
        </div>
      ) : !data ? (
        <div className="rounded-xl border border-border bg-background p-6">
          <p className="text-sm text-muted">No hay datos disponibles para el período seleccionado.</p>
        </div>
      ) : (
        <>
          <StatisticsSummary data={data} />

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-background p-6">
              <h2 className="mb-4 text-lg font-semibold text-text-primary">Turnos por Tipo</h2>
              <ShiftsByTypeChart data={data.shiftsByType} />
            </div>

            <div className="rounded-xl border border-border bg-background p-6">
              <h2 className="mb-4 text-lg font-semibold text-text-primary">Horas por Usuario</h2>
              <HoursByUserChart data={data.shiftsByUser.slice(0, 10)} />
            </div>

            <div className="rounded-xl border border-border bg-background p-6">
              <h2 className="mb-4 text-lg font-semibold text-text-primary">Distribución por Día de la Semana</h2>
              <ShiftsByDayChart data={data.shiftsByDayOfWeek} />
            </div>

            <div className="rounded-xl border border-border bg-background p-6">
              <h2 className="mb-4 text-lg font-semibold text-text-primary">Estadísticas de Solicitudes</h2>
              <RequestsStatsChart data={data.requestsStats} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background p-6">
            <h2 className="mb-4 text-lg font-semibold text-text-primary">Turnos por Fecha</h2>
            <ShiftsByDateChart data={data.shiftsByDate} />
          </div>
        </>
      )}
    </div>
  );
}
