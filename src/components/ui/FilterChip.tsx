'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

function ChevronDown({ className }: { className?: string }) {
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
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export type FilterChipProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: React.ReactNode;
  label: React.ReactNode;
  /** Color de acento (texto + borde tinted). Acepta hex o var CSS. */
  color?: string;
  /** Marca el chip como activo (anillo + fondo primary tint). */
  active?: boolean;
  /** Oculta el chevron de despliegue. */
  noChevron?: boolean;
};

/**
 * Chip de filtro con icono + label + chevron, usado en toolbars de calendario,
 * solicitudes y admin.
 * Diseño: ref docs/design/screens/desktop.jsx FilterChip (línea 429).
 */
export function FilterChip({
  icon,
  label,
  color,
  active,
  noChevron,
  className,
  style,
  ...rest
}: FilterChipProps) {
  const customStyle: React.CSSProperties | undefined = color
    ? {
        color,
        borderColor: color + '55',
        ...style,
      }
    : style;

  return (
    <button
      type="button"
      {...rest}
      style={customStyle}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-[10px] border px-3 text-[12.5px] font-medium transition-colors',
        active
          ? 'border-primary bg-primary-soft text-primary'
          : 'border-border bg-surface text-text-sec hover:bg-subtle',
        className
      )}
    >
      {icon}
      <span>{label}</span>
      {!noChevron ? <ChevronDown className="ml-0.5 h-[13px] w-[13px]" /> : null}
    </button>
  );
}
