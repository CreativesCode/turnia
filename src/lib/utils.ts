/**
 * Genera un color hex a partir de un nombre (hash determinista). Útil para tipos de turno.
 * S=70%, L=45% para buena legibilidad. Para garantizar unicidad en la org, la app
 * puede iterar con hue+37 si el hex ya existe.
 */
export function generateColorFromName(name: string): string {
  let h = 0;
  const s = name.trim() || '0';
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  const hue = Math.abs(h) % 360;
  return hslToHex(hue, 0.7, 0.45);
}

function hslToHex(h: number, s: number, l: number): string {
  h = h / 360;
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

/**
 * Indica si un color hex es claro (true → usar texto negro) u oscuro (false → usar texto blanco).
 * Usa luminancia relativa aproximada.
 */
export function isColorLight(hex: string): boolean {
  const h = hex.replace(/^#/, '');
  if (h.length !== 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return L > 0.5;
}

/**
 * Formatea el horario de un tipo de turno (start_time, end_time).
 * - nulls → "—"
 * - 00:00–24:00 → "24h"
 * - fin < inicio (ej. 22:00–06:00) → "22:00–06:00 (día sig.)"
 * - resto → "08:00–16:00"
 */
export function formatShiftTypeSchedule(start: string | null, end: string | null): string {
  const s = start?.substring(0, 5) ?? '';
  const e = end?.substring(0, 5) ?? '';
  if (!s || !e) return '—';
  const is24h = (e === '24:00' || e.startsWith('24:00')) && (s === '00:00' || s.startsWith('00:00'));
  if (is24h) return '24h';
  const overnight = e < s;
  return overnight ? `${s}–${e} (día sig.)` : `${s}–${e}`;
}

/**
 * Genera un slug a partir de un texto: minúsculas, sin acentos, espacios→guiones.
 * Ej: "Mi Organización" → "mi-organizacion"
 */
export function generateSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
