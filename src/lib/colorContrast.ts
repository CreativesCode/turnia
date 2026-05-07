/**
 * Devuelve '#fff' o '#000' según contraste con el color hex dado.
 * Usa luminancia relativa (Rec. 601 simplificada) y un umbral 0.6
 * que mantiene legibles los letras en oscuros (teal, púrpura, azul) y
 * a la vez pone negro sobre amarillos/ámbar/blancos.
 */
export function getContrastTextColor(hex: string): '#fff' | '#000' {
  const raw = (hex ?? '').replace('#', '').trim();
  if (raw.length !== 6) return '#fff';
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  if ([r, g, b].some((v) => !Number.isFinite(v))) return '#fff';
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#000' : '#fff';
}
