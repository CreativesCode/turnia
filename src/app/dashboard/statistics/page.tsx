import StatisticsPage from '@/components/statistics/StatisticsPage';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Estadísticas - Turnia',
  description: 'Análisis de turnos y guardias',
};

export default function Page() {
  return <StatisticsPage />;
}
