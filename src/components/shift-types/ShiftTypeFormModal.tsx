'use client';

import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';

/** Opciones para selector 24 h: horas 00–23 y minutos 00–59 (sin AM/PM). */
const HOURS_24 = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

function parseTime24(value: string): { hour: string; minute: string } {
  const match = value.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return { hour: '00', minute: '00' };
  const h = Math.min(23, Math.max(0, parseInt(match[1], 10)));
  const m = Math.min(59, Math.max(0, parseInt(match[2], 10)));
  return { hour: h.toString().padStart(2, '0'), minute: m.toString().padStart(2, '0') };
}

function TimeSelect24({
  value,
  onChange,
  id,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (hhmm: string) => void;
  id?: string;
  'aria-label'?: string;
}) {
  const { hour, minute } = parseTime24(value || '00:00');
  const handleChange = (newHour: string, newMinute: string) => {
    onChange(`${newHour}:${newMinute}`);
  };
  const inputClass =
    'rounded-lg border border-border bg-background px-2 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none';
  return (
    <span className="inline-flex items-center gap-1" id={id}>
      <select
        aria-label={ariaLabel ? `${ariaLabel} (hora)` : 'Hora'}
        value={hour}
        onChange={(e) => handleChange(e.target.value, minute)}
        className={inputClass}
      >
        {HOURS_24.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="text-muted">:</span>
      <select
        aria-label={ariaLabel ? `${ariaLabel} (minutos)` : 'Minutos'}
        value={minute}
        onChange={(e) => handleChange(hour, e.target.value)}
        className={inputClass}
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </span>
  );
}

/** Paleta variada y bien diferenciada (incl. negro, amarillo, coral, etc. para combinar con tipos ya usados). */
const PREDEFINED_COLORS = [
  '#1E293B', // negro / slate oscuro
  '#FACC15', // amarillo
  '#16A34A', // verde
  '#DC2626', // rojo
  '#EA580C', // naranja
  '#7C3AED', // violeta
  '#2563EB', // azul
  '#0891B2', // cyan / teal
  '#DB2777', // rosa / magenta
  '#059669', // esmeralda
  '#64748B', // gris
  '#E11D48', // rose / coral
  '#84CC16', // lima
  '#0EA5E9', // azul cielo
];

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
  existingColors: string[];
};

export function ShiftTypeFormModal({
  open,
  onClose,
  onSuccess,
  orgId,
  editing,
  existingLetters,
  existingColors,
}: Props) {
  const [name, setName] = useState('');
  const [letter, setLetter] = useState('');
  const [color, setColor] = useState(PREDEFINED_COLORS[0]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [is24h, setIs24h] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // Evitar setState sincrónico dentro del effect (mejor para perf).
    const t = window.setTimeout(() => {
      if (editing) {
        setName(editing.name);
        setLetter(editing.letter);
        setColor(editing.color);
        const st = editing.start_time?.substring(0, 5) ?? '';
        const et = editing.end_time?.substring(0, 5) ?? '';
        const full24 =
          (et === '24:00' || et.startsWith('24:00')) && (st === '00:00' || st.startsWith('00:00'));
        setIs24h(!!full24);
        setStartTime(full24 ? '00:00' : st);
        setEndTime(full24 ? '23:59' : et === '24:00' || et.startsWith('24:00') ? '23:59' : et);
      } else {
        setName('');
        setLetter('');
        setColor(PREDEFINED_COLORS[0]);
        setStartTime('');
        setEndTime('');
        setIs24h(false);
      }
      setError(null);
    }, 0);
    return () => window.clearTimeout(t);
  }, [open, editing]);

  const generateColor = useCallback(() => {
    const used = new Set(existingColors.map((c) => c.toUpperCase()));
    const next = PREDEFINED_COLORS.find((c) => !used.has(c.toUpperCase()));
    setColor(next ?? PREDEFINED_COLORS[0]);
  }, [existingColors]);

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
    <Dialog
      open={open}
      onClose={onClose}
      closeOnEscape={!loading}
      title={editing ? 'Editar tipo de turno' : 'Nuevo tipo de turno'}
      panelClassName="max-w-sm"
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="block text-sm font-medium text-text-secondary">
            Nombre
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Mañana, Noche, 24h…"
              className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary placeholder:text-muted focus:border-primary-500 focus:outline-none"
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
              className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary placeholder:text-muted focus:border-primary-500 focus:outline-none"
            />
          </label>
          <div className="block">
            <span className="text-sm font-medium text-text-secondary">Color</span>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {PREDEFINED_COLORS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setColor(hex)}
                  title={hex}
                  aria-label={`Color ${hex}`}
                  className={`h-9 w-9 shrink-0 rounded-lg border-2 transition-shadow focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                    color.toUpperCase() === hex.toUpperCase()
                      ? 'border-primary-600 ring-2 ring-primary-200'
                      : 'border-border hover:border-primary-400'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
              {!PREDEFINED_COLORS.some((c) => c.toUpperCase() === color.toUpperCase()) && /^#[0-9A-Fa-f]{6}$/.test(color) && (
                <button
                  type="button"
                  onClick={() => setColor(color)}
                  title={`Actual: ${color}`}
                  aria-label="Mantener color actual"
                  className="h-9 w-9 shrink-0 rounded-lg border-2 border-primary-600 ring-2 ring-primary-200 transition-shadow focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                  style={{ backgroundColor: color }}
                />
              )}
              <button
                type="button"
                onClick={generateColor}
                title="Elegir siguiente color disponible"
                aria-label="Auto: siguiente color no usado"
                className="ml-1 shrink-0 cursor-pointer rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted hover:bg-subtle-bg hover:text-primary-600"
              >
                Auto
              </button>
            </div>
          </div>
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
              Horario <span className="font-normal text-muted">(formato 24 h; opcional; si fin &lt; inicio, cruza medianoche)</span>
              <div className="mt-1.5 flex flex-wrap items-center gap-3">
                <TimeSelect24
                  value={startTime}
                  onChange={setStartTime}
                  aria-label="Hora de inicio"
                />
                <span className="text-muted">–</span>
                <TimeSelect24
                  value={endTime}
                  onChange={setEndTime}
                  aria-label="Hora de fin"
                />
              </div>
              <p className="mt-1 text-xs text-muted">Formato 24 h (00–23). Sin AM/PM.</p>
            </label>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="min-h-[44px] min-w-[44px] cursor-pointer rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-subtle-bg disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="min-h-[44px] min-w-[44px] cursor-pointer rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? '…' : editing ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </form>
    </Dialog>
  );
}
