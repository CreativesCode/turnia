'use client';

import Link from 'next/link';

export type QuickAction = {
  id: string;
  title: string;
  description?: string;
  href?: string;
  onClick?: () => void;
};

export function QuickActions({
  title = 'Accesos rápidos',
  items,
}: {
  title?: string;
  items: QuickAction[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map((a) => {
          const content = (
            <>
              <div className="text-sm font-semibold text-text-primary">{a.title}</div>
              {a.description && <div className="mt-1 text-xs text-text-secondary">{a.description}</div>}
            </>
          );

          if (a.href) {
            return (
              <Link
                key={a.id}
                href={a.href}
                className="min-h-[64px] rounded-lg border border-border bg-subtle-bg px-4 py-3 text-left hover:border-primary-200 hover:bg-primary-50/40"
              >
                {content}
              </Link>
            );
          }

          return (
            <button
              key={a.id}
              type="button"
              onClick={a.onClick}
              className="min-h-[64px] rounded-lg border border-border bg-subtle-bg px-4 py-3 text-left hover:border-primary-200 hover:bg-primary-50/40"
            >
              {content}
            </button>
          );
        })}
      </div>
    </section>
  );
}

