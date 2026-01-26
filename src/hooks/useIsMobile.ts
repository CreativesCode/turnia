'use client';

import { useEffect, useState } from 'react';

/**
 * Detecta si la vista es móvil según el breakpoint.
 * @param breakpoint - '640px' (sm) o '768px' (md). Por defecto '768px'.
 */
export function useIsMobile(breakpoint: '640px' | '768px' = '768px'): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint})`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpoint]);

  return isMobile;
}
