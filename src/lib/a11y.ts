export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const nodes = Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),select:not([disabled]),textarea:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])'
    )
  );
  return nodes.filter((el) => !el.hasAttribute('aria-hidden'));
}

export function trapFocusWithin(e: KeyboardEvent, container: HTMLElement) {
  if (e.key !== 'Tab') return;

  const focusables = getFocusableElements(container);
  if (focusables.length === 0) {
    e.preventDefault();
    container.focus?.();
    return;
  }

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement as HTMLElement | null;

  if (e.shiftKey) {
    if (!active || active === first || !container.contains(active)) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (!active || !container.contains(active) || active === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

