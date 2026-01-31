export type CacheEntry<T> = {
  v: 1;
  savedAt: number;
  data: T;
};

type GetCacheOptions = {
  /** Si se excede, se considera inválido y se borra */
  maxAgeMs?: number;
};

function safeGetItem(key: string): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string) {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  } catch {
    // ignore (quota / privacy)
  }
}

function safeRemoveItem(key: string) {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function setCache<T>(key: string, data: T) {
  const entry: CacheEntry<T> = { v: 1, savedAt: Date.now(), data };
  safeSetItem(key, JSON.stringify(entry));
}

export function getCacheEntry<T>(key: string, opts?: GetCacheOptions): CacheEntry<T> | null {
  const raw = safeGetItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed || parsed.v !== 1 || typeof parsed.savedAt !== 'number') {
      safeRemoveItem(key);
      return null;
    }
    if (opts?.maxAgeMs != null && Date.now() - parsed.savedAt > opts.maxAgeMs) {
      safeRemoveItem(key);
      return null;
    }
    return parsed;
  } catch {
    safeRemoveItem(key);
    return null;
  }
}

