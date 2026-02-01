'use client';

import { useEffect, useRef, type RefObject } from 'react';

import { getFocusableElements, trapFocusWithin } from '@/lib/a11y';

export type UseDialogA11yOptions = {
  /** Whether the dialog is open. For conditionally rendered modals, you can pass `true`. */
  open: boolean;
  /**
   * Whether the dialog should actively manage focus right now.
   * Useful when a nested dialog is open on top (set `active=false` on the parent).
   */
  active?: boolean;
  /** The panel element that contains focusable elements. */
  panelRef: RefObject<unknown>;
  /** Called on Escape (when enabled). */
  onClose?: () => void;
  /** Close on Escape (default true). */
  closeOnEscape?: boolean;
  /** Trap focus within panel (default true). */
  trapFocus?: boolean;
  /** Move focus into dialog on open (default true). */
  focusOnOpen?: boolean;
  /** Restore focus to previously focused element on close/unmount (default true). */
  restoreFocus?: boolean;
};

export function useDialogA11y({
  open,
  active,
  panelRef,
  onClose,
  closeOnEscape = true,
  trapFocus: shouldTrapFocus = true,
  focusOnOpen = true,
  restoreFocus = true,
}: UseDialogA11yOptions) {
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const capturedRef = useRef(false);

  // Capture the previously-focused element once per "open" cycle.
  useEffect(() => {
    if (!restoreFocus) return;
    if (open && !capturedRef.current) {
      lastFocusedElementRef.current =
        (typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null) ?? null;
      capturedRef.current = true;
      return;
    }
    if (!open) capturedRef.current = false;
  }, [open, restoreFocus]);

  // Focus the first focusable element inside the dialog (or the panel itself).
  useEffect(() => {
    if (!open) return;
    if (active === false) return;
    if (!focusOnOpen) return;

    const t = window.setTimeout(() => {
      const panel = panelRef.current;
      if (typeof HTMLElement === 'undefined') return;
      if (!(panel instanceof HTMLElement)) return;
      const focusables = getFocusableElements(panel);
      (focusables[0] ?? panel).focus?.();
    }, 0);

    return () => window.clearTimeout(t);
  }, [open, active, focusOnOpen, panelRef]);

  // Key handling: Escape + focus trap.
  useEffect(() => {
    if (!open) return;
    if (active === false) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (closeOnEscape && onClose && e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      const panel = panelRef.current;
      if (typeof HTMLElement === 'undefined') return;
      if (shouldTrapFocus && panel instanceof HTMLElement) trapFocusWithin(e, panel);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, active, panelRef, onClose, closeOnEscape, shouldTrapFocus]);

  // Restore focus when `open` flips to false while still mounted.
  useEffect(() => {
    if (!restoreFocus) return;
    if (open) return;
    if (!capturedRef.current) return;
    lastFocusedElementRef.current?.focus?.();
    capturedRef.current = false;
  }, [open, restoreFocus]);

  // Restore focus on unmount (covers conditionally-rendered modals).
  useEffect(() => {
    if (!restoreFocus) return;
    return () => {
      if (!capturedRef.current) return;
      lastFocusedElementRef.current?.focus?.();
      capturedRef.current = false;
    };
  }, [restoreFocus]);
}

