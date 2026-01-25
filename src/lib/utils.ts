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
