'use client';

import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Icons } from '@/components/ui/icons';
import * as React from 'react';

export type DashboardDesktopHeaderProps = {
  title: string;
  subtitle?: string | null;
  /** Slot derecho: CTA contextual (ej. botón "Nuevo turno"). */
  actions?: React.ReactNode;
  /** Oculta el buscador global (default: visible). */
  hideSearch?: boolean;
};

/**
 * Header desktop estilo `DTopbar` del rediseño.
 * Diseño: ref docs/design/screens/desktop.jsx (línea 102).
 *
 * Estructura:
 *  - Izquierda: título Inter Tight 19 + subtítulo muted 12.
 *  - Derecha: buscador "Buscar turnos, personas… · ⌘K", botón notificaciones, slot `actions`.
 */
export function DashboardDesktopHeader({
  title,
  subtitle,
  actions,
  hideSearch,
}: DashboardDesktopHeaderProps) {
  return (
    <div className="-mx-8 -mt-8 mb-4 hidden md:block">
      <div className="border-b border-border bg-bg">
        <div className="flex h-16 items-center justify-between gap-4 px-7">
          {/* Izquierda: título */}
          <div className="min-w-0">
            <h1 className="tn-h truncate text-[19px] font-bold leading-tight tracking-[-0.02em] text-text">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-0.5 truncate text-[12px] text-muted">{subtitle}</p>
            ) : null}
          </div>

          {/* Derecha */}
          <div className="flex items-center gap-3">
            {!hideSearch ? <SearchHint /> : null}
            <NotificationButton />
            {actions}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Buscador placeholder (no funcional aún).
 */
function SearchHint() {
  return (
    <div
      className="hidden h-9 min-w-[280px] items-center gap-2 rounded-[10px] border border-border bg-subtle px-3 text-muted lg:flex"
      role="search"
      aria-label="Buscar"
    >
      <Icons.search size={15} />
      <span className="text-[12.5px]">Buscar turnos, personas…</span>
    </div>
  );
}

/**
 * Botón de notificaciones 36×36 con dot rojo cuando hay no leídas.
 * Reusa `NotificationBell` que ya implementa el dropdown y conteo no-leído.
 */
function NotificationButton() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-subtle text-text-sec">
      <NotificationBell />
    </div>
  );
}
