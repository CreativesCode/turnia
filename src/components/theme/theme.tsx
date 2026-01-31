'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'turnia-theme';

type ThemeContextValue = {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveTheme(theme: ThemePreference): ResolvedTheme {
  if (theme === 'dark') return 'dark';
  if (theme === 'light') return 'light';
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyResolvedTheme(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

function readStoredTheme(): ThemePreference | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
    return null;
  } catch {
    return null;
  }
}

function writeStoredTheme(theme: ThemePreference) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() => readStoredTheme() ?? 'system');
  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => resolveTheme('system') === 'dark');

  const resolvedTheme: ResolvedTheme = useMemo(() => {
    return theme === 'system' ? (systemIsDark ? 'dark' : 'light') : theme;
  }, [theme, systemIsDark]);

  useEffect(() => {
    const mql = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mql) return;
    const onChange = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    applyResolvedTheme(resolvedTheme);
    writeStoredTheme(theme);
  }, [resolvedTheme, theme]);

  const setTheme = useCallback((t: ThemePreference) => setThemeState(t), []);

  const toggle = useCallback(() => {
    setThemeState((prev) => (resolveTheme(prev) === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggle }),
    [theme, resolvedTheme, setTheme, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3a7 7 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

export function ThemeToggleButton({
  className,
  ariaLabel,
}: {
  className?: string;
  ariaLabel?: string;
}) {
  const { resolvedTheme, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      className={
        className ??
        'flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-subtle-bg hover:text-text-primary'
      }
      aria-label={ariaLabel ?? 'Cambiar tema'}
    >
      {resolvedTheme === 'dark' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
    </button>
  );
}

export function ThemeSelect({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <select
      value={theme}
      onChange={(e) => setTheme(e.target.value as ThemePreference)}
      className={
        className ??
        'min-h-[44px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500'
      }
      aria-label="Tema"
    >
      <option value="system">Sistema</option>
      <option value="light">Claro</option>
      <option value="dark">Oscuro</option>
    </select>
  );
}

