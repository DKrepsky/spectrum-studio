import type { ComponentProps } from 'react';

import { fieldInputClass, type FieldSize } from './Field';
import './Field.css';

export interface TextFieldProps extends Omit<
  ComponentProps<'input'>,
  'type' | 'value' | 'onChange' | 'size'
> {
  value: string;
  onChange: (value: string) => void;
  /** Shows the danger border and `aria-invalid`. The message itself comes from `Field`. */
  invalid?: boolean;
  size?: FieldSize;
  /** Read-only in use (DESIGN.md 4.4, 9.10): the value stays visible and focus stays in the field. */
  readOnly?: boolean;
}

/** Free text in a field. Every change is reported; the parent decides what to keep. */
export function TextField({
  value,
  onChange,
  invalid = false,
  size = 'compact',
  readOnly = false,
  className,
  ...rest
}: TextFieldProps) {
  return (
    <input
      {...rest}
      type="text"
      className={fieldInputClass(size, invalid, className)}
      value={value}
      aria-invalid={invalid || undefined}
      readOnly={readOnly}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  );
}
