import type { ComponentProps } from 'react';

import './Badge.css';

export type BadgeVariant = 'chip' | 'tag';
export type BadgeTone = 'neutral' | 'live' | 'waiting' | 'warn' | 'capturing';

export interface BadgeProps extends ComponentProps<'span'> {
  /** `chip`: a fact beside a control. `tag`: a state over the canvas (pointer-events off). */
  variant: BadgeVariant;
  tone?: BadgeTone;
}

/** A short fact about an object or the view. Not interactive; its text is read as it is. */
export function Badge({ variant, tone = 'neutral', className, children, ...rest }: BadgeProps) {
  return (
    <span
      {...rest}
      className={['ui-badge', className].filter(Boolean).join(' ')}
      data-variant={variant}
      data-tone={tone}
    >
      {children}
    </span>
  );
}
