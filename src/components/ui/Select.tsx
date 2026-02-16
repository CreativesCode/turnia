'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      className={cn(
        'min-h-[44px] w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary',
        'focus:border-primary-500 focus:outline-none',
        'disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
});

