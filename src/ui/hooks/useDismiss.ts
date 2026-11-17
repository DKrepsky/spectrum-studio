import { useEffect, type RefObject } from 'react';

interface Options {
  /** The popup itself. A press inside it is not an outside press. */
  container: RefObject<HTMLElement | null>;
  /** The control that opens the popup. A press on it is left to that control's own handler. */
  anchor?: RefObject<HTMLElement | null>;
  onDismiss: () => void;
}

/**
 * Calls `onDismiss` on a mouse press outside `container` and `anchor` while the component is
 * mounted. It does not move focus; the caller decides where focus goes.
 */
export function useDismiss({ container, anchor, onDismiss }: Options) {
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const node = e.target as Node;
      if (container.current?.contains(node) || anchor?.current?.contains(node)) return;
      onDismiss();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [container, anchor, onDismiss]);
}
