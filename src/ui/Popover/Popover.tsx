import {
  useCallback,
  useLayoutEffect,
  useRef,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';

import { useDismiss } from '../hooks/useDismiss';
import { useListKeys } from '../hooks/useListKeys';
import './Popover.css';

interface PopoverProps {
  /** Accessible name of the dialog. */
  label: string;
  /** The control that opens the popover; a press on it does not dismiss (the control handles it). */
  anchorRef: RefObject<HTMLElement | null>;
  /**
   * Closes the popover. `refocus` true (Escape): focus returns to the trigger. False (an outside
   * press, or Tab leaving the popover): focus is not moved back.
   */
  onClose: (refocus: boolean) => void;
  /** `source`: up to 360px, scrolls. `mode`: fixed 280px, for short menus. */
  variant?: 'source' | 'mode';
  /** Which edge lines up with the trigger. */
  align?: 'start' | 'end';
  testId?: string;
  children: ReactNode;
}

/**
 * A non-modal popover: `role="dialog"` with list content (DESIGN.md 4.11, 5.1). It never traps
 * focus. Focus goes to the current item (`aria-current`) on open, else the first list item. Up,
 * Down, Home and End move between `data-list-item` rows. Escape closes and refocuses the trigger.
 * Tab or Shift+Tab past the first or last control closes it without refocusing; focus continues in
 * document order (the browser moves it, then the popover closes on focusout). A press outside the
 * popover and its trigger closes it.
 */
export function Popover({
  label,
  anchorRef,
  onClose,
  variant = 'source',
  align = 'start',
  testId,
  children,
}: PopoverProps) {
  const root = useRef<HTMLDivElement>(null);
  const moveInList = useListKeys({ container: root });
  const dismiss = useCallback(() => onClose(false), [onClose]);
  useDismiss({ container: root, anchor: anchorRef, onDismiss: dismiss });

  // Focus on open: the current row, else the first row, else the popover itself.
  // A child that already moved focus in (a connect form's first field) keeps it.
  useLayoutEffect(() => {
    if (root.current?.contains(document.activeElement)) return;
    const items = root.current?.querySelectorAll<HTMLElement>('[data-list-item]') ?? [];
    const target =
      root.current?.querySelector<HTMLElement>('[data-list-item][aria-current="true"]') ?? items[0];
    (target ?? root.current)?.focus();
  }, []);

  // Set by a Tab keydown; read by the focusout that the Tab causes. Closing on focusout, not on the
  // keydown, lets the browser move focus on from the trigger's place before the popover unmounts.
  const tabbing = useRef(false);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    tabbing.current = e.key === 'Tab';
    // A child that handled the key (a form going back on Escape) has the last word.
    if (e.defaultPrevented) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose(true);
      return;
    }
    if (e.key !== 'Tab') moveInList(e);
  };

  const onFocusOut = (e: FocusEvent<HTMLDivElement>) => {
    const leaving = tabbing.current;
    tabbing.current = false;
    // Tab past the first or last control: focus is now outside. Moving between controls inside is
    // native and keeps the popover open.
    const next = e.relatedTarget as Node | null;
    if (leaving && !root.current?.contains(next)) onClose(false);
  };

  return (
    <div
      ref={root}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      className={`popover popover-${variant} popover-align-${align}`}
      data-testid={testId}
      onKeyDown={onKeyDown}
      onBlur={onFocusOut}
    >
      {children}
    </div>
  );
}
