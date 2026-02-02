import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Staff - Turnia',
  description: 'Resumen de turnos personales, disponibilidad y solicitudes.',
};

export default function DashboardStaffLayout({ children }: { children: React.ReactNode }) {
  return children;
}

