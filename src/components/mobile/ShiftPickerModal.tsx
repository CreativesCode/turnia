'use client';

import type { ShiftWithType } from '@/components/calendar/ShiftCalendar';
import { useCallback, useEffect } from 'react';

export type ShiftPickerItem = {
  shift: ShiftWithType;
  assignedName: string | null;
};

function formatTimeRange(startAt: string, endAt: string): string {
  const s = new Date(startAt);
  const e = new Date(endAt);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return '—';
  const day = s.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
  const st = s.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const et = e.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${st}–${et}`;
}

export function ShiftPickerModal({
  open,
  title,
  items,
  emptyMessage = 'No hay turnos para mostrar.',
  onClose,
  onSelect,
}: {
  open: boolean;
  title: string;
  items: ShiftPickerItem[];
  emptyMessage?: string;
  onClose: () => void;
  onSelect: (item: ShiftPickerItem) => void;
}) {
  const onEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    },
    [open, onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [open, onEscape]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 md:items-center md:p-4" role="dialog" aria-modal="true">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/50" aria-label="Cerrar" />
      <div className="relative w-full max-w-none max-h-[75vh] overflow-y-auto rounded-t-2xl border border-b-0 border-border bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg md:max-w-md md:rounded-xl md:border-b md:p-6">
        <div className="mb-2 flex justify-center md:hidden">
          <span className="h-1 w-12 shrink-0 rounded-full bg-muted" aria-hidden />
        </div>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-secondary hover:bg-subtle-bg"
          >
            Cerrar
          </button>
        </div>

        {items.length === 0 ? (
          <p className="mt-4 text-sm text-muted">{emptyMessage}</p>
        ) : (
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
            {items.map((it) => {
              const t = it.shift.organization_shift_types;
              const letter = t?.letter ?? '?';
              const color = t?.color ?? '#6B7280';
              const typeName = t?.name ?? '—';
              return (
                <li key={it.shift.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(it)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-subtle-bg"
                  >
                    <span
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: color }}
                      aria-hidden
                    >
                      {letter}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-text-primary">{typeName}</span>
                      <span className="mt-0.5 block text-xs text-text-secondary">
                        {formatTimeRange(it.shift.start_at, it.shift.end_at)}
                        {it.assignedName?.trim() ? ` · ${it.assignedName.trim()}` : it.shift.assigned_user_id ? '' : ' · Sin asignar'}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

