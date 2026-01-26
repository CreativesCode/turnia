'use client';

import dynamic from 'next/dynamic';

const PushNotificationRegistration = dynamic(
  () => import('./PushNotificationRegistration').then((m) => m.PushNotificationRegistration),
  { ssr: false }
);

export function PushNotificationRegistrationLoader() {
  return <PushNotificationRegistration />;
}
