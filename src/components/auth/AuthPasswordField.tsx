'use client';

import { Field, type FieldProps } from '@/components/ui/Field';
import { EyeIcon } from '@/components/ui/icons';
import * as React from 'react';

/**
 * Field mobile (label uppercase dentro de la caja) con icono leading + ojo trailing
 * para password. Usa `Field variant="mobile"` y agrega toggle de visibilidad.
 */
export type AuthPasswordFieldProps = Omit<FieldProps, 'type' | 'trailing' | 'variant'> & {
  /** Renderizar como variante desktop. Default: mobile. */
  desktop?: boolean;
};

export const AuthPasswordField = React.forwardRef<HTMLInputElement, AuthPasswordFieldProps>(
  function AuthPasswordField({ desktop, leading, ...rest }, ref) {
    const [visible, setVisible] = React.useState(false);
    return (
      <Field
        ref={ref}
        type={visible ? 'text' : 'password'}
        variant={desktop ? 'desktop' : 'mobile'}
        leading={leading}
        trailing={
          <button
            type="button"
            tabIndex={-1}
            aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            onClick={() => setVisible((v) => !v)}
            className="flex items-center justify-center rounded p-0.5 text-muted hover:text-text-sec"
          >
            <EyeIcon size={17} />
          </button>
        }
        {...rest}
      />
    );
  }
);
