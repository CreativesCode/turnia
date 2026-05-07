'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';
export type Accent = 'teal' | 'indigo' | 'emerald' | 'rose';

const STORAGE_KEY = 'turnia-theme';
const ACCENT_STORAGE_KEY = 'turnia-accent';
const DEFAULT_ACCENT: Accent = 'teal';

export const ACCENTS: Array<{ key: Accent; label: string; swatch: string }> = [
  { key: 'teal', label: 'Teal', swatch: '#14B8A6' },
  { key: 'indigo', label: 'Indigo', swatch: '#6366F1' },
  { key: 'emerald', label: 'Emerald', swatch: '#10B981' },
  { key: 'rose', label: 'Rose', swatch: '#F43F5E' },
];

type ThemeContextValue = {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
  toggle: () => void;
  accent: Accent;
  setAccent: (accent: Accent) => void;
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

function applyAccent(accent: Accent) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.accent = accent;
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

function readStoredAccent(): Accent | null {
  try {
    const raw = localStorage.getItem(ACCENT_STORAGE_KEY);
    if (raw === 'teal' || raw === 'indigo' || raw === 'emerald' || raw === 'rose') return raw;
    return null;
  } catch {
    return null;
  }
}

function writeStoredAccent(accent: Accent) {
  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, accent);
  } catch {
    // ignore
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() => readStoredTheme() ?? 'system');
  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => resolveTheme('system') === 'dark');
  const [accent, setAccentState] = useState<Accent>(() => readStoredAccent() ?? DEFAULT_ACCENT);

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

  useEffect(() => {
    applyAccent(accent);
    writeStoredAccent(accent);
  }, [accent]);

  const setTheme = useCallback((t: ThemePreference) => setThemeState(t), []);

  const toggle = useCallback(() => {
    setThemeState((prev) => (resolveTheme(prev) === 'dark' ? 'light' : 'dark'));
  }, []);

  const setAccent = useCallback((a: Accent) => setAccentState(a), []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggle, accent, setAccent }),
    [theme, resolvedTheme, setTheme, toggle, accent, setAccent]
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
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      className={
        className ??
        'flex h-9 w-9 items-center justify-center rounded-[10px] bg-subtle text-text-sec hover:bg-subtle-2 hover:text-text transition-colors'
      }
      aria-label={ariaLabel ?? 'Cambiar tema'}
      aria-pressed={isDark}
      title={isDark ? 'Cambiar a claro' : 'Cambiar a oscuro'}
    >
      {isDark ? <SunIcon className="h-[18px] w-[18px]" /> : <MoonIcon className="h-[18px] w-[18px]" />}
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
        'min-h-[44px] rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20'
      }
      aria-label="Tema"
    >
      <option value="system">Sistema</option>
      <option value="light">Claro</option>
      <option value="dark">Oscuro</option>
    </select>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

/**
 * Selector de color de acento (teal / indigo / emerald / rose).
 * Diseño: ref docs/design/screens/mobile.jsx AccentPicker.
 * Cuando se selecciona, actualiza `data-accent` en <html> y persiste en localStorage.
 */
export function AccentPicker({ className }: { className?: string }) {
  const { accent, setAccent } = useTheme();

  return (
    <div className={className ?? 'grid grid-cols-4 gap-2'} role="radiogroup" aria-label="Color de acento">
      {ACCENTS.map((a) => {
        const active = accent === a.key;
        return (
          <button
            key={a.key}
            type="button"
            onClick={() => setAccent(a.key)}
            role="radio"
            aria-checked={active}
            aria-label={a.label}
            className={
              'flex flex-col items-center gap-1.5 rounded-xl p-2 transition-colors ' +
              (active
                ? 'border-[1.5px]'
                : 'border-[1.5px] border-transparent bg-subtle hover:bg-subtle-2')
            }
            style={active ? { borderColor: a.swatch, backgroundColor: a.swatch + '1F' } : undefined}
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full text-white"
              style={{
                background: `linear-gradient(135deg, ${a.swatch}, ${a.swatch}cc)`,
                boxShadow: active ? `0 4px 14px -4px ${a.swatch}` : 'none',
              }}
            >
              {active ? <CheckIcon className="h-4 w-4" /> : null}
            </span>
            <span
              className="text-[10.5px] font-semibold"
              style={{ color: active ? a.swatch : 'var(--text-sec)' }}
            >
              {a.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Segmented selector "Claro / Oscuro" usado en la pantalla de Perfil (mobile).
 * Diseño: ref docs/design/screens/mobile.jsx ThemeRow.
 */
export function ThemeSegmented({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const options: Array<{ key: ResolvedTheme; label: string; icon: React.ReactNode }> = [
    { key: 'light', label: 'Claro', icon: <SunIcon className="h-[14px] w-[14px]" /> },
    { key: 'dark', label: 'Oscuro', icon: <MoonIcon className="h-[14px] w-[14px]" /> },
  ];

  return (
    <div
      className={
        className ??
        'flex gap-2 rounded-xl bg-subtle p-1'
      }
      role="radiogroup"
      aria-label="Modo de color"
    >
      {options.map((opt) => {
        const active = isDark ? opt.key === 'dark' : opt.key === 'light';
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => setTheme(opt.key)}
            role="radio"
            aria-checked={active}
            className={
              'flex h-[38px] flex-1 items-center justify-center gap-1.5 rounded-[9px] text-xs font-semibold transition-colors ' +
              (active
                ? 'bg-surface text-text shadow-[0_1px_3px_rgba(0,0,0,0.06)]'
                : 'text-muted hover:text-text-sec')
            }
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
