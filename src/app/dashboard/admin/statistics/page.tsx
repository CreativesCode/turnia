import StatisticsGeneralPage from '@/components/statistics/StatisticsGeneralPage';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Estadísticas Generales - Turnia',
  description: 'Análisis de turnos y guardias de la organización',
};

export default function Page() {
  return <StatisticsGeneralPage />;
}
