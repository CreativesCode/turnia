/**
 * Redirige tras login/signup. En Capacitor (app nativa) usa window.location
 * para evitar que router.replace() cierre o falle en el WebView.
 * En navegador usa router.replace() para navegación SPA.
 */
export function redirectAfterAuth(
  router: { replace: (path: string) => void },
  path: string
): void {
  if (typeof window === 'undefined') return;
  const fullUrl = path.startsWith('http')
    ? path
    : `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`;
  try {
    const { Capacitor } = require('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      window.location.href = fullUrl;
      return;
    }
  } catch {
    // @capacitor/core no disponible (build web sin Capacitor)
  }
  router.replace(path);
}
