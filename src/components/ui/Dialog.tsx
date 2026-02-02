'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { useDialogA11y } from '@/hooks/useDialogA11y';

type Props = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** z-index used on the fixed dialog container. */
  zIndex?: number;
  variant?: 'center' | 'sheet';
  /** Extra wrapper class around children. */
  contentClassName?: string;
  /** Disable the default spacing wrapper around children. */
  disableDefaultContentSpacing?: boolean;
  /**
   * Set false when another dialog is open on top.
   * Example: a ConfirmModal inside this dialog.
   */
  active?: boolean;
  closeOnEscape?: boolean;
  closeLabel?: string;
  showCloseButton?: boolean;
  containerClassName?: string;
  overlayClassName?: string;
  panelClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
};

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  zIndex = 50,
  variant = 'center',
  contentClassName,
  disableDefaultContentSpacing = false,
  active,
  closeOnEscape = true,
  closeLabel = 'Cerrar',
  showCloseButton = true,
  containerClassName,
  overlayClassName,
  panelClassName,
  titleClassName,
  descriptionClassName,
}: Props) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descId = React.useId();

  useDialogA11y({
    open,
    active,
    panelRef,
    onClose,
    closeOnEscape,
  });

  if (!open) return null;

  const containerBase =
    variant === 'sheet'
      ? 'fixed inset-0 flex items-end justify-center p-0 overflow-y-auto md:items-center md:p-4'
      : 'fixed inset-0 flex items-center justify-center p-4 overflow-y-auto';

  const panelBase =
    variant === 'sheet'
      ? 'relative w-full max-w-none max-h-[85dvh] overflow-y-auto rounded-t-2xl border border-b-0 border-border bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg md:max-w-md md:max-h-[90vh] md:rounded-xl md:border-b md:p-6'
      : 'relative w-full max-w-md my-auto max-h-[85dvh] overflow-y-auto rounded-xl border border-border bg-background p-6 shadow-lg';

  return (
    <div
      className={cn(containerBase, containerClassName)}
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descId : undefined}
    >
      <button
        type="button"
        onClick={onClose}
        className={cn('absolute inset-0 bg-black/50', overlayClassName)}
        aria-label={closeLabel}
        tabIndex={-1}
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          panelBase,
          'focus:outline-none focus:ring-2 focus:ring-primary-500',
          panelClassName
        )}
      >
        {showCloseButton ? (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted hover:bg-subtle-bg hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label={closeLabel}
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        ) : null}

        {title ? (
          <h2 id={titleId} className={cn('text-lg font-semibold text-text-primary', titleClassName)}>
            {title}
          </h2>
        ) : null}
        {description ? (
          <p id={descId} className={cn('mt-1 text-sm text-muted', descriptionClassName)}>
            {description}
          </p>
        ) : null}

        {disableDefaultContentSpacing ? (
          <div className={contentClassName}>{children}</div>
        ) : (
          <div className={cn(title || description ? 'mt-4' : undefined, contentClassName)}>{children}</div>
        )}
      </div>
    </div>
  );
}

