'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

type Data = {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
};

type Props = {
  data: Data;
};

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#6b7280'];

export function RequestsStatsChart({ data }: Props) {
  if (data.total === 0) {
    return <div className="flex h-64 items-center justify-center text-sm text-muted">No hay solicitudes en este período</div>;
  }

  const chartData = [
    { name: 'Aprobadas', value: data.approved, color: COLORS[0] },
    { name: 'Rechazadas', value: data.rejected, color: COLORS[1] },
    { name: 'Pendientes', value: data.pending, color: COLORS[2] },
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number | undefined) => `${value ?? 0} solicitudes`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold text-green-600">{data.approved}</div>
          <div className="text-xs text-muted">Aprobadas</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-red-600">{data.rejected}</div>
          <div className="text-xs text-muted">Rechazadas</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-yellow-600">{data.pending}</div>
          <div className="text-xs text-muted">Pendientes</div>
        </div>
      </div>
    </div>
  );
}
