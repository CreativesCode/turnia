'use client';

import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { createClient } from '@/lib/supabase/client';

/**
 * Registra el token de push en el backend cuando la app corre en iOS/Android (Capacitor).
 * Debe montarse dentro de una ruta con usuario autenticado (p. ej. dashboard).
 * @see project-roadmap.md Módulo 5.1
 */
export function PushNotificationRegistration() {
  const registered = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const platform = Capacitor.getPlatform();
    if (platform !== 'ios' && platform !== 'android') return;

    let listeners: Array<{ remove: () => Promise<void> }> = [];

    const run = async () => {
      try {
        const permStatus = await PushNotifications.checkPermissions();
        const status = permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale'
          ? (await PushNotifications.requestPermissions()).receive
          : permStatus.receive;
        if (status !== 'granted') return;

        const supabase = createClient();

        const regHandle = await PushNotifications.addListener('registration', async (t) => {
          const token = t?.value;
          if (!token || registered.current) return;
          try {
            const { error } = await supabase.functions.invoke('register-push-token', {
              body: { token, platform },
            });
            if (!error) registered.current = true;
          } catch {
            // Silently ignore; puede reintentarse en siguiente registro
          }
        });

        const errHandle = await PushNotifications.addListener('registrationError', () => {
          // Opcional: log o analytics
        });

        listeners = [regHandle, errHandle];
        await PushNotifications.register();
      } catch {
        // Sin permisos, web, o plugin no disponible
      }
    };

    run();
    return () => {
      listeners.forEach((h) => h.remove?.());
    };
  }, []);

  return null;
}
