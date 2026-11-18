import { useRef, useState, type ComponentProps } from 'react';

import { fieldInputClass, type FieldSize } from './Field';
import './Field.css';

export interface NumberFieldProps extends Omit<
  ComponentProps<'input'>,
  'type' | 'value' | 'onChange' | 'onBlur' | 'onKeyDown' | 'min' | 'max' | 'step' | 'size'
> {
  value: number;
  /** Called with a valid, changed value only (DESIGN.md 4.4). */
  onCommit: (value: number) => void;
  min: number;
  max: number;
  /** Arrow-key step; ArrowUp and ArrowDown apply it when no edit is in progress. */
  step?: number;
  integer?: boolean;
  /** Accessible name, required. */
  label: string;
  /** Unit shown after the control (dB, MHz). The field is narrower with a unit. */
  unit?: string;
  size?: FieldSize;
  /** Shows the danger border and `aria-invalid` for an error the parent knows about. */
  invalid?: boolean;
  /**
   * Read-only in use (DESIGN.md 4.4, 9.10): the value stays visible, focus stays in the field and
   * it is never stepped. Use this instead of `disabled` while a change is applying.
   */
  readOnly?: boolean;
}

/** Parses the draft; an empty draft is NaN (invalid), `null` means no edit in progress. */
function parseDraft(draft: string | null, value: number): number {
  if (draft === null) return value;
  return draft.trim() === '' ? Number.NaN : Number(draft);
}

function inRange(n: number, min: number, max: number, integer: boolean): boolean {
  return Number.isFinite(n) && n >= min && n <= max && (!integer || Number.isInteger(n));
}

/**
 * A number with a range, committed on Enter or blur; Escape reverts; ArrowUp and ArrowDown step
 * (DESIGN.md 4.4). An invalid entry is never sent: Enter keeps it visible for correction and blur
 * reverts it. Values are never clamped silently.
 */
export function NumberField({
  value,
  onCommit,
  min,
  max,
  step = 1,
  integer = false,
  label,
  unit,
  size = 'compact',
  invalid = false,
  readOnly = false,
  className,
  title,
  ...rest
}: NumberFieldProps) {
  const [draft, setDraftState] = useState<string | null>(null);
  // The ref is the draft the handlers see: a blur fired inside a key handler must not read a
  // stale draft from the last render.
  const draftRef = useRef<string | null>(null);
  const setDraft = (next: string | null) => {
    draftRef.current = next;
    setDraftState(next);
  };

  const parsed = parseDraft(draft, value);
  const outOfRange = !inRange(parsed, min, max, integer);
  const showInvalid = outOfRange || invalid;
  const rangeMessage = `Enter a ${integer ? 'whole ' : ''}number between ${min} and ${max}`;

  const commit = (revertInvalid: boolean) => {
    const text = draftRef.current;
    if (text === null) return;
    const next = parseDraft(text, value);
    if (!inRange(next, min, max, integer)) {
      if (revertInvalid) setDraft(null);
      return;
    }
    if (next !== value) onCommit(next);
    setDraft(null);
  };

  return (
    <>
      <input
        {...rest}
        type="number"
        aria-label={label}
        className={fieldInputClass(
          size,
          showInvalid,
          [className, unit ? 'ui-field__input--unit' : ''].filter(Boolean).join(' '),
        )}
        value={draft ?? String(value)}
        min={min}
        max={max}
        step={step}
        aria-invalid={showInvalid || undefined}
        readOnly={readOnly}
        title={outOfRange ? rangeMessage : title}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={() => {
          commit(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commit(false);
          } else if (event.key === 'Escape') {
            setDraft(null);
          } else if (
            (event.key === 'ArrowUp' || event.key === 'ArrowDown') &&
            draftRef.current === null &&
            !readOnly
          ) {
            event.preventDefault();
            const next = Math.min(
              max,
              Math.max(min, value + (event.key === 'ArrowUp' ? step : -step)),
            );
            if (next !== value) onCommit(next);
          }
        }}
      />
      {unit ? <span className="ui-field__unit">{unit}</span> : null}
    </>
  );
}
