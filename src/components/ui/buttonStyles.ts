export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'icon';

export function getButtonVariantClass(variant: ButtonVariant) {
  switch (variant) {
    case 'primary':
      return 'bg-primary-600 text-white hover:bg-primary-700';
    case 'secondary':
      return 'border border-border bg-background text-text-secondary hover:bg-subtle-bg';
    case 'ghost':
      return 'bg-transparent text-text-secondary hover:bg-subtle-bg';
    case 'danger':
      return 'bg-red-600 text-white hover:bg-red-700';
  }
}

export function getButtonSizeClass(size: ButtonSize) {
  switch (size) {
    case 'sm':
      return 'min-h-[36px] px-3 py-2 text-sm';
    case 'md':
      return 'min-h-[44px] px-4 py-2.5 text-sm';
    case 'icon':
      return 'h-9 w-9 p-0';
  }
}

