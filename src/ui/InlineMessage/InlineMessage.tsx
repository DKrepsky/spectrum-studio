import type { HTMLAttributes } from 'react';

import './InlineMessage.css';

export type InlineMessageVariant = 'hint' | 'note' | 'info' | 'warn' | 'error';

export interface InlineMessageProps extends HTMLAttributes<HTMLParagraphElement> {
  /** `hint` and `note` are secondary text; `info` is a state; `warn` and `error` need attention. */
  variant?: InlineMessageVariant;
}

/**
 * Text attached to a control or a section (DESIGN.md 4.10). One size for every variant (F8). It
 * is not a live region: an error is announced by the banner or by the control's description.
 */
export function InlineMessage({
  variant = 'hint',
  className,
  children,
  ...rest
}: InlineMessageProps) {
  return (
    <p
      {...rest}
      className={['ui-inline-message', `ui-inline-message--${variant}`, className]
        .filter(Boolean)
        .join(' ')}
    >
      {variant === 'warn' ? (
        <span className="ui-inline-message__glyph" aria-hidden="true">
          ⚠{' '}
        </span>
      ) : null}
      {children}
    </p>
  );
}
