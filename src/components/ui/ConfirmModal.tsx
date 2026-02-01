'use client';

import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  loading?: boolean;
};

/**
 * Modal de confirmación reutilizable. Compatible con SPA + Capacitor (touch, sin deps).
 * - Overlay: clic fuera cierra (onClose)
 * - Escape: cierra (onClose)
 * - variant danger: botón confirmar en rojo (eliminar, etc.)
 */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  loading = false,
}: Props) {
  const isDanger = variant === 'danger';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={message}
      closeOnEscape={!loading}
      panelClassName="max-w-sm"
      descriptionClassName="mt-2 text-sm text-text-secondary"
    >
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={isDanger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
