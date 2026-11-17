import type { ComponentProps } from 'react';

import { fieldInputClass, type FieldSize } from './Field';
import './Field.css';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<
  ComponentProps<'select'>,
  'value' | 'onChange' | 'size' | 'children'
> {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** Accessible name. Use `Field` for the visible label. */
  label: string;
  size?: FieldSize;
}

/** A short fixed list. The native element: keyboard and screen readers come with it (4.5). */
export function Select({
  value,
  options,
  onChange,
  label,
  size = 'compact',
  className,
  ...rest
}: SelectProps) {
  return (
    <select
      {...rest}
      aria-label={label}
      className={fieldInputClass(size, false, ['ui-select', className].filter(Boolean).join(' '))}
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
