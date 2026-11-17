import { useLayoutEffect, useRef, useState, type ComponentProps } from 'react';

import './Badge.css';

export type BadgeVariant = 'chip' | 'tag';
export type BadgeTone = 'neutral' | 'live' | 'waiting' | 'warn' | 'capturing';

export interface BadgeProps extends ComponentProps<'span'> {
  /** `chip`: a fact beside a control. `tag`: a state over the canvas (pointer-events off). */
  variant: BadgeVariant;
  tone?: BadgeTone;
}

/**
 * A short fact about an object or the view. Not interactive; its text is read as it is. The text
 * stays on one line and ends in an ellipsis when the pill is too narrow (DESIGN.md 4.7, 5.9). When
 * it is cut, the full text is the pill's native `title`, unless the caller gives its own `title`.
 */
export function Badge({
  variant,
  tone = 'neutral',
  className,
  title,
  children,
  ...rest
}: BadgeProps) {
  const label = useRef<HTMLSpanElement>(null);
  const [cutText, setCutText] = useState<string | undefined>(undefined);

  useLayoutEffect(() => {
    const el = label.current;
    if (!el) return;
    const measure = () => {
      const cut = el.scrollWidth > el.clientWidth;
      setCutText(cut ? el.textContent : undefined);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [children]);

  return (
    <span
      {...rest}
      className={['ui-badge', className].filter(Boolean).join(' ')}
      data-variant={variant}
      data-tone={tone}
      title={title ?? cutText}
    >
      <span ref={label} className="ui-badge-label">
        {children}
      </span>
    </span>
  );
}
