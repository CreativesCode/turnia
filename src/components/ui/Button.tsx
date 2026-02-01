'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Spinner } from '@/components/ui/Spinner';

import { getButtonSizeClass, getButtonVariantClass, type ButtonSize, type ButtonVariant } from './buttonStyles';
export type { ButtonSize, ButtonVariant } from './buttonStyles';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading = false, disabled, children, ...props },
  ref
) {
  const isDisabled = disabled || loading;

  if (process.env.NODE_ENV !== 'production') {
    const ariaLabel = props['aria-label'];
    const ariaLabelledBy = props['aria-labelledby'];
    if (size === 'icon' && !ariaLabel && !ariaLabelledBy) {
      // eslint-disable-next-line no-console
      console.warn(
        '[Button] size="icon" should have an accessible name (aria-label or aria-labelledby).'
      );
    }
  }

  return (
    <button
      ref={ref}
      type={props.type ?? 'button'}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex min-w-[44px] items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-50',
        getButtonVariantClass(variant),
        getButtonSizeClass(size),
        className
      )}
      {...props}
    >
      {loading ? (
        <>
          <Spinner aria-label="Cargando" />
          <span className="sr-only">Cargando</span>
        </>
      ) : null}
      <span className={loading ? 'opacity-0' : undefined}>{children}</span>
    </button>
  );
});

