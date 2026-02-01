# Design System (UI Components)

Este proyecto usa Tailwind + variables CSS (ver `src/app/globals.css`) y una librería interna de componentes en `src/components/ui/`.

## Componentes base

- `Button`, `LinkButton`
  - Variants: `primary | secondary | ghost | danger`
  - Sizes: `sm | md | icon`
- `Input`, `Select`, `Textarea`
- `Dialog` (base para modales)
  - Incluye overlay, cierre con Escape, focus trap y restore focus (via `useDialogA11y`)
  - Variants: `center | sheet`
- `ConfirmModal` (usa `Dialog`)
- `ToastProvider` / `useToast`
- `Spinner`, `Skeleton`

## Reglas de consistencia

- Todos los controles interactivos deben respetar `min-h-[44px]` (touch target).
- Los icon-buttons deben tener nombre accesible (`aria-label` o `aria-labelledby`).
- Modales deben usar `Dialog` salvo casos excepcionales.

