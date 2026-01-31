'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'min-h-[100px] w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary',
        'placeholder:text-muted',
        'focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500',
        'disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
});

