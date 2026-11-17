import { useCallback, type KeyboardEvent, type RefObject } from 'react';

const ITEM = '[data-list-item]';

/** The list items of a popover or list in DOM order (their select buttons, not the row wrappers). */
export function listItems(container: HTMLElement | null): HTMLElement[] {
  return container ? [...container.querySelectorAll<HTMLElement>(ITEM)] : [];
}

interface Options {
  container: RefObject<HTMLElement | null>;
}

/**
 * Keyboard model of a list of rows (DESIGN.md 5.1, 5.10): Up and Down move to the previous or next
 * item, Home and End to the first or last. Movement stops at the ends (no wrap). There is no
 * type-ahead. Tab is left to the browser: a popover decides when Tab leaves it.
 * An action button inside a row starts from that row's item.
 */
export function useListKeys({ container }: Options) {
  return useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement;
      const items = listItems(container.current);
      const row = target.closest<HTMLElement>('[data-list-row]');
      const current = row?.querySelector<HTMLElement>(ITEM) ?? target.closest<HTMLElement>(ITEM);
      const index = current ? items.indexOf(current) : -1;
      const focusAt = (i: number) => {
        e.preventDefault();
        const clamped = Math.min(Math.max(i, 0), items.length - 1);
        items[clamped]?.focus();
      };

      switch (e.key) {
        case 'ArrowDown':
          focusAt(index < 0 ? 0 : index + 1);
          return;
        case 'ArrowUp':
          focusAt(index < 0 ? items.length - 1 : index - 1);
          return;
        case 'Home':
          focusAt(0);
          return;
        case 'End':
          focusAt(items.length - 1);
          return;
      }
    },
    [container],
  );
}
