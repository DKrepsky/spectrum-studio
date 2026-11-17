import type { ReactNode } from 'react';

interface ListRowProps {
  /** The select button's content: glyph, name, status word, badge, detail. */
  children: ReactNode;
  /** Accessible name of the select button. It should include the status word (DESIGN.md 9.12). */
  label: string;
  /** `two-line` (default, `--row-height`) or `single` (a fixed item, `--row-height-single`). */
  size?: 'two-line' | 'single';
  /** This is the active item: `aria-current="true"`, not a radio (DESIGN.md 4.11). */
  current?: boolean;
  /** Visible and focusable, but not actionable: `aria-disabled`, a press is ignored. */
  unavailable?: boolean;
  /** Dimmed text (for example a source that is not detected). */
  dimmed?: boolean;
  /** Briefly marks a row that was just saved. */
  highlight?: boolean;
  /** Tooltip for the select button. */
  title?: string;
  onSelect: () => void;
  /**
   * Row actions, ordinary buttons (e.g. Edit, Forget). They sit centred vertically in the badge
   * column, and the row's badge fades out while they show (the actions replace it). They are always
   * in the DOM and focusable; they are visible on hover or when one of them has focus, and they
   * never change the row's layout.
   */
  actions?: ReactNode;
  testId?: string;
}

/**
 * One row of a popover list (DESIGN.md 4.11): a select button for the whole line, and separate
 * action buttons in the badge column. The select button carries `data-list-item` (keyboard
 * movement) and `aria-current` when it is the active item. The row itself is not focusable.
 */
export function ListRow({
  children,
  label,
  size = 'two-line',
  current,
  unavailable,
  dimmed,
  highlight,
  title,
  onSelect,
  actions,
  testId,
}: ListRowProps) {
  return (
    <div className="list-row" data-list-row data-size={size}>
      <button
        type="button"
        className={`list-row-select${dimmed ? ' dimmed' : ''}`}
        data-list-item
        data-size={size}
        aria-label={label}
        aria-current={current ? 'true' : undefined}
        aria-disabled={unavailable || undefined}
        data-highlight={highlight || undefined}
        title={title}
        data-testid={testId}
        onClick={() => {
          if (!unavailable) onSelect();
        }}
      >
        {children}
      </button>
      {actions && <span className="list-row-actions">{actions}</span>}
    </div>
  );
}
