'use client';

import * as React from 'react';

import { ThemeProvider } from '@/components/theme/theme';
import { ToastProvider } from '@/components/ui/toast/ToastProvider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  );
}

