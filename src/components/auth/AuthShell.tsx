'use client';

import * as React from 'react';

/**
 * Cabecera mobile con logo cruz (cuadrado teal con +) + título grande + sub.
 * Usado en signup/forgot/reset/invite — mobile.jsx _AuthShell.
 */
export function AuthShellHeader({
  title,
  subtitle,
  align = 'center',
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: 'center' | 'left';
}) {
  const itemsAlign = align === 'center' ? 'items-center text-center' : 'items-start text-left';
  return (
    <div className={`flex flex-col ${itemsAlign}`}>
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{
          background:
            'linear-gradient(135deg, var(--color-primary-500), var(--color-primary-700))',
          boxShadow: '0 14px 30px -14px var(--color-primary-500)',
        }}
      >
        <div className="relative h-[22px] w-[22px]">
          <span className="absolute left-[9px] top-0 h-[22px] w-1 rounded-sm bg-white" />
          <span className="absolute left-0 top-[9px] h-1 w-[22px] rounded-sm bg-white" />
        </div>
      </div>
      <h1 className="tn-h mt-5 text-[26px] font-extrabold leading-[1.15]">{title}</h1>
      {subtitle ? (
        <p className="mt-2 px-2 text-sm leading-[1.5] text-muted">{subtitle}</p>
      ) : null}
    </div>
  );
}

/**
 * Layout mobile-first usado en signup/forgot/reset/invite.
 * Padding generoso, contenido flex-col con gap, footer opcional centrado.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  headerAlign = 'center',
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  headerAlign?: 'center' | 'left';
}) {
  return (
    <div className="mx-auto w-full max-w-[460px]">
      <div className="pt-6 sm:pt-12">
        <AuthShellHeader title={title} subtitle={subtitle} align={headerAlign} />
      </div>
      <div className="mt-8">{children}</div>
      {footer ? (
        <div className="mt-8 px-2 pb-6 text-center text-[13px] text-muted">{footer}</div>
      ) : null}
    </div>
  );
}
