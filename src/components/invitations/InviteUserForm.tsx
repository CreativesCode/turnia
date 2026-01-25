'use client';

import { createClient } from '@/lib/supabase/client';
import { useCallback, useState } from 'react';

const ROLES = [
  { value: 'viewer', label: 'Solo lectura' },
  { value: 'user', label: 'Usuario' },
  { value: 'team_manager', label: 'Gestor de equipo' },
  { value: 'org_admin', label: 'Administrador de organización' },
] as const;

type Props = {
  orgId: string;
  onSuccess: () => void;
};

export function InviteUserForm({ orgId, onSuccess }: Props) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('user');
  const [customMessage, setCustomMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [copied, setCopied] = useState(false);

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInviteLink(null);
    setEmailSent(false);
    setCopied(false);
    setLoading(true);
    
    const supabase = createClient();

    // Refrescar sesión para obtener un access_token válido (evita 401 Invalid JWT si expiró)
    const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr || !refreshData?.session?.access_token) {
      setError('Sesión expirada. Recarga la página e inicia sesión de nuevo.');
      setLoading(false);
      return;
    }

    try {
      const { data, error: fnError } = await supabase.functions.invoke('invite-user', {
        body: {
          org_id: orgId,
          email: email.trim(),
          role,
          custom_message: customMessage.trim() || undefined,
        },
      });
      setLoading(false);

      if (fnError) {
        setError(fnError.message || 'Error al invocar la función.');
        return;
      }
      const body = data as { ok?: boolean; invite_link?: string; email_sent?: boolean; error?: string; message?: string };
      if (body?.error || (body?.message && !body?.invite_link)) {
        setError(body.error || body.message || 'Error al crear la invitación');
        return;
      }
      if (!body?.invite_link) {
        setError('Error al crear la invitación.');
        return;
      }
      setInviteLink(body.invite_link);
      setEmailSent(body?.email_sent === true);
      setEmail('');
      setCustomMessage('');
      onSuccess();
    } catch (err) {
      setLoading(false);
      setError(String(err));
    }
  }, [orgId, role, customMessage, email, onSuccess]);

  const copyLink = useCallback(async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback para navegadores sin soporte de clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = inviteLink;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [inviteLink]);

  return (
    <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-text-primary">Invitar a la organización</h2>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="block text-sm font-medium text-text-secondary">
          Correo
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="correo@ejemplo.com"
            className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </label>
        <label className="block text-sm font-medium text-text-secondary">
          Rol
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-text-secondary">
          Mensaje personalizado (opcional)
          <textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Ej: Bienvenido al equipo de Urgencias"
            rows={2}
            className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {inviteLink && (
          <div className="rounded-lg border border-primary-200 bg-primary-50 p-3 text-sm text-text-secondary">
            <p className="font-medium text-primary-700">Invitación creada</p>
            {emailSent ? (
              <p className="mt-1 text-muted">Se ha enviado un correo con el enlace. Si no llega, revisa la carpeta de spam o copia el enlace a continuación.</p>
            ) : (
              <p className="mt-1 text-muted">Copia y comparte el enlace con la persona invitada (el envío por correo no está configurado).</p>
            )}
            <p className="mt-2 break-all text-muted">{inviteLink}</p>
            <button
              type="button"
              onClick={copyLink}
              className={`mt-2 font-medium ${copied ? 'text-green-600' : 'text-primary-600 hover:text-primary-700'}`}
            >
              {copied ? '¡Copiado!' : 'Copiar enlace'}
            </button>
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? 'Enviando…' : 'Crear invitación'}
        </button>
      </form>
    </div>
  );
}
