'use client';

import { useCallback } from 'react';

type Props = {
  startDate: Date;
  endDate: Date;
  onDateRangeChange: (start: Date, end: Date) => void;
  showUserFilter?: boolean;
  filterByUser?: boolean;
  onFilterByUserChange?: (value: boolean) => void;
};

export function StatisticsFilters({
  startDate,
  endDate,
  onDateRangeChange,
  showUserFilter = false,
  filterByUser = false,
  onFilterByUserChange,
}: Props) {
  const handleMonthChange = useCallback(
    (monthOffset: number) => {
      const newDate = new Date(startDate);
      newDate.setMonth(newDate.getMonth() + monthOffset);
      const start = new Date(newDate.getFullYear(), newDate.getMonth(), 1);
      const end = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0, 23, 59, 59);
      onDateRangeChange(start, end);
    },
    [startDate, onDateRangeChange]
  );

  const handleThisMonth = useCallback(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    onDateRangeChange(start, end);
  }, [onDateRangeChange]);

  const handleLastMonth = useCallback(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    onDateRangeChange(start, end);
  }, [onDateRangeChange]);

  const handleCustomRange = useCallback(() => {
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    const newStartStr = window.prompt('Fecha inicio (YYYY-MM-DD):', startStr);
    const newEndStr = window.prompt('Fecha fin (YYYY-MM-DD):', endStr);
    if (newStartStr && newEndStr) {
      const newStart = new Date(newStartStr + 'T00:00:00');
      const newEnd = new Date(newEndStr + 'T23:59:59');
      if (!isNaN(newStart.getTime()) && !isNaN(newEnd.getTime()) && newStart <= newEnd) {
        onDateRangeChange(newStart, newEnd);
      }
    }
  }, [startDate, endDate, onDateRangeChange]);

  const formatDateRange = useCallback(() => {
    const startStr = startDate.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
    const endStr = endDate.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
    if (startStr === endStr) {
      return startStr;
    }
    return `${startStr} - ${endStr}`;
  }, [startDate, endDate]);

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-background p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-text-secondary">Período:</span>
        <button
          onClick={handleLastMonth}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-subtle-bg"
        >
          Mes anterior
        </button>
        <button
          onClick={handleThisMonth}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-subtle-bg"
        >
          Este mes
        </button>
        <button
          onClick={handleCustomRange}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-subtle-bg"
        >
          Personalizado
        </button>
        <span className="text-sm text-text-primary">{formatDateRange()}</span>
      </div>

      {showUserFilter && onFilterByUserChange && (
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filterByUser}
              onChange={(e) => onFilterByUserChange(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-text-secondary">Solo mis turnos</span>
          </label>
        </div>
      )}
    </div>
  );
}
