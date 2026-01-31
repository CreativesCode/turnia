'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = 'text', ...props },
  ref
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'min-h-[44px] w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary',
        'placeholder:text-muted',
        'focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500',
        'disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
});

