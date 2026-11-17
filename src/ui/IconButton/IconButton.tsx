import type { ButtonHTMLAttributes, MouseEvent, Ref } from 'react';

import './IconButton.css';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name, required: it names the object ("Edit Bench SA430", "Dismiss"). */
  label: string;
  /** `ghost` shows its fill on hover (rows, tables); `filled` has a control fill (popover row actions). */
  variant?: 'ghost' | 'filled';
  /** Same rules as `Button`: focusable, click ignored, reason in a visible description. */
  unavailable?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** A single glyph action with a required name. Never smaller than 24 by 24 CSS px (F2). */
export function IconButton({
  label,
  variant = 'ghost',
  unavailable = false,
  type = 'button',
  className,
  onClick,
  children,
  ref,
  ...rest
}: IconButtonProps) {
  const classes = [
    'ui-icon-button',
    `ui-icon-button--${variant}`,
    unavailable ? 'ui-icon-button--unavailable' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={classes}
      aria-label={label}
      aria-disabled={unavailable || undefined}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        if (unavailable) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {children}
    </button>
  );
}
