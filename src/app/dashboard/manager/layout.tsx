import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Manager - Turnia',
  description: 'Calendario y gestión de turnos del equipo.',
};

export default function DashboardManagerLayout({ children }: { children: React.ReactNode }) {
  return children;
}

