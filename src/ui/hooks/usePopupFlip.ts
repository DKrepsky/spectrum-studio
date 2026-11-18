import { useLayoutEffect, type RefObject } from 'react';

/** The gap between a trigger and its popup. Matches `--space-2` in Popover.css (`top: calc(100% + 4px)`). */
export const POPUP_GAP = 4;

/** The vertical span a popup may occupy: the window, or the scrolling box that clips it. */
export interface VerticalBox {
  top: number;
  bottom: number;
}

/**
 * Whether a popup of `popupHeight` px that opens below its trigger would leave `box`, and it fits
 * above the trigger instead. Pure, so the rule is tested without layout. Coordinates are viewport
 * pixels, as `getBoundingClientRect` gives them.
 */
export function shouldFlipUp(
  anchor: { top: number; bottom: number },
  popupHeight: number,
  box: VerticalBox,
  gap: number = POPUP_GAP,
): boolean {
  const fitsBelow = anchor.bottom + gap + popupHeight <= box.bottom;
  const fitsAbove = anchor.top - gap - popupHeight >= box.top;
  return !fitsBelow && fitsAbove;
}

/**
 * The box a popup must stay in: the window, cut to the nearest ancestor that scrolls or clips
 * (the side panel). A popup past that edge is not visible, even though the window has room.
 */
export function visibleBox(element: HTMLElement): VerticalBox {
  let top = 0;
  let bottom = window.innerHeight;
  for (let p = element.parentElement; p; p = p.parentElement) {
    const overflow = window.getComputedStyle(p).overflowY;
    if (overflow === 'auto' || overflow === 'scroll' || overflow === 'hidden') {
      const rect = p.getBoundingClientRect();
      top = Math.max(top, rect.top);
      bottom = Math.min(bottom, rect.bottom);
      break;
    }
  }
  return { top, bottom };
}

/**
 * Opens the popup above its trigger (the class `popover-up`, Popover.css) when it does not fit below
 * inside the window or the box that clips it (DESIGN.md 3.6, 4.11). Decided once, on mount, in a
 * layout effect, so the first paint is already in place; focus is not moved. A popup that fits
 * neither way opens below, as before. The class is written to the element, not kept in state: the
 * decision is a measurement, and the popup is remounted each time it opens.
 */
export function usePopupFlip(
  surface: RefObject<HTMLElement | null>,
  anchor: RefObject<HTMLElement | null>,
): void {
  useLayoutEffect(() => {
    const el = surface.current;
    const trigger = anchor.current;
    if (!el || !trigger) return;
    // Heights come from getBoundingClientRect, the same coordinates as the trigger (offsetHeight is
    // in layout units, which differ under a zoomed root).
    const height = el.getBoundingClientRect().height;
    el.classList.toggle(
      'popover-up',
      shouldFlipUp(trigger.getBoundingClientRect(), height, visibleBox(el)),
    );
  }, [surface, anchor]);
}
