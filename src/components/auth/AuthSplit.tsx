import { AuthBrandPanel } from './AuthBrandPanel';

/**
 * Layout 50/50 desktop: panel teal a la izquierda + formulario centrado a la derecha.
 * En mobile el panel se oculta y el contenido ocupa el ancho completo.
 */
export function AuthSplit({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <AuthBrandPanel />
      <main className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-[460px]">{children}</div>
      </main>
    </div>
  );
}
