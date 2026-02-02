'use client';

import * as React from 'react';

import { WebVitalsReporter } from '@/components/performance/WebVitalsReporter';
import { ThemeProvider } from '@/components/theme/theme';
import { ToastProvider } from '@/components/ui/toast/ToastProvider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <WebVitalsReporter />
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  );
}

