import { useCallback, useLayoutEffect, useRef, type ReactElement } from 'react';

import type { CaptureMode } from '../../bindings/CaptureMode';
import { menuItems, useMenuKeys } from '../source/useMenuKeys';

const CHECK = (
  <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden focusable="false">
    <path
      d="M2.5 7.5l3 2.8 6-6.3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Shape-coded glyphs: continuous is a repeated trace, single is one sweep then flat.
const MODE_ICON: Record<CaptureMode, ReactElement> = {
  continuous: (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden focusable="false">
      <path
        d="M1.5 12.5h2l1.5-6 1.5 6 1.5-6 1.5 6 1.5-6 1.5 6 1.5-6 1.5 6h2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  ),
  single: (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden focusable="false">
      <path
        d="M1.5 12.5h5l2-8 2 8h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  ),
};

const ITEMS: { mode: CaptureMode; name: string; description: string }[] = [
  { mode: 'continuous', name: 'Continuous', description: 'Keeps acquiring until you pause.' },
  { mode: 'single', name: 'Single', description: 'Captures one sweep, then stops.' },
];

interface Props {
  mode: CaptureMode;
  onChoose: (mode: CaptureMode) => void;
  /** Closes the menu; `refocus` returns focus to the capture chevron. */
  onClose: (refocus: boolean) => void;
}

/** The capture mode menu: two radio items, the current mode checked. Choosing never starts a capture. */
export function CaptureModeMenu({ mode, onChoose, onClose }: Props) {
  const menu = useRef<HTMLDivElement>(null);
  const close = useCallback(() => onClose(true), [onClose]);
  const onKeyDown = useMenuKeys({ container: menu, onEscape: close, onTab: close });

  // Focus goes to the checked item when the menu opens.
  useLayoutEffect(() => {
    const items = menuItems(menu.current);
    (items.find((el) => el.getAttribute('aria-checked') === 'true') ?? items[0])?.focus();
  }, []);

  return (
    <div className="mode-popover" data-testid="capture-mode-popover">
      <div className="mode-heading" aria-hidden>
        Capture mode
      </div>
      <div
        ref={menu}
        role="menu"
        aria-label="Capture mode"
        data-testid="capture-mode-menu"
        onKeyDown={onKeyDown}
      >
        {ITEMS.map((item) => (
          <button
            key={item.mode}
            type="button"
            role="menuitemradio"
            aria-checked={mode === item.mode}
            aria-labelledby={`capture-mode-${item.mode}-name`}
            aria-describedby={`capture-mode-${item.mode}-desc`}
            className="mode-item"
            data-menu-item
            data-testid={`capture-mode-${item.mode}`}
            onClick={() => onChoose(item.mode)}
          >
            <span className={`mode-ico ${item.mode}`} aria-hidden>
              {MODE_ICON[item.mode]}
            </span>
            <span>
              <span className="mode-name" id={`capture-mode-${item.mode}-name`}>
                {item.name}
              </span>
              <span className="mode-desc" id={`capture-mode-${item.mode}-desc`}>
                {item.description}
              </span>
            </span>
            <span className="mode-check" aria-hidden>
              {CHECK}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
