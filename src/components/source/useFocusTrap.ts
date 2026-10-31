import { useEffect, type RefObject } from 'react';

const TABBABLE =
  'input:not(:disabled):not([readonly]):not([tabindex="-1"]), select:not(:disabled), ' +
  'button:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"]):not(:disabled)';

/** Elements Tab can reach inside `root`, in DOM order. */
export function tabbables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(TABBABLE));
}

interface Options {
  /** Called on Escape. */
  onEscape: () => void;
  /** Focused again when the trap goes away (typically the control that opened the dialog). */
  returnFocusTo: RefObject<HTMLElement | null>;
}

/**
 * Modal focus management without a dependency: Tab and Shift+Tab cycle inside `containerRef`,
 * focus that escapes (mouse click on the backdrop, script) is pulled back, Escape calls
 * `onEscape`, and focus returns to `returnFocusTo` on unmount.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  { onEscape, returnFocusTo }: Options,
) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const root = containerRef.current;
      if (!root) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onEscape();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = tabbables(root);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (!root.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && (active === first || !items.includes(active as HTMLElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      const root = containerRef.current;
      if (root && e.target instanceof Node && !root.contains(e.target)) tabbables(root)[0]?.focus();
    };
    // Capture phase: runs before any handler of the page underneath.
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [containerRef, onEscape]);

  useEffect(() => {
    const target = returnFocusTo;
    return () => {
      // Only when focus was lost with the dialog (not when it moved somewhere on purpose).
      const active = document.activeElement;
      if (active == null || active === document.body) target.current?.focus();
    };
  }, [returnFocusTo]);
}
