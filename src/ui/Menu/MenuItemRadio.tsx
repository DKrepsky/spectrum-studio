import { useId, type ReactNode } from 'react';

const CHECK = (
  <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden focusable="false">
    <path
      d="M2.5 7.5l3 2.8 6-6.3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

interface MenuItemRadioProps {
  /** The item's name. Also its type-ahead label. */
  name: string;
  /** Second line, secondary text. */
  description?: string;
  /**
   * Icon in the first column, decorative (aria-hidden). The caller sets its colour. Without one the
   * column stays empty and reserved, so the names of all items line up.
   */
  icon?: ReactNode;
  /** This is the current choice: `aria-checked`, and the check mark shows. */
  checked: boolean;
  onSelect: () => void;
  testId?: string;
}

/**
 * One item of a `Menu`: a `menuitemradio` with the name and description as its accessible name and
 * description. The check mark shows only on the checked item.
 */
export function MenuItemRadio({
  name,
  description,
  icon,
  checked,
  onSelect,
  testId,
}: MenuItemRadioProps) {
  const id = useId();
  const nameId = `${id}-name`;
  const descId = `${id}-desc`;
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      aria-labelledby={nameId}
      aria-describedby={description ? descId : undefined}
      className="menu-item"
      data-menu-item
      data-label={name}
      data-testid={testId}
      onClick={onSelect}
    >
      <span className="menu-item-icon" aria-hidden>
        {icon}
      </span>
      <span className="menu-item-text">
        <span className="menu-item-name" id={nameId}>
          {name}
        </span>
        {description && (
          <span className="menu-item-desc" id={descId}>
            {description}
          </span>
        )}
      </span>
      <span className="menu-item-check" aria-hidden>
        {CHECK}
      </span>
    </button>
  );
}
