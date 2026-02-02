import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mi perfil - Turnia',
  description: 'Datos de cuenta y estadísticas personales.',
};

export default function DashboardProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}

