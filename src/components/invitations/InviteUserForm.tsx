'use client';

import { Pill } from '@/components/ui/Pill';
import { CheckIcon, CopyIcon, MailIcon, SendIcon, XIcon } from '@/components/ui/icons';
import { Spinner } from '@/components/ui/Spinner';
import { createClient } from '@/lib/supabase/client';
import * as React from 'react';
import { useCallback, useRef, useState } from 'react';

const ROLES = [
  { value: 'viewer', label: 'Solo lectura' },
  { value: 'user', label: 'Usuario' },
  { value: 'team_manager', label: 'Gestor de equipo' },
  { value: 'org_admin', label: 'Admin de organización' },
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  orgId: string;
  onSuccess: () => void;
};

type Result = {
  email: string;
  ok: boolean;
  error?: string;
  inviteLink?: string;
  emailSent?: boolean;
};

export function InviteUserForm({ orgId, onSuccess }: Props) {
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [role, setRole] = useState<string>('user');
  const [customMessage, setCustomMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const commitDraft = useCallback(
    (raw: string) => {
      const tokens = raw
        .split(/[,;\n\s]+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      if (tokens.length === 0) return;
      setEmails((prev) => {
        const set = new Set(prev);
        for (const t of tokens) {
          if (!EMAIL_RE.test(t)) continue;
          set.add(t);
        }
        return Array.from(set);
      });
      setDraft('');
    },
    []
  );

  const removeEmail = useCallback((email: string) => {
    setEmails((prev) => prev.filter((e) => e !== email));
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',' || e.key === ';' || e.key === ' ') {
        if (draft.trim()) {
          e.preventDefault();
          commitDraft(draft);
        }
      } else if (e.key === 'Backspace' && draft === '' && emails.length > 0) {
        setEmails((prev) => prev.slice(0, -1));
      }
    },
    [draft, emails.length, commitDraft]
  );

  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData('text');
      if (text.includes(',') || text.includes(';') || text.includes('\n') || text.includes(' ')) {
        e.preventDefault();
        commitDraft(text);
      }
    },
    [commitDraft]
  );

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setResults(null);
      const all = [...emails];
      if (draft.trim() && EMAIL_RE.test(draft.trim().toLowerCase())) {
        all.push(draft.trim().toLowerCase());
      }
      const unique = Array.from(new Set(all));
      if (unique.length === 0) {
        setError('Añade al menos un correo válido.');
        return;
      }
      setLoading(true);

      const supabase = createClient();
      const { error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr) {
        setError('Sesión expirada. Recarga la página.');
        setLoading(false);
        return;
      }

      const settled = await Promise.allSettled(
        unique.map(async (email) => {
          const { data, error: fnError } = await supabase.functions.invoke('invite-user', {
            body: {
              org_id: orgId,
              email,
              role,
              custom_message: customMessage.trim() || undefined,
            },
          });
          if (fnError) throw new Error(fnError.message || 'Error al invocar la función.');
          const body = data as {
            ok?: boolean;
            invite_link?: string;
            email_sent?: boolean;
            error?: string;
            message?: string;
          };
          if (body?.error || (body?.message && !body?.invite_link)) {
            throw new Error(body.error || body.message || 'Error al crear la invitación');
          }
          if (!body?.invite_link) throw new Error('Error al crear la invitación.');
          return { email, ok: true, inviteLink: body.invite_link, emailSent: body.email_sent === true };
        }),
      );

      const out: Result[] = settled.map((s, i) =>
        s.status === 'fulfilled'
          ? s.value
          : { email: unique[i], ok: false, error: (s.reason as Error)?.message ?? 'Error' },
      );
      setResults(out);
      setLoading(false);
      const anyOk = out.some((r) => r.ok);
      if (anyOk) {
        setEmails([]);
        setDraft('');
        setCustomMessage('');
        onSuccess();
      }
    },
    [orgId, role, customMessage, emails, draft, onSuccess],
  );

  const copyLink = useCallback(async (link: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((c) => (c === idx ? null : c)), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = link;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((c) => (c === idx ? null : c)), 2000);
    }
  }, []);

  const buttonLabel = loading
    ? 'Enviando…'
    : emails.length > 0
      ? `Enviar ${emails.length} invitación${emails.length === 1 ? '' : 'es'}`
      : 'Enviar invitación';

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-bg p-5"
    >
      {/* Emails como chips multi-tag */}
      <div>
        <label className="mb-1.5 block text-[12.5px] font-semibold text-text-sec">
          Correos electrónicos
        </label>
        <div
          className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-xl border border-border bg-surface p-2 transition-shadow focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/20"
          onClick={() => inputRef.current?.focus()}
        >
          {emails.map((email) => (
            <span
              key={email}
              className="inline-flex items-center gap-1 rounded-full bg-primary-soft py-1 pl-2.5 pr-1 text-[12.5px] font-medium text-primary"
            >
              {email}
              <button
                type="button"
                aria-label={`Eliminar ${email}`}
                onClick={(e) => {
                  e.stopPropagation();
                  removeEmail(email);
                }}
                className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-primary/20"
              >
                <XIcon size={10} stroke={2.6} />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="email"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onBlur={() => {
              if (draft.trim()) commitDraft(draft);
            }}
            placeholder={emails.length === 0 ? 'correo@ejemplo.com, otro@ejemplo.com' : ''}
            className="min-w-[180px] flex-1 bg-transparent px-1.5 py-1 text-[14px] text-text placeholder:text-muted focus:outline-none"
            autoComplete="off"
          />
        </div>
        <p className="mt-1.5 text-[11.5px] text-muted">
          Pulsa <kbd className="rounded bg-subtle-2 px-1 font-mono text-[10px]">Enter</kbd> o pega una lista separada por comas.
        </p>
      </div>

      {/* Rol + Mensaje */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-text-sec">Rol</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-text-sec">Equipo</span>
          <select
            disabled
            className="rounded-xl border border-border bg-subtle-bg px-3 py-2.5 text-sm text-muted disabled:cursor-not-allowed"
            title="Próximamente"
          >
            <option>Sin asignar</option>
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-semibold text-text-sec">Mensaje personalizado (opcional)</span>
        <textarea
          value={customMessage}
          onChange={(e) => setCustomMessage(e.target.value)}
          placeholder="Bienvenido al equipo de Cardiología…"
          rows={2}
          className="resize-none rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20"
        />
      </label>

      {error ? (
        <p className="rounded-xl border border-border bg-subtle-bg p-3 text-[13px] text-red">{error}</p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading || (emails.length === 0 && !draft.trim())}
          className="relative inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-[14px] font-bold text-white shadow-[0_8px_22px_-10px_var(--color-primary)] transition-opacity disabled:opacity-60 sm:flex-none sm:px-5"
        >
          {loading ? <Spinner aria-label="Enviando" /> : <SendIcon size={15} stroke={2.4} />}
          {buttonLabel}
        </button>
      </div>

      {results && results.length > 0 ? (
        <section className="rounded-xl border border-border bg-subtle-bg p-3">
          <h3 className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">
            Resultados
          </h3>
          <ul className="flex flex-col gap-1.5">
            {results.map((r, i) => (
              <li
                key={`${r.email}-${i}`}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-bg p-2.5 text-[13px]"
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                  style={{
                    background: r.ok
                      ? 'color-mix(in oklab, var(--green) 22%, transparent)'
                      : 'color-mix(in oklab, var(--red) 22%, transparent)',
                    color: r.ok ? 'var(--green)' : 'var(--red)',
                  }}
                  aria-hidden
                >
                  {r.ok ? <CheckIcon size={13} stroke={2.6} /> : <XIcon size={13} stroke={2.6} />}
                </span>
                <span className="flex-1 truncate font-medium text-text">{r.email}</span>
                {r.ok ? (
                  <>
                    <Pill tone={r.emailSent ? 'green' : 'amber'}>
                      {r.emailSent ? 'Email enviado' : 'Sin email'}
                    </Pill>
                    {r.inviteLink ? (
                      <button
                        type="button"
                        onClick={() => copyLink(r.inviteLink!, i)}
                        className={
                          'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-semibold transition-colors ' +
                          (copiedIdx === i
                            ? 'bg-green-soft text-green'
                            : 'bg-primary-soft text-primary hover:bg-primary/15')
                        }
                      >
                        <CopyIcon size={12} />
                        {copiedIdx === i ? '¡Copiado!' : 'Copiar enlace'}
                      </button>
                    ) : null}
                  </>
                ) : (
                  <span className="truncate text-[12px] text-red">{r.error}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </form>
  );
}

/* Re-export icon used inline above to keep tree-shake working. */
export const _MailHint = MailIcon;
