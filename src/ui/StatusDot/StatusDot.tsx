import type { ComponentProps } from 'react';

import './StatusDot.css';

/** The visual vocabulary of a source status. The feature container maps its domain state to it. */
export type StatusDotStatus =
  'connected' | 'acquiring' | 'connecting' | 'disconnecting' | 'failed' | 'absent' | 'idle';

export interface StatusDotProps extends Omit<ComponentProps<'span'>, 'children'> {
  status: StatusDotStatus;
}

/**
 * The shape of a status: a 10px dot in an 18px cell (a bold cross for `failed`). Decorative: the
 * word or the name next to it carries the state (DESIGN.md 2.6), so it is always `aria-hidden`.
 */
export function StatusDot({ status, className, ...rest }: StatusDotProps) {
  return (
    <span
      {...rest}
      aria-hidden="true"
      className={['ui-status-dot', className].filter(Boolean).join(' ')}
      data-status={status}
    />
  );
}
