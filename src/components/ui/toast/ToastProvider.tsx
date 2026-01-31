'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

export type ToastVariant = 'info' | 'success' | 'error';

export type ToastInput = {
  title?: string;
  message: string;
  variant?: ToastVariant;
  durationMs?: number;
};

type ToastItem = Required<Pick<ToastInput, 'message'>> &
  Pick<ToastInput, 'title'> & {
    id: string;
    variant: ToastVariant;
    createdAt: number;
    durationMs: number;
  };

type ToastContextValue = {
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

function uid() {
  // crypto.randomUUID() no siempre disponible en todos los entornos webview
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c: any = globalThis.crypto;
    if (c?.randomUUID) return c.randomUUID() as string;
  } catch {
    // ignore
  }
  return `t_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function variantClasses(variant: ToastVariant) {
  switch (variant) {
    case 'success':
      return 'border-primary-200 bg-primary-50 text-text-primary dark:border-primary-800/50 dark:bg-primary-950/40';
    case 'error':
      return 'border-red-200 bg-red-50 text-text-primary dark:border-red-900/50 dark:bg-red-950/40';
    case 'info':
    default:
      return 'border-border bg-background text-text-primary';
  }
}

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
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const timersRef = React.useRef(new Map<string, number>());

  const dismiss = React.useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const handle = timersRef.current.get(id);
    if (handle) window.clearTimeout(handle);
    timersRef.current.delete(id);
  }, []);

  const clear = React.useCallback(() => {
    setItems([]);
    timersRef.current.forEach((h) => window.clearTimeout(h));
    timersRef.current.clear();
  }, []);

  const toast = React.useCallback(
    (input: ToastInput) => {
      const id = uid();
      const next: ToastItem = {
        id,
        title: input.title,
        message: input.message,
        variant: input.variant ?? 'info',
        durationMs: input.durationMs ?? 4200,
        createdAt: Date.now(),
      };

      setItems((prev) => {
        const merged = [next, ...prev];
        return merged.slice(0, 4); // evita spam visual
      });

      if (next.durationMs > 0) {
        const handle = window.setTimeout(() => dismiss(id), next.durationMs);
        timersRef.current.set(id, handle);
      }

      return id;
    },
    [dismiss]
  );

  React.useEffect(() => {
    return () => {
      timersRef.current.forEach((h) => window.clearTimeout(h));
      timersRef.current.clear();
    };
  }, []);

  const value = React.useMemo(() => ({ toast, dismiss, clear }), [toast, dismiss, clear]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-60 flex flex-col items-center gap-2 p-3 sm:items-end"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto w-full max-w-[420px] rounded-xl border p-3 shadow-lg',
              variantClasses(t.variant)
            )}
            role="status"
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {t.title ? <p className="text-sm font-semibold">{t.title}</p> : null}
                <p className={cn('text-sm', t.title ? 'mt-0.5' : undefined)}>{t.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-subtle-bg hover:text-text-primary"
                aria-label="Cerrar notificación"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

