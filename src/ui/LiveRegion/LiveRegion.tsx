import type { ComponentProps } from 'react';

import './LiveRegion.css';

export interface LiveRegionProps extends Omit<ComponentProps<'div'>, 'children'> {
  /** Filled only for an announcement; an empty string announces nothing. */
  message: string;
}

/**
 * Visually hidden, always mounted, polite (DESIGN.md 4.16, 9.6). Visible state is never carried
 * only by this element (9.6 rule 3).
 */
export function LiveRegion({ message, className, ...rest }: LiveRegionProps) {
  return (
    <div
      {...rest}
      aria-live="polite"
      aria-atomic="true"
      className={['ui-live-region', className].filter(Boolean).join(' ')}
    >
      {message}
    </div>
  );
}
