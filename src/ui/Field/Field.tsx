import { useId, type HTMLAttributes, type ReactNode } from 'react';

import { InlineMessage } from '../InlineMessage';
import './Field.css';

/** Toolbar fields are 30px; panel and dialog fields are 28px (DESIGN.md 4.4). */
export type FieldSize = 'toolbar' | 'compact';

/** What the wrapper hands to its control: wire these into the control's attributes. */
export interface FieldControl {
  id: string;
  /** The hint and the error ids, space separated; undefined when neither is shown. */
  describedBy: string | undefined;
  /** True when an error message is shown. */
  invalid: boolean;
}

export interface FieldProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Visible label. The control is labelled by it through `htmlFor`. */
  label: string;
  /** `inline`: label left, control right (side panel). `stacked`: label above, full width (dialog). */
  layout?: 'inline' | 'stacked';
  /** Control id; generated when omitted. */
  id?: string;
  /** Secondary text under the control. */
  hint?: string;
  /** Error under the control, in danger colour. Shown with `invalid` set on the control. */
  error?: string;
  /** `data-testid` of the error message. */
  errorTestId?: string;
  children: (control: FieldControl) => ReactNode;
}

/** Class names of an input-like control in a field, shared by the controls of this folder. */
export function fieldInputClass(size: FieldSize, invalid: boolean, extra?: string): string {
  return [
    'ui-field__input',
    `ui-field__input--${size}`,
    invalid ? 'ui-field__input--invalid' : '',
    extra ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Label, control, hint and error of one value (DESIGN.md 4.4). The control is supplied as a render
 * function so that the id, `aria-describedby` and `aria-invalid` reach it without a context.
 */
export function Field({
  label,
  layout = 'stacked',
  id,
  hint,
  error,
  errorTestId,
  className,
  children,
  ...rest
}: FieldProps) {
  const generated = useId();
  const controlId = id ?? generated;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter((x) => x !== undefined).join(' ') || undefined;
  return (
    <div
      {...rest}
      className={['ui-field', `ui-field--${layout}`, className ?? ''].filter(Boolean).join(' ')}
    >
      <div className="ui-field__row">
        <label className="ui-field__label" htmlFor={controlId}>
          {label}
        </label>
        <div className="ui-field__control">
          {children({ id: controlId, describedBy, invalid: Boolean(error) })}
        </div>
      </div>
      {hint ? (
        <InlineMessage id={hintId} variant="hint">
          {hint}
        </InlineMessage>
      ) : null}
      {error ? (
        <InlineMessage id={errorId} variant="error" data-testid={errorTestId}>
          {error}
        </InlineMessage>
      ) : null}
    </div>
  );
}
