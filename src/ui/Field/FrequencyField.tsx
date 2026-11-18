import { useRef, useState, type ComponentProps } from 'react';

import { formatFrequency, parseFrequency } from '../../format/frequency';
import { fieldInputClass, type FieldSize } from './Field';
import './Field.css';

export interface FrequencyFieldProps extends Omit<
  ComponentProps<'input'>,
  'type' | 'value' | 'onChange' | 'onBlur' | 'onKeyDown' | 'onFocus' | 'size'
> {
  /** Hz, or `null` when there is no value (no source): shown as an em dash and not editable. */
  value: number | null;
  /** Called with a valid, changed frequency in Hz only. */
  onCommit: (hz: number) => void;
  min?: number;
  max?: number;
  /** Arrow-key step, in Hz. */
  step?: number;
  /** Accessible name, required. */
  label: string;
  /** Shown as the tooltip while the value is valid. */
  title?: string;
  /** Height only: `toolbar` 30px, `compact` 28px (DESIGN.md 4.4). The frequency width is the same in both. */
  size?: FieldSize;
  invalid?: boolean;
  /** Read-only in use: the value stays visible, focus stays in the field, and it is never stepped. */
  readOnly?: boolean;
}

/**
 * A frequency with SI suffixes ("100.2M", "433.92 MHz"), committed on Enter or blur; Escape
 * reverts; ArrowUp and ArrowDown step by `step` within the range (DESIGN.md 4.4). An invalid entry
 * is never sent: Enter keeps it visible, blur reverts it.
 */
export function FrequencyField({
  value,
  onCommit,
  min,
  max,
  step = 1000,
  label,
  title,
  size = 'compact',
  invalid = false,
  readOnly = false,
  className,
  ...rest
}: FrequencyFieldProps) {
  const [draft, setDraftState] = useState<string | null>(null);
  // See NumberField: the handlers read the ref, so a blur fired by Escape or Enter sees no draft.
  const draftRef = useRef<string | null>(null);
  const setDraft = (next: string | null) => {
    draftRef.current = next;
    setDraftState(next);
  };

  const isOutOfRange = (hz: number) =>
    (min !== undefined && hz < min) || (max !== undefined && hz > max);
  const parsed = draft === null ? value : parseFrequency(draft);
  const outOfRange = parsed !== null && isOutOfRange(parsed);
  // With no value and no draft there is nothing to be invalid about.
  const invalidEntry = (draft !== null || value !== null) && (parsed === null || outOfRange);
  const showInvalid = invalidEntry || invalid;

  const commit = (revertInvalid: boolean) => {
    const text = draftRef.current;
    if (text === null) return;
    const next = parseFrequency(text);
    if (next === null || isOutOfRange(next)) {
      if (revertInvalid) setDraft(null);
      return;
    }
    if (next !== value) onCommit(next);
    setDraft(null);
  };

  const rangeMessage = `Allowed range: ${formatFrequency(min ?? 0)} – ${formatFrequency(max ?? 0)}`;

  return (
    <input
      {...rest}
      className={fieldInputClass(
        size,
        showInvalid,
        ['ui-field__input--frequency', className ?? ''].filter(Boolean).join(' '),
      )}
      aria-label={label}
      aria-invalid={showInvalid || undefined}
      title={
        invalidEntry
          ? outOfRange
            ? rangeMessage
            : 'Enter a frequency such as 100.2M or 433.92 MHz'
          : title
      }
      value={draft ?? (value === null ? '—' : formatFrequency(value, 1))}
      spellCheck={false}
      readOnly={readOnly}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onFocus={(event) => {
        event.target.select();
      }}
      onBlur={() => {
        commit(true);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          // Focus stays in the field after a commit (DESIGN.md 9.8: focus is never lost).
          commit(false);
        } else if (event.key === 'Escape') {
          setDraft(null);
          event.currentTarget.blur();
        } else if (
          (event.key === 'ArrowUp' || event.key === 'ArrowDown') &&
          draftRef.current === null &&
          value !== null &&
          !readOnly
        ) {
          event.preventDefault();
          let next = value + (event.key === 'ArrowUp' ? step : -step);
          if (min !== undefined) next = Math.max(min, next);
          if (max !== undefined) next = Math.min(max, next);
          if (next !== value) onCommit(next);
        }
      }}
    />
  );
}
