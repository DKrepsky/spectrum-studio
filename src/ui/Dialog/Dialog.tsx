import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
} from 'react';
import { createPortal } from 'react-dom';

import { tabbables, useFocusTrap } from '../hooks/useFocusTrap';
import './Dialog.css';

interface DialogProps {
  /** The visible title, also the accessible name (`aria-labelledby`). */
  title: string;
  /** Escape, and the close actions in the body or footer. The caller decides what closing means. */
  onClose: () => void;
  /** False while a save runs: Escape does nothing. The backdrop never closes the dialog. */
  dismissable?: boolean;
  /** Focused again when the dialog closes (the control that opened it). */
  returnFocusTo: RefObject<HTMLElement | null>;
  /** Initial focus. Default: the first focusable control in the body. */
  initialFocus?: RefObject<HTMLElement | null>;
  /** Submit (Enter in a field). Default: the browser's submit is prevented. */
  onSubmit?: (e: SyntheticEvent<HTMLFormElement>) => void;
  testId?: string;
  /** `data-testid` of the title heading. */
  titleTestId?: string;
  /** Fields, notes and a `DialogFooter` last. */
  children: ReactNode;
}

/**
 * A modal dialog (DESIGN.md 4.12): portal, backdrop, `role="dialog"` with `aria-modal`, the title as
 * its name. Focus is trapped inside, goes to the first control (or `initialFocus`) on open, and
 * returns to `returnFocusTo` on close. Its body is a form, so Enter in a field submits.
 */
export function Dialog({
  title,
  onClose,
  dismissable = true,
  returnFocusTo,
  initialFocus,
  onSubmit,
  testId,
  titleTestId,
  children,
}: DialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const escape = useCallback(() => {
    if (dismissable) onClose();
  }, [dismissable, onClose]);
  useFocusTrap(dialogRef, { onEscape: escape, returnFocusTo });

  // Focus on open only (the dialog mounts when it opens).
  useLayoutEffect(() => {
    const target =
      initialFocus?.current ?? (dialogRef.current ? tabbables(dialogRef.current)[0] : undefined);
    target?.focus();
  }, [initialFocus]);

  // The dialog is a div: `form` may not carry `role="dialog"` (axe, aria-allowed-role). The form
  // inside holds the body and footer, so Enter in a field submits; `display: contents` keeps the
  // layout of the dialog's own column.
  const dialog = (
    <div className="dialog-backdrop">
      <div
        ref={dialogRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid={testId}
      >
        <h2 id={titleId} className="dialog-title" data-testid={titleTestId}>
          {title}
        </h2>
        <form
          className="dialog-form"
          noValidate
          onSubmit={
            onSubmit ??
            ((e) => {
              e.preventDefault();
            })
          }
        >
          {children}
        </form>
      </div>
    </div>
  );
  return createPortal(dialog, document.body);
}
