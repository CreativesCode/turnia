import * as React from 'react';

import { cn } from '@/lib/cn';

export type StatProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Etiqueta corta del KPI ("Turnos este mes"). */
  label: string;
  /** Valor principal (string para soportar "142h", "94%", etc.). */
  value: React.ReactNode;
  /** Texto secundario debajo del valor (ej. "+4 vs mes pasado", "1 swap · 1 cesión"). */
  sub?: React.ReactNode;
  /** Icono opcional dentro de un cuadradito coloreado en la cabecera. */
  icon?: React.ReactNode;
  /** Color de acento del icono y del valor. Acepta un token CSS o un hex (#…). */
  accent?: string;
  /** Marca el `sub` en verde con tono positivo. */
  positive?: boolean;
};

/**
 * Tarjeta de KPI usada en homes y reportes.
 * Diseño: ref docs/design/screens/desktop.jsx (Stat línea 578) y mobile.jsx (KPI grid).
 */
export function Stat({
  label,
  value,
  sub,
  icon,
  accent,
  positive,
  className,
  ...rest
}: StatProps) {
  return (
    <div
      {...rest}
      className={cn(
        'rounded-2xl border border-border bg-surface p-4',
        className
      )}
    >
      <div className="flex items-center gap-2">
        {icon ? (
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={
              accent
                ? { backgroundColor: accent + '1A', color: accent }
                : undefined
            }
          >
            {icon}
          </div>
        ) : null}
        <span className="text-[12px] font-medium text-muted">{label}</span>
      </div>
      <div
        className="tn-h mt-2 text-[24px] font-extrabold leading-none"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
      {sub ? (
        <div
          className={cn(
            'mt-1 text-[11.5px]',
            positive ? 'text-green' : 'text-muted'
          )}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
}
