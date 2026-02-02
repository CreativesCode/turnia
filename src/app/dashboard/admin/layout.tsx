import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Administración - Turnia',
  description: 'Gestión de organización, miembros, auditoría y configuración.',
};

export default function DashboardAdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}

