'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

export type SwitchProps = {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
};

/**
 * Toggle binario de 42×24 en el estilo del mockup.
 * Diseño: ref docs/design/screens/mobile.jsx Switch (línea 925).
 */
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  ariaLabel,
  className,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        'relative inline-flex h-6 w-[42px] shrink-0 items-center rounded-full p-[2px] transition-colors',
        'focus:outline-none focus:ring-4 focus:ring-primary/20',
        'disabled:opacity-50 disabled:pointer-events-none',
        checked ? 'bg-primary justify-end' : 'bg-subtle-2 justify-start',
        className
      )}
    >
      <span
        className="block h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
        aria-hidden
      />
    </button>
  );
}
