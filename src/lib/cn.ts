export type ClassValue = string | number | false | null | undefined;

/**
 * Une classNames sin dependencias externas.
 * Similar a clsx(): filtra falsy y concatena con espacios.
 */
export function cn(...values: ClassValue[]): string {
  return values
    .flatMap((v) => (typeof v === 'number' ? String(v) : v))
    .filter(Boolean)
    .join(' ');
}

