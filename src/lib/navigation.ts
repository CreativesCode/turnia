/**
 * Redirige tras login/signup. En Capacitor (app nativa) usa router.replace()
 * para navegación SPA correcta. En navegador también usa router.replace().
 */
export function redirectAfterAuth(
  router: { replace: (path: string) => void },
  path: string
): void {
  if (typeof window === 'undefined') return;
  
  // Normalizar la ruta para asegurar que empiece con /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  // Usar router.replace() tanto en Capacitor como en web
  // para mantener la navegación SPA y evitar recargas completas
  router.replace(normalizedPath);
}
