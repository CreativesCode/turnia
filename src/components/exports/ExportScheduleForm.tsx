'use client';

import { Pill } from '@/components/ui/Pill';
import {
  AlertIcon,
  BriefcaseIcon,
  CalendarIcon,
  DocIcon,
  DownloadIcon,
  HistoryIcon,
  type IconProps,
} from '@/components/ui/icons';
import { Spinner } from '@/components/ui/Spinner';
import { createClient } from '@/lib/supabase/client';
import * as React from 'react';
import { useCallback, useState } from 'react';

type Props = {
  orgId: string;
};

type ExportFormat = 'csv' | 'xlsx';

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

type CardSpec = {
  title: string;
  description: string;
  icon: React.FC<IconProps>;
  color: string;
  formats: string[];
  status: 'ready' | 'soon';
};

const CARDS: ReadonlyArray<CardSpec> = [
  {
    title: 'Horarios del período',
    description: 'Turnos asignados con fecha, horario, tipo, persona y ubicación.',
    icon: CalendarIcon,
    color: 'var(--color-primary)',
    formats: ['CSV', 'XLSX'],
    status: 'ready',
  },
  {
    title: 'Disponibilidades',
    description: 'Vacaciones, licencias y ausencias del equipo.',
    icon: BriefcaseIcon,
    color: 'var(--blue)',
    formats: ['CSV'],
    status: 'soon',
  },
  {
    title: 'Solicitudes',
    description: 'Swaps, cesiones y tomas de turno con su estado.',
    icon: DocIcon,
    color: 'var(--violet)',
    formats: ['CSV', 'XLSX'],
    status: 'soon',
  },
  {
    title: 'Resumen mensual',
    description: 'Horas trabajadas y cobertura por equipo.',
    icon: DocIcon,
    color: 'var(--green)',
    formats: ['PDF'],
    status: 'soon',
  },
  {
    title: 'Registro de auditoría',
    description: 'Eventos del log con actor, acción y entidad.',
    icon: HistoryIcon,
    color: 'var(--amber)',
    formats: ['CSV'],
    status: 'soon',
  },
];

export function ExportScheduleForm({ orgId }: Props) {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [start, setStart] = useState(toDateInput(firstDay));
  const [end, setEnd] = useState(toDateInput(lastDay));
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<{ name: string; format: string; size: string; at: Date }[]>([]);

  const handleDownload = useCallback(async () => {
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

    setRecent((r) =>
      [
        {
          name: filename,
          format: format.toUpperCase(),
          size: `${(blob.size / 1024).toFixed(1)} KB`,
          at: new Date(),
        },
        ...r,
      ].slice(0, 5),
    );
  }, [orgId, start, end, format]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <ExportCard
            key={c.title}
            spec={c}
            isActive={c.status === 'ready'}
          >
            {c.status === 'ready' ? (
              <ScheduleExportForm
                start={start}
                end={end}
                format={format}
                loading={loading}
                error={error}
                onStartChange={setStart}
                onEndChange={setEnd}
                onFormatChange={setFormat}
                onDownload={handleDownload}
              />
            ) : null}
          </ExportCard>
        ))}
      </div>

      {recent.length > 0 ? (
        <section>
          <h2 className="tn-h mb-3 text-[15px] font-bold">Exportaciones recientes</h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-bg">
            {recent.map((r, i) => (
              <div
                key={i}
                className={
                  'flex items-center gap-3 px-4 py-3 text-sm ' +
                  (i < recent.length - 1 ? 'border-b border-border' : '')
                }
              >
                <span className="rounded-md bg-subtle-2 px-2 py-1 text-[10.5px] font-bold uppercase text-text-sec">
                  {r.format}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-text">{r.name}</div>
                  <div className="text-[11.5px] text-muted">
                    {r.size} · {formatHHMM(r.at)}
                  </div>
                </div>
                <Pill tone="green" dot>
                  Listo
                </Pill>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function formatHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function ExportCard({
  spec,
  isActive,
  children,
}: {
  spec: CardSpec;
  isActive: boolean;
  children?: React.ReactNode;
}) {
  const Icon = spec.icon;
  return (
    <div
      className={
        'flex flex-col gap-3 rounded-2xl border bg-bg p-4 transition-shadow ' +
        (isActive
          ? 'border-border shadow-[0_4px_12px_-8px_var(--color-primary)]'
          : 'border-border opacity-80')
      }
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: `color-mix(in oklab, ${spec.color} 18%, transparent)`,
            color: spec.color,
          }}
          aria-hidden
        >
          <Icon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="tn-h truncate text-[14.5px] font-bold">{spec.title}</h3>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{spec.description}</p>
        </div>
        {!isActive ? (
          <DownloadIcon size={18} style={{ color: 'var(--muted-color)' }} />
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {spec.formats.map((f) => (
          <span
            key={f}
            className="rounded-md bg-subtle-2 px-1.5 py-0.5 text-[10.5px] font-bold tracking-wide text-text-sec"
          >
            {f}
          </span>
        ))}
        {!isActive ? <Pill tone="muted">Próximamente</Pill> : null}
      </div>

      {children ? <div className="mt-1">{children}</div> : null}
    </div>
  );
}

function ScheduleExportForm({
  start,
  end,
  format,
  loading,
  error,
  onStartChange,
  onEndChange,
  onFormatChange,
  onDownload,
}: {
  start: string;
  end: string;
  format: ExportFormat;
  loading: boolean;
  error: string | null;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  onFormatChange: (v: ExportFormat) => void;
  onDownload: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
            Desde
          </span>
          <input
            type="date"
            value={start}
            onChange={(e) => onStartChange(e.target.value)}
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
            Hasta
          </span>
          <input
            type="date"
            value={end}
            min={start}
            onChange={(e) => onEndChange(e.target.value)}
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
            required
          />
        </label>
      </div>

      <div className="flex gap-1.5">
        {(['csv', 'xlsx'] as ExportFormat[]).map((f) => {
          const active = format === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => onFormatChange(f)}
              className={
                'flex-1 rounded-lg px-2 py-1.5 text-[12px] font-semibold transition-colors ' +
                (active
                  ? 'bg-primary text-white'
                  : 'border border-border bg-bg text-text-sec hover:bg-subtle-2')
              }
            >
              {f.toUpperCase()}
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="flex items-start gap-1.5 rounded-lg border border-border bg-subtle-bg p-2 text-[12px] text-red">
          <AlertIcon size={14} /> {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onDownload}
        disabled={loading}
        className="relative flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[13.5px] font-bold text-white shadow-[0_8px_18px_-10px_var(--color-primary)] transition-opacity disabled:opacity-60"
      >
        {loading ? (
          <Spinner aria-label="Generando" />
        ) : (
          <>
            <DownloadIcon size={15} stroke={2.4} />
            Descargar
          </>
        )}
      </button>
    </div>
  );
}
