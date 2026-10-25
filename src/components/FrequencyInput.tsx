import { useState } from 'react';

import { formatFrequency, parseFrequency } from '../format/frequency';

interface Props {
  value: number;
  onCommit: (hz: number) => void;
  min?: number;
  max?: number;
  /** Step for arrow keys, in Hz. */
  step?: number;
  disabled?: boolean;
  label: string;
  title?: string;
  id?: string;
}

/**
 * Text input for frequencies accepting SI suffixes ("100.2M", "433.92 MHz"). Commits on Enter or
 * blur, reverts on Escape, and steps with the arrow keys.
 */
export function FrequencyInput({
  value,
  onCommit,
  min,
  max,
  step = 1000,
  disabled,
  label,
  title,
  id,
}: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? formatFrequency(value, 1);
  const parsed = draft === null ? value : parseFrequency(draft);
  const outOfRange =
    parsed !== null && ((min !== undefined && parsed < min) || (max !== undefined && parsed > max));
  const invalid = parsed === null || outOfRange;

  /** Enter keeps an invalid entry visible so the error can be corrected; blur reverts it. */
  const commit = (revertInvalid: boolean) => {
    if (draft === null) return;
    if (invalid) {
      if (revertInvalid) setDraft(null);
      return;
    }
    if (parsed !== value) onCommit(parsed);
    setDraft(null);
  };

  return (
    <input
      id={id}
      className={`freq-input${invalid ? ' invalid' : ''}`}
      aria-label={label}
      aria-invalid={invalid}
      title={
        invalid
          ? outOfRange
            ? `Allowed range: ${formatFrequency(min ?? 0)} – ${formatFrequency(max ?? 0)}`
            : 'Enter a frequency such as 100.2M or 433.92 MHz'
          : title
      }
      value={text}
      disabled={disabled}
      spellCheck={false}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={() => commit(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit(false);
          if (!invalid) e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          setDraft(null);
          e.currentTarget.blur();
        } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && draft === null) {
          e.preventDefault();
          let next = value + (e.key === 'ArrowUp' ? step : -step);
          if (min !== undefined) next = Math.max(min, next);
          if (max !== undefined) next = Math.min(max, next);
          onCommit(next);
        }
      }}
    />
  );
}
