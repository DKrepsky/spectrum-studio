import type { ReactElement, RefObject } from 'react';

import type { CaptureMode } from '../../bindings/CaptureMode';
import { Menu, MenuItemRadio } from '../../ui/Menu';

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
  /** The chevron that opens the menu (focus returns to it). */
  anchorRef: RefObject<HTMLElement | null>;
  onChoose: (mode: CaptureMode) => void;
  /** Closes the menu; `refocus` returns focus to the chevron. */
  onClose: (refocus: boolean) => void;
}

/** The capture mode menu: two radio items, the current mode checked. Choosing never starts a capture. */
export function CaptureModeMenu({ mode, anchorRef, onChoose, onClose }: Props) {
  return (
    <Menu
      label="Capture mode"
      heading="Capture mode"
      anchorRef={anchorRef}
      onClose={onClose}
      testId="capture-mode-menu"
    >
      {ITEMS.map((item) => (
        <MenuItemRadio
          key={item.mode}
          name={item.name}
          description={item.description}
          icon={
            <span className="capture-mode-icon" data-mode={item.mode}>
              {MODE_ICON[item.mode]}
            </span>
          }
          checked={mode === item.mode}
          onSelect={() => onChoose(item.mode)}
          testId={`capture-mode-${item.mode}`}
        />
      ))}
    </Menu>
  );
}
