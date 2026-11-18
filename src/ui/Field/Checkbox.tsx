import type { ComponentProps, ReactNode } from 'react';

import './Field.css';

export interface CheckboxProps extends Omit<
  ComponentProps<'input'>,
  'type' | 'checked' | 'onChange' | 'size'
> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The text is the name; the whole label is the target (24px high, F14). */
  label: string;
  /** Decoration before the text, such as the trace swatch. Hidden from assistive technology. */
  adornment?: ReactNode;
  /**
   * Read-only in use (DESIGN.md 4.4, 9.10): shows the state, keeps focus and ignores changes. Use
   * this instead of `disabled` while a change is applying.
   */
  readOnly?: boolean;
}

/** On or off. Space toggles. The `<label>` wraps the native input, so the text is the name. */
export function Checkbox({
  checked,
  onChange,
  label,
  adornment,
  disabled = false,
  readOnly = false,
  className,
  ...rest
}: CheckboxProps) {
  const classes = [
    'ui-checkbox',
    disabled ? 'ui-checkbox--disabled' : '',
    readOnly ? 'ui-checkbox--read-only' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <label className={classes}>
      <input
        {...rest}
        type="checkbox"
        className="ui-checkbox__input"
        checked={checked}
        disabled={disabled}
        aria-readonly={readOnly || undefined}
        onChange={(event) => {
          if (readOnly) return;
          onChange(event.target.checked);
        }}
      />
      {adornment ? (
        <span className="ui-checkbox__adornment" aria-hidden="true">
          {adornment}
        </span>
      ) : null}
      <span className="ui-checkbox__text">{label}</span>
    </label>
  );
}
