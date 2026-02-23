'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type DataItem = {
  userId: string;
  userName: string;
  count: number;
  hours: number;
};

type Props = {
  data: DataItem[];
};

export function HoursByUserChart({ data }: Props) {
  if (data.length === 0) {
    return <div className="flex h-64 items-center justify-center text-sm text-muted">No hay datos disponibles</div>;
  }

  const chartData = data.map((item) => ({
    name: item.userName.length > 15 ? item.userName.substring(0, 15) + '...' : item.userName,
    horas: item.hours,
    turnos: item.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
        <YAxis />
        <Tooltip formatter={(value: number | undefined) => (value != null ? `${value.toFixed(1)}` : '')} />
        <Legend />
        <Bar dataKey="horas" fill="#8884d8" name="Horas" />
        <Bar dataKey="turnos" fill="#82ca9d" name="Turnos" />
      </BarChart>
    </ResponsiveContainer>
  );
}
