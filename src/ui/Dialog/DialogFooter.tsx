import type { ReactNode } from 'react';

interface DialogFooterProps {
  /** Left of the footer: the destructive action (e.g. Forget), kept apart from the rest. */
  start?: ReactNode;
  /** Right of the footer, in order: Cancel, then the primary action. */
  children: ReactNode;
}

/** The dialog's button row (DESIGN.md 4.12): destructive at the left, Cancel and primary at the right. */
export function DialogFooter({ start, children }: DialogFooterProps) {
  return (
    <div className="dialog-footer">
      {start && <div className="dialog-footer-start">{start}</div>}
      <div className="dialog-footer-end">{children}</div>
    </div>
  );
}
