import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Notificaciones - Turnia',
  description: 'Notificaciones in-app de solicitudes y turnos.',
};

export default function DashboardNotificationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

