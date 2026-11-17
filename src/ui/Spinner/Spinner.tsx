import type { HTMLAttributes } from 'react';

import './Spinner.css';

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  /** Visible text naming the work ("Connecting…"). Without it the spinner is decorative. */
  label?: string;
}

/**
 * A command is in progress and its duration is unknown (DESIGN.md 4.15). The glyph rotates; under
 * reduced motion it becomes a static ellipsis. The text carries the state, not the glyph.
 */
export function Spinner({ label, className, ...rest }: SpinnerProps) {
  return (
    <span
      {...rest}
      className={['ui-spinner', className].filter(Boolean).join(' ')}
      aria-hidden={label ? undefined : true}
    >
      <span className="ui-spinner__glyph" aria-hidden="true" />
      {label ? <span className="ui-spinner__label">{label}</span> : null}
    </span>
  );
}
