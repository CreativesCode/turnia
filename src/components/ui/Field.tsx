'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

export type FieldVariant = 'desktop' | 'mobile';

export type FieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label?: React.ReactNode;
  /** Texto de error mostrado debajo del input. */
  error?: React.ReactNode;
  /** Texto de ayuda secundario debajo del input. */
  hint?: React.ReactNode;
  /** Icono leading (mobile) o icono leading (desktop). */
  leading?: React.ReactNode;
  /** Slot derecho (ej. ojo de password, chevron, "⌘K"). */
  trailing?: React.ReactNode;
  /** Variante visual. `mobile` aplica el patrón con label uppercase dentro del input. */
  variant?: FieldVariant;
};

/**
 * Input con patrón visual del rediseño.
 * - `desktop`: label encima, input alto 46, focus ring `primary/22`.
 * - `mobile`: label uppercase dentro de la caja (encima del valor), alto 50.
 * Diseño: ref docs/design/screens/desktop.jsx DField (218) y mobile.jsx FieldM (142).
 */
export const Field = React.forwardRef<HTMLInputElement, FieldProps>(function Field(
  {
    label,
    error,
    hint,
    leading,
    trailing,
    variant = 'desktop',
    className,
    id,
    ...rest
  },
  ref
) {
  const reactId = React.useId();
  const inputId = id ?? reactId;
  const isInvalid = !!error;

  if (variant === 'mobile') {
    return (
      <div className={cn('flex flex-col', className)}>
        <div
          className={cn(
            'flex items-center gap-3 rounded-[14px] border-[1.5px] bg-surface px-3.5 py-2.5',
            'focus-within:ring-4 focus-within:ring-primary/20',
            isInvalid
              ? 'border-red focus-within:border-red focus-within:ring-red/20'
              : 'border-border focus-within:border-primary'
          )}
        >
          {leading ? <div className="text-muted">{leading}</div> : null}
          <div className="min-w-0 flex-1">
            {label ? (
              <label
                htmlFor={inputId}
                className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-muted"
              >
                {label}
              </label>
            ) : null}
            <input
              ref={ref}
              id={inputId}
              {...rest}
              aria-invalid={isInvalid || undefined}
              className="block w-full bg-transparent text-[15px] font-medium text-text placeholder:text-muted focus:outline-none"
              style={{ marginTop: label ? 2 : 0 }}
            />
          </div>
          {trailing ? <div className="text-muted">{trailing}</div> : null}
        </div>
        {error ? <p className="mt-1.5 text-xs text-red">{error}</p> : hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
      </div>
    );
  }

  // desktop
  return (
    <div className={cn('flex flex-col', className)}>
      {label ? (
        <label
          htmlFor={inputId}
          className="mb-1.5 text-[12.5px] font-semibold text-text-sec"
        >
          {label}
        </label>
      ) : null}
      <div
        className={cn(
          'flex h-[46px] items-center gap-2.5 rounded-xl border bg-surface px-3.5',
          'focus-within:ring-4 focus-within:ring-primary/20',
          isInvalid
            ? 'border-red focus-within:border-red focus-within:ring-red/20'
            : 'border-border focus-within:border-primary'
        )}
      >
        {leading ? <div className="text-muted">{leading}</div> : null}
        <input
          ref={ref}
          id={inputId}
          {...rest}
          aria-invalid={isInvalid || undefined}
          className="flex-1 bg-transparent text-[14px] font-medium text-text placeholder:text-muted focus:outline-none"
        />
        {trailing ? <div className="text-muted">{trailing}</div> : null}
      </div>
      {error ? <p className="mt-1.5 text-xs text-red">{error}</p> : hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
});
