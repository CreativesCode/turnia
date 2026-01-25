'use client';

import { createClient } from '@/lib/supabase/client';
import { generateColorFromName } from '@/lib/utils';
import { useCallback, useEffect, useState } from 'react';

export type ShiftTypeRow = {
  id: string;
  org_id: string;
  name: string;
  letter: string;
  color: string;
  sort_order: number;
  start_time: string | null;
  end_time: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orgId: string;
  editing: ShiftTypeRow | null;
  existingLetters: string[];
};

export function ShiftTypeFormModal({
  open,
  onClose,
  onSuccess,
  orgId,
  editing,
  existingLetters,
}: Props) {
  const [name, setName] = useState('');
  const [letter, setLetter] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [is24h, setIs24h] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name);
        setLetter(editing.letter);
        setColor(editing.color);
        const st = editing.start_time?.substring(0, 5) ?? '';
        const et = editing.end_time?.substring(0, 5) ?? '';
        const full24 = (et === '24:00' || et.startsWith('24:00')) && (st === '00:00' || st.startsWith('00:00'));
        setIs24h(!!full24);
        setStartTime(full24 ? '00:00' : st);
        setEndTime(full24 ? '23:59' : (et === '24:00' || et.startsWith('24:00') ? '23:59' : et));
      } else {
        setName('');
        setLetter('');
        setColor('#3B82F6');
        setStartTime('');
        setEndTime('');
        setIs24h(false);
      }
      setError(null);
    }
  }, [open, editing]);

  const onEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && !loading) onClose();
    },
    [open, loading, onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [open, onEscape]);

  const generateColor = useCallback(() => {
    const base = generateColorFromName(name.trim() || 'tipo');
    setColor(base);
  }, [name]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      const letterTrim = letter.trim();
      const nameTrim = name.trim();
      if (!nameTrim || !letterTrim) {
        setError('Nombre y letra son obligatorios.');
        return;
      }
      if (letterTrim.length > 5) {
        setError('La letra no puede superar 5 caracteres.');
        return;
      }
      const letterUpper = letterTrim.toUpperCase();
      const conflicting = existingLetters.filter(
        (l) => l.toUpperCase() === letterUpper && (editing ? editing.letter.toUpperCase() !== letterUpper : true)
      );
      if (conflicting.length > 0) {
        setError('Esa letra ya está usada por otro tipo en esta organización.');
        return;
      }
      if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
        setError('Color debe ser un hex válido (#RRGGBB).');
        return;
      }

      setLoading(true);
      const supabase = createClient();
      const startVal = is24h ? '00:00' : (startTime.trim() || null);
      const endVal = is24h ? '24:00' : (endTime.trim() || null);
      const payload = {
        name: nameTrim,
        letter: letterTrim,
        color,
        start_time: startVal,
        end_time: endVal,
      };

      if (editing) {
        const { error: err } = await supabase
          .from('organization_shift_types')
          .update(payload)
          .eq('id', editing.id)
          .eq('org_id', orgId);
        setLoading(false);
        if (err) {
          setError(err.message);
          return;
        }
      } else {
        const { data: max } = await supabase
          .from('organization_shift_types')
          .select('sort_order')
          .eq('org_id', orgId)
          .order('sort_order', { ascending: false })
          .limit(1)
          .maybeSingle();
        const nextOrder = ((max as { sort_order?: number } | null)?.sort_order ?? -1) + 1;

        const { error: err } = await supabase.from('organization_shift_types').insert({
          org_id: orgId,
          ...payload,
          sort_order: nextOrder,
        });
        setLoading(false);
        if (err) {
          setError(err.message);
          return;
        }
      }
      onSuccess();
      onClose();
    },
    [name, letter, color, startTime, endTime, is24h, orgId, editing, existingLetters, onSuccess, onClose]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shift-type-modal-title"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
        aria-label="Cerrar"
      />
      <div className="relative w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-lg">
        <h2 id="shift-type-modal-title" className="text-lg font-semibold text-text-primary">
          {editing ? 'Editar tipo de turno' : 'Nuevo tipo de turno'}
        </h2>
        <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
          <label className="block text-sm font-medium text-text-secondary">
            Nombre
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Mañana, Noche, 24h…"
              className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </label>
          <label className="block text-sm font-medium text-text-secondary">
            Letra <span className="font-normal text-muted">(1–5 caracteres, única en la org)</span>
            <input
              type="text"
              value={letter}
              onChange={(e) => setLetter(e.target.value)}
              required
              maxLength={5}
              placeholder="M, N, H…"
              className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </label>
          <label className="block text-sm font-medium text-text-secondary">
            Color
            <div className="mt-1.5 flex gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-11 w-14 shrink-0 cursor-pointer rounded-lg border border-border p-1"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#3B82F6"
                pattern="^#[0-9A-Fa-f]{6}$"
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-sm text-text-primary placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <button
                type="button"
                onClick={generateColor}
                title="Generar color desde el nombre"
                aria-label="Generar color desde el nombre"
                className="shrink-0 rounded-lg border border-border px-3 py-2.5 text-sm text-muted hover:bg-subtle-bg hover:text-primary-600"
              >
                Auto
              </button>
            </div>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={is24h}
              onChange={(e) => {
                setIs24h(e.target.checked);
                if (e.target.checked) {
                  setStartTime('00:00');
                  setEndTime('23:59');
                }
              }}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-sm font-medium text-text-secondary">Turno 24h (00:00–24:00)</span>
          </label>
          {!is24h && (
            <label className="block text-sm font-medium text-text-secondary">
              Horario <span className="font-normal text-muted">(opcional; si fin &lt; inicio, cruza medianoche)</span>
              <div className="mt-1.5 flex flex-wrap gap-3">
                <span className="flex items-center gap-2">
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  <span className="text-muted">–</span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </span>
              </div>
            </label>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="min-h-[44px] min-w-[44px] rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-subtle-bg disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="min-h-[44px] min-w-[44px] rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? '…' : editing ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
