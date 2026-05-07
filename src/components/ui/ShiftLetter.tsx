import * as React from 'react';

import { cn } from '@/lib/cn';
import { getContrastTextColor } from '@/lib/colorContrast';

export type ShiftLetterProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Letra a mostrar (D=Diurno, N=Nocturno, R=Refuerzo, V=Vacaciones, L=Libre, etc.). */
  letter: string;
  /** Color base del tipo de turno (hex). Se aplica como fondo sólido del círculo. */
  color: string;
  /** Tamaño total del círculo (px). Default 36. */
  size?: number;
  /**
   * Forma del marcador.
   * - `circle` (default): círculo sólido del color del tipo, letra en blanco/negro según contraste.
   * - `tinted`: cuadrado redondeado con fondo translúcido (color al 22%) y texto coloreado — diseño legacy.
   */
  variant?: 'circle' | 'tinted';
};

/**
 * Marcador con la letra del tipo de turno (D/N/R…) en color de tipo.
 * Diseño: círculo sólido con la letra en blanco/negro automáticamente según luminancia.
 */
export function ShiftLetter({
  letter,
  color,
  size = 36,
  variant = 'circle',
  className,
  style,
  ...rest
}: ShiftLetterProps) {
  const isCircle = variant === 'circle';
  const bg = isCircle ? color : `${color}22`;
  const textColor = isCircle ? getContrastTextColor(color) : color;
  const radius = isCircle ? '50%' : `${size * 0.28}px`;
  return (
    <div
      {...rest}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: bg,
        color: textColor,
        fontSize: size * 0.46,
        fontFamily: 'var(--font-inter-tight), var(--font-inter), system-ui, sans-serif',
        ...style,
      }}
      className={cn('flex shrink-0 items-center justify-center font-extrabold', className)}
    >
      {letter}
    </div>
  );
}
