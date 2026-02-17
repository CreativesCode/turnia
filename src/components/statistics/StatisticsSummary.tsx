'use client';

import type { StatisticsData } from '@/hooks/useStatistics';

type Props = {
  data: StatisticsData;
};

export function StatisticsSummary({ data }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <div className="rounded-xl border border-border bg-background p-6">
        <div className="text-sm font-medium text-text-secondary">Total de Turnos</div>
        <div className="mt-2 text-3xl font-bold text-text-primary">{data.totalShifts}</div>
      </div>
      <div className="rounded-xl border border-border bg-background p-6">
        <div className="text-sm font-medium text-text-secondary">Total de Horas</div>
        <div className="mt-2 text-3xl font-bold text-text-primary">{data.totalHours}</div>
        <div className="mt-1 text-xs text-muted">{Math.round((data.totalHours / data.totalShifts) * 10) / 10} h/turno</div>
      </div>
      <div className="rounded-xl border border-border bg-background p-6">
        <div className="text-sm font-medium text-text-secondary">Tipos de Turno</div>
        <div className="mt-2 text-3xl font-bold text-text-primary">{data.shiftsByType.length}</div>
      </div>
      <div className="rounded-xl border border-border bg-background p-6">
        <div className="text-sm font-medium text-text-secondary">Usuarios Activos</div>
        <div className="mt-2 text-3xl font-bold text-text-primary">{data.shiftsByUser.length}</div>
      </div>
    </div>
  );
}
