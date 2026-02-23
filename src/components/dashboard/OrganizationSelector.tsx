'use client';

import { useSelectedOrg } from '@/hooks/useSelectedOrg';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(' ');
}

export function OrganizationSelector() {
  const { selectedOrgId, organizations, isLoading, setSelectedOrgId } = useSelectedOrg();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const selectedOrg = organizations.find((o) => o.id === selectedOrgId);

  if (isLoading) {
    return (
      <div className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2">
        <div className="h-4 w-4 animate-pulse rounded bg-subtle-bg" />
        <div className="h-4 flex-1 animate-pulse rounded bg-subtle-bg" />
      </div>
    );
  }

  if (organizations.length === 0) {
    return null;
  }

  // Si solo hay una organización, mostrar solo el nombre sin dropdown
  if (organizations.length === 1) {
    return (
      <div className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M7 7h.01" />
          <path d="M11 7h.01" />
          <path d="M15 7h.01" />
          <path d="M7 11h.01" />
          <path d="M11 11h.01" />
          <path d="M15 11h.01" />
          <path d="M7 15h.01" />
          <path d="M11 15h.01" />
          <path d="M15 15h.01" />
        </svg>
        <span className="truncate text-sm font-medium text-text-primary">{selectedOrg?.name || 'Organización'}</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors',
          isOpen ? 'bg-primary-50 text-primary-700' : 'hover:bg-subtle-bg text-text-secondary hover:text-text-primary'
        )}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M7 7h.01" />
          <path d="M11 7h.01" />
          <path d="M15 7h.01" />
          <path d="M7 11h.01" />
          <path d="M11 11h.01" />
          <path d="M15 11h.01" />
          <path d="M7 15h.01" />
          <path d="M11 15h.01" />
          <path d="M15 15h.01" />
        </svg>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{selectedOrg?.name || 'Seleccionar organización'}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn('shrink-0 transition-transform', isOpen ? 'rotate-180' : '')}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[300px] overflow-y-auto rounded-lg border border-border bg-background shadow-lg">
          {organizations.map((org) => {
            const isSelected = org.id === selectedOrgId;
            const isChild = !!org.parentId;
            return (
              <button
                key={org.id}
                type="button"
                onClick={() => {
                  setSelectedOrgId(org.id);
                  setIsOpen(false);
                  router.refresh();
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                  isChild && 'pl-6',
                  isSelected
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'text-text-secondary hover:bg-subtle-bg hover:text-text-primary'
                )}
              >
                {isChild && (
                  <span className="text-muted" aria-hidden>
                    ↳
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate">{org.name}</span>
                {isSelected && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
