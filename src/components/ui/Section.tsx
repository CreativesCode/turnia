import * as React from 'react';

import { cn } from '@/lib/cn';

export type SectionProps = React.HTMLAttributes<HTMLElement> & {
  /** Título de la sección, en uppercase tracked. */
  title?: React.ReactNode;
  /** Contenido del slot derecho del header (link "Ver todo", botón…). */
  action?: React.ReactNode;
  /** El children se renderiza dentro de una tarjeta blanca con borde y radio 16. */
  children: React.ReactNode;
};

/**
 * Bloque agrupado: header en uppercase + tarjeta envolvente.
 * Diseño: ref docs/design/screens/mobile.jsx Section (línea 906).
 */
export function Section({
  title,
  action,
  children,
  className,
  ...rest
}: SectionProps) {
  return (
    <section {...rest} className={cn('mb-[18px]', className)}>
      {(title || action) ? (
        <div className="mx-1 mb-2 flex items-center justify-between">
          {title ? (
            <span className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted">
              {title}
            </span>
          ) : <span />}
          {action}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {children}
      </div>
    </section>
  );
}

export type SectionRowProps = React.HTMLAttributes<HTMLDivElement> & {
  icon?: React.ReactNode;
  label: React.ReactNode;
  /** Contenido del slot derecho (chevron, switch, pill…). Default: chevron-right. */
  trailing?: React.ReactNode;
  /** Quita el separador inferior (último item). */
  last?: boolean;
};

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

/**
 * Fila estándar dentro de una `Section` (icono + label + trailing).
 * Diseño: ref docs/design/screens/mobile.jsx RowM (línea 915).
 */
export function SectionRow({
  icon,
  label,
  trailing,
  last,
  className,
  ...rest
}: SectionRowProps) {
  return (
    <div
      {...rest}
      className={cn(
        'flex items-center gap-3 px-3.5 py-3.5',
        last ? '' : 'border-b border-border',
        className
      )}
    >
      {icon ? (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-subtle text-text-sec">
          {icon}
        </div>
      ) : null}
      <div className="flex-1 text-[13.5px] font-medium text-text">{label}</div>
      {trailing ?? <ChevronRight className="h-4 w-4 text-muted" />}
    </div>
  );
}
