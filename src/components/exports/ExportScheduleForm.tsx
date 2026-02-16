'use client';

/**
 * Formulario para exportar horarios: rango de fechas, formato (CSV/Excel), descargar.
 * @see project-roadmap.md Módulo 7.1
 */

import { createClient } from '@/lib/supabase/client';
import { useCallback, useState } from 'react';

type Props = {
  orgId: string;
};

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toStartISO(dateStr: string): string {
  return `${dateStr}T00:00:00.000Z`;
}

function toEndISO(dateStr: string): string {
  return `${dateStr}T23:59:59.999Z`;
}

export function ExportScheduleForm({ orgId }: Props) {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [start, setStart] = useState(toDateInput(firstDay));
  const [end, setEnd] = useState(toDateInput(lastDay));
  const [format, setFormat] = useState<'csv' | 'xlsx'>('csv');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Sesión expirada. Recarga la página e inicia sesión.');
        setLoading(false);
        return;
      }

      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/export-schedule`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          orgId,
          start: toStartISO(start),
          end: toEndISO(end),
          format,
        }),
      });

      setLoading(false);

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Error ${res.status}`);
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      let filename = format === 'xlsx' ? 'horarios.xlsx' : 'horarios.csv';
      const m = disposition?.match(/filename=(.+)/);
      if (m) {
        const n = m[1].replace(/^["']|["']$/g, '');
        if (n) filename = n;
      }

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    },
    [orgId, start, end, format]
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 rounded-xl border border-border bg-background p-6 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="export-start" className="block text-sm font-medium text-text-primary">
            Desde
          </label>
          <input
            id="export-start"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none"
            required
          />
        </div>
        <div>
          <label htmlFor="export-end" className="block text-sm font-medium text-text-primary">
            Hasta
          </label>
          <input
            id="export-end"
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            min={start}
            className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary">Formato</label>
        <div className="mt-2 flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="format"
              value="csv"
              checked={format === 'csv'}
              onChange={() => setFormat('csv')}
              className="border-border text-primary-600 focus:outline-none"
            />
            <span className="text-sm text-text-primary">CSV</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="format"
              value="xlsx"
              checked={format === 'xlsx'}
              onChange={() => setFormat('xlsx')}
              className="border-border text-primary-600 focus:outline-none"
            />
            <span className="text-sm text-text-primary">Excel (.xlsx)</span>
          </label>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-fit rounded-lg border border-primary-600 bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
      >
        {loading ? 'Generando…' : 'Descargar'}
      </button>
    </form>
  );
}
