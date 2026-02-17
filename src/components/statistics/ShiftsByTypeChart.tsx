'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

type DataItem = {
  typeName: string;
  count: number;
  hours: number;
  color: string;
};

type Props = {
  data: DataItem[];
};

export function ShiftsByTypeChart({ data }: Props) {
  if (data.length === 0) {
    return <div className="flex h-64 items-center justify-center text-sm text-muted">No hay datos disponibles</div>;
  }

  const chartData = data.map((item) => ({
    name: item.typeName,
    value: item.count,
    hours: item.hours,
    color: item.color,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number, name: string, props: any) => [
            `${value} turnos (${props.payload.hours} horas)`,
            'Cantidad',
          ]}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
