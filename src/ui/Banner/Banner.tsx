import type { ComponentProps, ReactNode } from 'react';

import { IconButton } from '../IconButton';
import './Banner.css';

export type BannerTone = 'warning' | 'error';
/** `alert` (assertive, `role="alert"`) only for the causes DESIGN.md 9.6 lists; `status` otherwise. */
export type BannerUrgency = 'alert' | 'status';

export interface BannerProps extends Omit<ComponentProps<'div'>, 'role'> {
  tone: BannerTone;
  urgency: BannerUrgency;
  /** Recovery buttons, in order, after the message. Omit when there is no recovery. */
  actions?: ReactNode;
  onDismiss: () => void;
  dismissLabel?: string;
}

/**
 * A notice with a message that wraps (never truncates), optional recovery actions and a 24px
 * dismiss button last. Focus does not move when it appears (DESIGN.md 4.9).
 */
export function Banner({
  tone,
  urgency,
  actions,
  onDismiss,
  dismissLabel = 'Dismiss',
  className,
  children,
  ...rest
}: BannerProps) {
  return (
    <div
      {...rest}
      role={urgency}
      className={['ui-banner', className].filter(Boolean).join(' ')}
      data-tone={tone}
    >
      <div className="ui-banner-message">{children}</div>
      {actions ? <div className="ui-banner-actions">{actions}</div> : null}
      <IconButton label={dismissLabel} className="ui-banner-dismiss" onClick={onDismiss}>
        ×
      </IconButton>
    </div>
  );
}
