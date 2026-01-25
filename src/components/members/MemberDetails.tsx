'use client';

import { useCallback, useEffect } from 'react';
import { ROLE_LABELS } from './role-labels';

export type MemberForDetails = {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  updated_at?: string;
  full_name: string | null;
  email: string | null;
};

type Props = {
  member: MemberForDetails;
  onClose: () => void;
  onEditRole: () => void;
};

/**
 * Modal con el detalle de un miembro. Muestra perfil y membership.
 * Botón "Editar rol" abre EditMembershipForm (manejado por el padre).
 */
export function MemberDetails({ member, onClose, onEditRole }: Props) {
  const onEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );
  useEffect(() => {
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [onEscape]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-details-title"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
        aria-label="Cerrar"
      />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-lg">
        <h2 id="member-details-title" className="text-lg font-semibold text-text-primary">
          Detalle del miembro
        </h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-text-secondary">Nombre</dt>
            <dd className="text-text-primary">{member.full_name?.trim() || '—'}</dd>
          </div>
          <div>
            <dt className="text-text-secondary">Correo</dt>
            <dd className="text-text-primary">{member.email || '—'}</dd>
          </div>
          <div>
            <dt className="text-text-secondary">Rol</dt>
            <dd className="text-text-primary">{ROLE_LABELS[member.role] || member.role}</dd>
          </div>
          <div>
            <dt className="text-text-secondary">Alta</dt>
            <dd className="text-text-primary">{new Date(member.created_at).toLocaleDateString()}</dd>
          </div>
          {member.updated_at && (
            <div>
              <dt className="text-text-secondary">Última actualización</dt>
              <dd className="text-text-primary">{new Date(member.updated_at).toLocaleDateString()}</dd>
            </div>
          )}
        </dl>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-subtle-bg"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={onEditRole}
            className="min-h-[44px] min-w-[44px] rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
          >
            Editar rol
          </button>
        </div>
      </div>
    </div>
  );
}
