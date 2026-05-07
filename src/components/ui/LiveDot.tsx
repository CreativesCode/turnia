import * as React from 'react';

import { cn } from '@/lib/cn';

export type LiveDotProps = React.HTMLAttributes<HTMLSpanElement> & {
  /** Color del dot. Default: var(--green) (status "de guardia"). */
  color?: string;
  /** Tamaño en px del dot interior. Default 8. */
  size?: number;
  /** Desactiva el halo expansivo (útil cuando no hay actividad). */
  static?: boolean;
};

/**
 * Indicador "live" con halo pulsante (de guardia ahora, notificación nueva, etc.).
 * Diseño: ref docs/design/screens/desktop.jsx (DStaffHome on-call) y mobile.jsx.
 */
export function LiveDot({
  color = 'var(--green)',
  size = 8,
  static: isStatic,
  className,
  style,
  ...rest
}: LiveDotProps) {
  return (
    <span
      {...rest}
      className={cn('relative inline-flex', className)}
      style={{ width: size, height: size, ...style }}
    >
      {!isStatic ? (
        <span
          className="absolute inset-0 rounded-full"
          style={{
            backgroundColor: color,
            animation: 'tn-ping 1.8s ease-out infinite',
          }}
          aria-hidden
        />
      ) : null}
      <span
        className="relative block rounded-full"
        style={{ width: size, height: size, backgroundColor: color }}
      />
    </span>
  );
}
