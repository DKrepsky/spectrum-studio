import { useCallback, useRef, type KeyboardEvent, type RefObject } from 'react';

const ITEM = '[data-menu-item]:not([aria-disabled="true"])';
const ACTION = '[data-menu-action]';
const TYPEAHEAD_MS = 700;

/** Enabled, navigable items of a menu in DOM order. */
export function menuItems(container: HTMLElement | null): HTMLElement[] {
  return container ? [...container.querySelectorAll<HTMLElement>(ITEM)] : [];
}

function labelOf(el: HTMLElement): string {
  return (el.dataset['label'] ?? el.textContent).trim().toLowerCase();
}

interface Options {
  container: RefObject<HTMLElement | null>;
  onEscape: () => void;
  /** Tab closes the menu; the browser then moves focus on from the source button. */
  onTab: () => void;
}

/**
 * Keyboard model of the source menu (roving focus, no tabindex juggling): Up/Down with wrap,
 * Home/End, type-ahead, Escape, Tab, and `F2`/`Delete`/`Left`/`Right` for the row actions.
 * It is DOM driven: items carry `data-menu-item`, row actions `data-menu-action`
 * (inside an element with `data-menu-row`), so it knows nothing about source entries.
 */
export function useMenuKeys({ container, onEscape, onTab }: Options) {
  const typed = useRef({ text: '', at: 0 });

  return useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement;
      const root = container.current;
      const items = menuItems(root);
      const row = target.closest<HTMLElement>('[data-menu-row]');
      const isAction = target.matches(ACTION);
      const current = row?.querySelector<HTMLElement>('[data-menu-item]') ?? target;
      const index = items.indexOf(current);
      const focusAt = (i: number) => {
        e.preventDefault();
        if (items.length > 0) items[(i + items.length) % items.length]?.focus();
      };

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onEscape();
          return;
        case 'Tab':
          onTab();
          return;
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
        case 'ArrowRight':
        case 'ArrowLeft': {
          if (!row) return;
          const actions = [...row.querySelectorAll<HTMLElement>(ACTION)];
          const at = isAction ? actions.indexOf(target) : -1;
          const next = at + (e.key === 'ArrowRight' ? 1 : -1);
          const destination = next < 0 ? current : actions[next];
          if (destination) {
            e.preventDefault();
            destination.focus();
          }
          return;
        }
        case 'F2':
        case 'Delete': {
          const action = row?.querySelector<HTMLElement>(
            `[data-menu-action="${e.key === 'F2' ? 'edit' : 'forget'}"]`,
          );
          if (action) {
            e.preventDefault();
            action.click();
          }
          return;
        }
      }

      // Type-ahead: printable characters select the next item starting with the typed text.
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const now = Date.now();
        const buffer = typed.current;
        if (e.key === ' ' && buffer.text === '') return; // Space activates the focused item
        buffer.text =
          now - buffer.at > TYPEAHEAD_MS ? e.key.toLowerCase() : buffer.text + e.key.toLowerCase();
        buffer.at = now;
        // A repeated single letter cycles; a longer prefix keeps the current item if it still matches.
        const start = buffer.text.length === 1 ? index + 1 : Math.max(index, 0);
        for (let step = 0; step < items.length; step++) {
          const item = items[(start + step) % items.length];
          if (item && labelOf(item).startsWith(buffer.text)) {
            e.preventDefault();
            item.focus();
            return;
          }
        }
        e.preventDefault();
      }
    },
    [container, onEscape, onTab],
  );
}
