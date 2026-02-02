'use client';

import { useEffect } from 'react';
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

function report(metric: Metric) {
  if (typeof window === 'undefined') return;
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log(`[Web Vitals] ${metric.name}:`, metric.value.toFixed(2), metric.rating, metric.id);
  }
  // En producción se puede enviar a analytics, e.g.:
  // fetch('/api/analytics/vitals', { method: 'POST', body: JSON.stringify(metric) });
}

export function WebVitalsReporter() {
  useEffect(() => {
    onCLS(report);
    onFCP(report);
    onINP(report);
    onLCP(report);
    onTTFB(report);
  }, []);
  return null;
}
