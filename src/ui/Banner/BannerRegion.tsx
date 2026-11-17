import type { ComponentProps } from 'react';

import './Banner.css';

/**
 * The always-mounted polite live container for banners (DESIGN.md 9.6, rule 1): it is in the DOM
 * before anything is announced, and banners are inserted into it. It renders empty when there are
 * no banners and takes no space.
 */
export function BannerRegion({ className, children, ...rest }: ComponentProps<'div'>) {
  return (
    <div
      {...rest}
      aria-live="polite"
      className={['ui-banner-region', className].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}
