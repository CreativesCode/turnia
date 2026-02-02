import { useEffect, useState } from 'react';

/**
 * Devuelve una versión "debounced" del valor, actualizándolo solo
 * después de que hayan pasado `delayMs` milisegundos sin cambios.
 */
export function useDebounce<T>(value: T, delayMs: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      window.clearTimeout(t);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
