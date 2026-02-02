'use client';

import { createClient } from '@/lib/supabase/client';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { useEffect, useRef, useState } from 'react';

/**
 * Registra el token de push en el backend cuando la app corre en iOS/Android (Capacitor).
 * Debe montarse dentro de una ruta con usuario autenticado (p. ej. dashboard).
 * IMPORTANTE: No pide permisos automáticamente, solo registra si ya están concedidos.
 * Los permisos deben pedirse explícitamente desde otro componente/pantalla.
 * @see project-roadmap.md Módulo 5.1
 */
export function PushNotificationRegistration() {
  const registered = useRef(false);
  const setupDone = useRef(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Esperar un poco antes de iniciar para dar tiempo a que la app se estabilice
    const readyTimer = setTimeout(() => {
      setIsReady(true);
    }, 2000);

    return () => clearTimeout(readyTimer);
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (!Capacitor.isNativePlatform()) return;

    const platform = Capacitor.getPlatform();
    if (platform !== 'ios' && platform !== 'android') return;

    let listeners: Array<{ remove: () => Promise<void> }> = [];
    let isMounted = true;

    const setupNotifications = async () => {
      if (setupDone.current) return;

      try {
        // Solo verificar permisos, NO pedirlos automáticamente
        const permStatus = await PushNotifications.checkPermissions();

        // Solo registrar si los permisos ya están concedidos
        if (permStatus.receive !== 'granted') {
          console.log('[Push] Permisos no concedidos, esperando...');
          return;
        }

        console.log('[Push] Permisos concedidos, configurando listeners...');
        setupDone.current = true;

        const supabase = createClient();

        // Configurar listeners ANTES de intentar registrar
        const regHandle = await PushNotifications.addListener('registration', async (t) => {
          if (!isMounted) return;

          const token = t?.value;
          if (!token || registered.current) return;

          console.log('[Push] Token recibido, registrando en backend...');

          try {
            const { error } = await supabase.functions.invoke('register-push-token', {
              body: { token, platform },
            });

            if (!error) {
              registered.current = true;
              console.log('[Push] Token registrado exitosamente');
            } else {
              console.warn('[Push] Error al registrar token:', error);
            }
          } catch (err) {
            console.warn('[Push] Excepción al registrar token:', err);
          }
        });

        const errHandle = await PushNotifications.addListener('registrationError', (error) => {
          console.warn('[Push] Error de registro:', error);
        });

        listeners = [regHandle, errHandle];

        // Esperar un poco antes de registrar para asegurar que los listeners están listos
        await new Promise(resolve => setTimeout(resolve, 500));

        if (!isMounted) return;

        console.log('[Push] Iniciando registro...');
        await PushNotifications.register();

      } catch (error) {
        console.warn('[Push] Error en setup:', error);
      }
    };

    setupNotifications();

    return () => {
      isMounted = false;
      listeners.forEach((h) => {
        h.remove?.().catch((err) => {
          console.warn('[Push] Error al remover listener:', err);
        });
      });
    };
  }, [isReady]);

  return null;
}
