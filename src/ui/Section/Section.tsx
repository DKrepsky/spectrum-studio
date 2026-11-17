import type { ComponentProps, ReactNode } from 'react';

import './Section.css';

export interface SectionProps extends Omit<ComponentProps<'details'>, 'title'> {
  title: ReactNode;
  /** Initially open. Closed when omitted (set-and-forget settings). */
  open?: boolean;
}

/** A collapsible group in the side panel: a native `details`, so Enter and Space toggle it. */
export function Section({ title, open, className, children, ...rest }: SectionProps) {
  return (
    <details {...rest} open={open} className={['ui-section', className].filter(Boolean).join(' ')}>
      <summary className="ui-section-summary">{title}</summary>
      <div className="ui-section-body">{children}</div>
    </details>
  );
}
