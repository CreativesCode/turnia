'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type DataItem = {
  date: string;
  count: number;
  hours: number;
};

type Props = {
  data: DataItem[];
};

export function ShiftsByDateChart({ data }: Props) {
  if (data.length === 0) {
    return <div className="flex h-64 items-center justify-center text-sm text-muted">No hay datos disponibles</div>;
  }

  const chartData = data.map((item) => {
    const date = new Date(item.date);
    return {
      fecha: date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
      turnos: item.count,
      horas: item.hours,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="fecha" angle={-45} textAnchor="end" height={100} />
        <YAxis />
        <Tooltip formatter={(value: number) => `${value.toFixed(1)}`} />
        <Legend />
        <Line type="monotone" dataKey="turnos" stroke="#8884d8" name="Turnos" strokeWidth={2} />
        <Line type="monotone" dataKey="horas" stroke="#82ca9d" name="Horas" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
