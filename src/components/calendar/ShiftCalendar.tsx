'use client';

/**
 * Calendario de turnos (FullCalendar).
 * Vistas: mes, semana, día, lista.
 * @see indications.md §5.2
 */
import { useRef, useEffect } from 'react';

// Placeholder hasta montar FullCalendar (requiere ventana)
export function ShiftCalendar() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !ref.current) return;
    // TODO: importar e inicializar FullCalendar (daygrid, timegrid, list, interaction)
  }, []);

  return (
    <div ref={ref} className="min-h-[400px] rounded-lg border border-border bg-background p-4">
      <p className="text-muted">Calendario (FullCalendar)</p>
    </div>
  );
}
