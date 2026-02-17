'use client';

/**
 * Tarjeta reutilizable para mostrar un turno.
 * Usada en DailyShiftsList (Turnos por día) y ActiveShiftsList (De turno ahora).
 */

import type { ShiftWithType } from '@/components/calendar/ShiftCalendar';

function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

type Props = {
  shift: ShiftWithType;
  /** Opcional: nombre de la organización (se muestra en "De turno ahora") */
  organizationName?: string | null;
  onClick?: () => void;
};

export function ShiftCard({ shift, organizationName, onClick }: Props) {
  const startDate = new Date(shift.start_at);
  const endDate = new Date(shift.end_at);
  const shiftType = shift.organization_shift_types;
  const color = shiftType?.color || '#6B7280';
  const letter = shiftType?.letter || '?';
  const typeName = shiftType?.name || 'Sin tipo';

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg border border-border bg-subtle-bg p-3 text-left transition-colors hover:border-primary-300 hover:bg-primary-50"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {letter}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-text-primary">{typeName}</p>
          {organizationName && (
            <span className="rounded-md bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
              {organizationName}
            </span>
          )}
        </div>
        <p className="text-sm text-text-secondary">
          {formatTime(startDate)} - {formatTime(endDate)}
        </p>
        {shift.location && (
          <p className="mt-1 text-xs text-muted">📍 {shift.location}</p>
        )}
      </div>
      <div className="shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </button>
  );
}
