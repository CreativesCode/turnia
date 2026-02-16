'use client';

import * as React from 'react';

import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/cn';

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
        'relative inline-flex min-w-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'focus:outline-none',
        'disabled:pointer-events-none disabled:opacity-50',
        getButtonVariantClass(variant),
        getButtonSizeClass(size),
        className
      )}
      {...props}
    >
      <span className={loading ? 'invisible' : undefined}>{children}</span>
      {loading ? (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
          <Spinner aria-label="Cargando" />
        </span>
      ) : null}
    </button>
  );
});

