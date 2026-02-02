'use client';

import { memo } from 'react';

export type CalendarEventContentProps = {
  title?: string;
  letter: string;
  color: string;
  name: string;
};

/**
 * Renderizado (React) del contenido de un evento FullCalendar.
 * Evita manipulación manual de DOM por evento.
 */
export const CalendarEventContent = memo(function CalendarEventContent({
  title,
  letter,
  color,
  name,
}: CalendarEventContentProps) {
  return (
    <div
      className="fc-event-main-frame"
      style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}
      title={title}
    >
      <span
        aria-hidden
        style={{
          width: 18,
          height: 18,
          minWidth: 18,
          minHeight: 18,
          borderRadius: '50%',
          background: '#fff',
          color,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          fontWeight: 700,
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        {letter}
      </span>
      <span
        style={{
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          color: '#fff',
        }}
      >
        {name}
      </span>
    </div>
  );
});

