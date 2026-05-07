import * as React from 'react';

import { cn } from '@/lib/cn';

export type PillTone =
  | 'primary'
  | 'amber'
  | 'red'
  | 'green'
  | 'blue'
  | 'violet'
  | 'muted'
  | 'neutral';

export type PillProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: PillTone;
  /** Variante con fondo translúcido (default) o sólido. */
  soft?: boolean;
  /** Muestra un punto del color de la píldora a la izquierda. */
  dot?: boolean;
  /** Color CSS arbitrario; sobreescribe `tone`. Útil para colores de tipo de turno (#14B8A6, etc.). */
  color?: string;
};

function softBgFor(tone: PillTone) {
  switch (tone) {
    case 'primary': return 'bg-primary-soft text-primary';
    case 'amber':   return 'bg-amber-soft text-amber';
    case 'red':     return 'bg-red-soft text-red';
    case 'green':   return 'bg-green-soft text-green';
    case 'blue':    return 'bg-blue-soft text-blue';
    case 'violet':  return 'bg-violet-soft text-violet';
    case 'muted':   return 'bg-subtle-2 text-muted';
    case 'neutral': return 'bg-subtle text-text-sec';
  }
}

function solidBgFor(tone: PillTone) {
  switch (tone) {
    case 'primary': return 'bg-primary text-white';
    case 'amber':   return 'bg-amber text-white';
    case 'red':     return 'bg-red text-white';
    case 'green':   return 'bg-green text-white';
    case 'blue':    return 'bg-blue text-white';
    case 'violet':  return 'bg-violet text-white';
    case 'muted':   return 'bg-muted text-white';
    case 'neutral': return 'bg-text text-bg';
  }
}

/**
 * Píldora compacta para estados (Pendiente, Activo, Tuyo…), conteos y etiquetas.
 * Diseño: ref docs/design/screens/desktop.jsx Pill (línea 126).
 */
export function Pill({
  tone = 'primary',
  soft = true,
  dot = false,
  color,
  className,
  children,
  style,
  ...rest
}: PillProps) {
  const useCustomColor = !!color;
  const toneClass = useCustomColor
    ? ''
    : soft
      ? softBgFor(tone)
      : solidBgFor(tone);

  // Cuando se pasa `color`, generamos los estilos inline (~12% bg en soft, sólido en !soft)
  const customStyle: React.CSSProperties | undefined = useCustomColor
    ? soft
      ? { backgroundColor: color + '20', color }
      : { backgroundColor: color, color: '#fff' }
    : undefined;

  return (
    <span
      {...rest}
      style={{ ...customStyle, ...style }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold leading-none',
        toneClass,
        className
      )}
    >
      {dot ? (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: 'currentColor' }}
        />
      ) : null}
      {children}
    </span>
  );
}
