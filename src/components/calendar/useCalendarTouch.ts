'use client';

import { useCallback, useRef, type RefObject, type TouchEvent as ReactTouchEvent } from 'react';

type Args = {
  isMobile: boolean;
  calendarRef: RefObject<any>;
};

export function useCalendarTouch({ isMobile, calendarRef }: Args) {
  const touchStartRef = useRef<{ x: number; y: number; at: number } | null>(null);
  const lastSwipeAtRef = useRef(0);

  const onTouchStart = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      if (!isMobile) return;
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      touchStartRef.current = { x: t.clientX, y: t.clientY, at: Date.now() };
    },
    [isMobile]
  );

  const onTouchEnd = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      if (!isMobile) return;

      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (!start) return;

      const t = e.changedTouches?.[0];
      if (!t) return;

      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const dt = Date.now() - start.at;

      // Gestos "intencionales": rápidos, horizontales y con umbral suficiente.
      // Evita interferir con scroll vertical y taps.
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (dt > 700) return;
      if (absX < 60) return;
      if (absX < absY * 1.2) return;

      // Evitar conflicto con el gesto del sistema (back) en los bordes.
      if (typeof window !== 'undefined') {
        const edge = 20;
        if (start.x < edge || start.x > window.innerWidth - edge) return;
      }

      const api = calendarRef.current?.getApi?.();
      if (!api) return;
      lastSwipeAtRef.current = Date.now();
      if (dx < 0) api.next();
      else api.prev();
    },
    [isMobile, calendarRef]
  );

  const onTouchCancel = useCallback(() => {
    touchStartRef.current = null;
  }, []);

  return { onTouchStart, onTouchEnd, onTouchCancel, lastSwipeAtRef };
}

