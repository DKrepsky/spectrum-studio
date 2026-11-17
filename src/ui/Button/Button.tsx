import type { ButtonHTMLAttributes, MouseEvent, ReactNode, Ref } from 'react';

import { Spinner } from '../Spinner';
import './Button.css';

export type ButtonVariant = 'default' | 'primary' | 'destructive';
export type ButtonSize = 'default' | 'small';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `primary`: one per group. `destructive`: removal and stop only, never an ordinary action. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** A command is in flight: the label stays, a spinner leads it, the click is ignored. */
  busy?: boolean;
  /**
   * The action cannot run now. The button stays focusable (`aria-disabled`) and ignores the click;
   * the reason belongs in a visible description. Native `disabled` still works where it fits.
   */
  unavailable?: boolean;
  /** Glyph before the label (12px). Replaced by the spinner while busy. */
  icon?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * The one button of the app (DESIGN.md 4.1). Props in, callbacks out. Native attributes and
 * `data-testid` are forwarded to the `<button>`.
 */
export function Button({
  variant = 'default',
  size = 'default',
  busy = false,
  unavailable = false,
  icon,
  type = 'button',
  className,
  onClick,
  children,
  ref,
  ...rest
}: ButtonProps) {
  const blocked = busy || unavailable;
  const classes = [
    'ui-button',
    `ui-button--${variant}`,
    size === 'small' ? 'ui-button--small' : '',
    unavailable ? 'ui-button--unavailable' : '',
    busy ? 'ui-button--busy' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  // Busy never changes the width (DESIGN.md 4.1). With an icon, the spinner takes the icon's
  // fixed 12px slot. Without one, the spinner overlays the label, which keeps its box and its
  // text (the name) but is painted transparent.
  const overlay = busy && !icon;
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={classes}
      aria-disabled={blocked || undefined}
      aria-busy={busy || undefined}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        if (blocked) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {icon ? (
        <span className="ui-button__lead" aria-hidden="true">
          {busy ? <Spinner /> : icon}
        </span>
      ) : null}
      <span className={overlay ? 'ui-button__label ui-button__label--masked' : 'ui-button__label'}>
        {children}
      </span>
      {overlay ? (
        <span className="ui-button__overlay" aria-hidden="true">
          <Spinner />
        </span>
      ) : null}
    </button>
  );
}
