import { useState } from 'react';

interface Props {
  value: number;
  onCommit: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  integer?: boolean;
  disabled?: boolean;
  label: string;
  id?: string;
}

/** Numeric input that validates its range and commits on Enter/blur. */
export function NumberInput({
  value,
  onCommit,
  min,
  max,
  step = 1,
  integer,
  disabled,
  label,
  id,
}: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const parsed = draft === null ? value : draft.trim() === '' ? Number.NaN : Number(draft);
  const invalid =
    !Number.isFinite(parsed) ||
    parsed < min ||
    parsed > max ||
    (integer === true && !Number.isInteger(parsed));
  const commit = () => {
    if (draft === null) return;
    if (!invalid && parsed !== value) onCommit(parsed);
    setDraft(null);
  };
  return (
    <input
      id={id}
      type="number"
      className={invalid ? 'invalid' : undefined}
      aria-label={label}
      aria-invalid={invalid}
      title={
        invalid ? `Enter a ${integer ? 'whole ' : ''}number between ${min} and ${max}` : undefined
      }
      value={draft ?? String(value)}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setDraft(null);
      }}
    />
  );
}
