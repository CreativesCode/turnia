'use client';

import { cn } from '@/lib/cn';
import * as React from 'react';

export type AppBarProps = {
  /** Título principal del app bar (Inter Tight). */
  title: React.ReactNode;
  /** Subtítulo opcional (muted, 13px). */
  subtitle?: React.ReactNode;
  /** Slot izquierdo (ej. botón back, avatar, logo). */
  leading?: React.ReactNode;
  /** Slot derecho (ej. acciones — usa `AppBarAction` o pills). */
  right?: React.ReactNode;
  /** Variante extendida: título 28px (mockup `MHomeStaff` / `MAvailability`). */
  big?: boolean;
  className?: string;
};

/**
 * Header de página para vistas mobile.
 * Diseño: ref docs/design/screens/mobile.jsx MAppBar (línea 55).
 *
 * - `big=false` (default): padding 10/20/12, alineado al centro, título 18px.
 * - `big=true`: padding 12/20/8, alineado al final, título 28px.
 */
export function AppBar({
  title,
  subtitle,
  leading,
  right,
  big,
  className,
}: AppBarProps) {
  return (
    <div
      className={cn(
        'flex justify-between gap-3 px-5',
        big ? 'items-end pb-2 pt-3' : 'items-center pb-3 pt-2.5',
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {leading}
        <div className="min-w-0">
          <h1
            className={cn(
              'tn-h truncate font-bold tracking-[-0.02em] text-text',
              big ? 'text-[28px] leading-[1.1]' : 'text-[18px] leading-[1.1]'
            )}
          >
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 truncate text-[13px] text-muted">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {right}
    </div>
  );
}

export type AppBarActionProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Si está activo, aplica fondo y color primary (estado seleccionado). */
  active?: boolean;
};

/**
 * Botón cuadrado 38×38 para el slot `right` del `AppBar`.
 * Diseño: ref docs/design/screens/mobile.jsx (cuadros con `theme.subtle2`).
 */
export function AppBarAction({
  active,
  className,
  ...rest
}: AppBarActionProps) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        'flex h-[38px] w-[38px] items-center justify-center rounded-[11px] transition-colors',
        active
          ? 'bg-primary-soft text-primary'
          : 'bg-subtle-2 text-text-sec hover:text-text',
        className
      )}
    />
  );
}
