'use client';

import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function OfflinePill({
  variant = 'pill',
  className,
}: {
  variant?: 'pill' | 'dot';
  className?: string;
}) {
  const { isOnline } = useOnlineStatus();
  if (isOnline) return null;

  if (variant === 'dot') {
    return (
      <span
        className={className ?? 'inline-flex h-2.5 w-2.5 rounded-full bg-amber-500'}
        role="status"
        aria-live="polite"
        aria-label="Sin conexión"
        title="Sin conexión"
      />
    );
  }

  return (
    <span
      className={
        className ??
        'inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800'
      }
      role="status"
      aria-live="polite"
    >
      <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
      Sin conexión
    </span>
  );
}

