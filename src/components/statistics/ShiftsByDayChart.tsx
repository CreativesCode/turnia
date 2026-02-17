'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type DataItem = {
  day: string;
  count: number;
  hours: number;
};

type Props = {
  data: DataItem[];
};

export function ShiftsByDayChart({ data }: Props) {
  if (data.length === 0) {
    return <div className="flex h-64 items-center justify-center text-sm text-muted">No hay datos disponibles</div>;
  }

  const chartData = data.map((item) => ({
    día: item.day,
    turnos: item.count,
    horas: item.hours,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="día" />
        <YAxis />
        <Tooltip formatter={(value: number) => `${value.toFixed(1)}`} />
        <Legend />
        <Bar dataKey="turnos" fill="#8884d8" name="Turnos" />
        <Bar dataKey="horas" fill="#82ca9d" name="Horas" />
      </BarChart>
    </ResponsiveContainer>
  );
}
