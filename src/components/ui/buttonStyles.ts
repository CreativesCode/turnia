export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'cta';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export function getButtonVariantClass(variant: ButtonVariant) {
  switch (variant) {
    case 'primary':
      return 'bg-primary text-white hover:bg-primary-dark';
    case 'cta':
      // CTA elevado: misma base que primary, con sombra teñida del color primario.
      return 'bg-primary text-white hover:bg-primary-dark shadow-[0_8px_22px_-10px_var(--primary)]';
    case 'secondary':
      return 'border border-border bg-surface text-text-sec hover:bg-subtle';
    case 'ghost':
      return 'bg-transparent text-text-sec hover:bg-subtle';
    case 'danger':
      return 'bg-red text-white hover:opacity-90';
  }
}

export function getButtonSizeClass(size: ButtonSize) {
  switch (size) {
    case 'sm':
      return 'min-h-[36px] px-3 py-2 text-sm';
    case 'md':
      return 'min-h-[44px] px-4 py-2.5 text-sm';
    case 'lg':
      return 'min-h-[50px] px-5 py-3 text-[14.5px] font-semibold';
    case 'icon':
      return 'h-9 w-9 p-0';
  }
}
