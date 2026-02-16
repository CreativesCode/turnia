import * as React from 'react';
import Link, { type LinkProps } from 'next/link';

import { cn } from '@/lib/cn';
import { getButtonSizeClass, getButtonVariantClass, type ButtonSize, type ButtonVariant } from './buttonStyles';

type Props = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> &
  LinkProps & {
    variant?: ButtonVariant;
    size?: ButtonSize;
  };

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
        'inline-flex min-w-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'focus:outline-none',
        getButtonVariantClass(variant),
        getButtonSizeClass(size),
        className
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

