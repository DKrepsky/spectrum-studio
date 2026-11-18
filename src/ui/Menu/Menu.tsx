import { useCallback, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';

import { useDismiss } from '../hooks/useDismiss';
import { menuItems, useMenuKeys } from '../hooks/useMenuKeys';
import { usePopupFlip } from '../hooks/usePopupFlip';
import '../Popover/Popover.css';
import './Menu.css';

interface MenuProps {
  /** Accessible name of the `role="menu"`. */
  label: string;
  /** Visible caps heading above the items. */
  heading?: string;
  /** The control that opens the menu; a press on it is left to that control. */
  anchorRef: RefObject<HTMLElement | null>;
  /** Which edge lines up with the trigger. */
  align?: 'start' | 'end';
  /**
   * Closes the menu. `refocus` true (Escape, Tab, a choice): focus goes back to the trigger. False
   * (an outside press): focus is not moved.
   */
  onClose: (refocus: boolean) => void;
  testId?: string;
  /** `MenuItemRadio` items. */
  children: ReactNode;
}

/**
 * A command-style choice (`role="menu"`, DESIGN.md 4.11, 5.1). Focus goes to the checked item on
 * open, else the first. Up and Down wrap; Home and End go to the ends; type-ahead selects by label.
 * Escape and Tab close it and return focus to the trigger; an outside press closes it without
 * moving focus. Choosing an item is the caller's business: `onClose` is for closing.
 */
export function Menu({
  label,
  heading,
  anchorRef,
  align = 'end',
  onClose,
  testId,
  children,
}: MenuProps) {
  const surface = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const close = useCallback(() => onClose(true), [onClose]);
  const dismiss = useCallback(() => onClose(false), [onClose]);
  usePopupFlip(surface, anchorRef);
  const onKeyDown = useMenuKeys({ container: list, onEscape: close, onTab: close });
  useDismiss({ container: surface, anchor: anchorRef, onDismiss: dismiss });

  useLayoutEffect(() => {
    const items = menuItems(list.current);
    (items.find((el) => el.getAttribute('aria-checked') === 'true') ?? items[0])?.focus();
  }, []);

  return (
    <div
      ref={surface}
      className={`popover popover-mode popover-align-${align}`}
      data-testid={testId}
    >
      {heading && (
        <div className="popover-heading" aria-hidden>
          {heading}
        </div>
      )}
      <div ref={list} role="menu" aria-label={label} onKeyDown={onKeyDown}>
        {children}
      </div>
    </div>
  );
}
