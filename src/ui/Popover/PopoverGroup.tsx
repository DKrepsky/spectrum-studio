import { useId, type ReactNode } from 'react';

interface PopoverGroupProps {
  /** Visible heading, shown in capitals. It is the group's name. */
  label: string;
  /** A rule above the group, to set off a fixed block (e.g. Add a source, Connection). */
  divided?: boolean;
  children: ReactNode;
}

/**
 * A labelled group inside a popover or menu: a caps heading and the items under it. The heading sits
 * on the glyph column of the items (9px inset: the item border plus padding), so the two line up (F3).
 */
export function PopoverGroup({ label, divided, children }: PopoverGroupProps) {
  const headingId = useId();
  return (
    <div
      role="group"
      aria-labelledby={headingId}
      className={divided ? 'popover-group popover-group-divided' : 'popover-group'}
    >
      <div className="popover-heading" id={headingId} role="presentation">
        {label}
      </div>
      {children}
    </div>
  );
}
