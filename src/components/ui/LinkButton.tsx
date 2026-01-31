import * as React from 'react';
import Link, { type LinkProps } from 'next/link';

import { cn } from '@/lib/cn';
import type { ButtonSize, ButtonVariant } from '@/components/ui/Button';

type Props = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> &
  LinkProps & {
    variant?: ButtonVariant;
    size?: ButtonSize;
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

export function LinkButton({
  className,
  variant = 'secondary',
  size = 'md',
  children,
  ...props
}: Props) {
  return (
    <Link
      className={cn(
        'inline-flex min-w-[44px] items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-background',
        getVariantClass(variant),
        getSizeClass(size),
        className
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

