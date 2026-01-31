'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Spinner } from '@/components/ui/Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'icon';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

function getVariantClass(variant: ButtonVariant) {
  switch (variant) {
    case 'primary':
      return 'bg-primary-600 text-white hover:bg-primary-700';
    case 'secondary':
      return 'border border-border bg-background text-text-secondary hover:bg-subtle-bg';
    case 'ghost':
      return 'bg-transparent text-text-secondary hover:bg-subtle-bg';
    case 'danger':
      return 'bg-red-600 text-white hover:bg-red-700';
  }
}

function getSizeClass(size: ButtonSize) {
  switch (size) {
    case 'sm':
      return 'min-h-[36px] px-3 py-2 text-sm';
    case 'md':
      return 'min-h-[44px] px-4 py-2.5 text-sm';
    case 'icon':
      return 'h-9 w-9 p-0';
  }
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading = false, disabled, children, ...props },
  ref
) {
  const isDisabled = disabled || loading;

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
        getVariantClass(variant),
        getSizeClass(size),
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

