'use client';

import { useEffect, useState } from 'react';

export type OnlineStatus = {
  isOnline: boolean;
  lastChangedAt: number;
};

function readNavigatorOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

/**
 * Estado online/offline del runtime (web + Capacitor WebView).
 * Nota: `navigator.onLine` no garantiza conectividad real; sirve para UX básica.
 * @see project-roadmap.md 10.3 Indicador de estado offline
 */
export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() => readNavigatorOnline());
  const [lastChangedAt, setLastChangedAt] = useState<number>(() => Date.now());

  useEffect(() => {
    const sync = () => {
      setIsOnline(readNavigatorOnline());
      setLastChangedAt(Date.now());
    };

    // Estado inicial (por si hydration difiere)
    sync();

    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  return { isOnline, lastChangedAt };
}

