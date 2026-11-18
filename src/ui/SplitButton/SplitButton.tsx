import type { KeyboardEvent, ReactNode, Ref } from 'react';

import './SplitButton.css';

/** The colour of the group: teal (continuous), violet (single), red (stop while acquiring). */
export type SplitTone = 'accent' | 'violet' | 'danger';

interface MainSegment {
  /** Visible label, e.g. the mode name. */
  label: ReactNode;
  /** Icon before the label, decorative. */
  icon?: ReactNode;
  /** Accessible name when it should differ from the label, e.g. "Start continuous acquisition". */
  ariaLabel?: string;
  title?: string;
  /** Native disabled: no focus, no press. */
  disabled?: boolean;
  /** A command in flight: `aria-disabled`, so focus and tooltip stay. The caller ignores the press. */
  busy?: boolean;
  /** Id of the element whose text says why the action is unavailable (DESIGN.md 9.12). */
  describedBy?: string;
  /** Data attributes the feature's tests read on the main button (no CSS reads them). */
  dataMode?: string;
  dataState?: string;
  onPress: () => void;
  testId?: string;
}

interface ChevronSegment {
  /** Accessible name, e.g. "Capture mode: Continuous". */
  ariaLabel: string;
  title?: string;
  /** Native disabled: no focus, no press. */
  disabled?: boolean;
  /** Visible and focusable, but unavailable (`aria-disabled`); the reason is in `title`. */
  locked?: boolean;
  /** Id of the element whose text says why the chevron is unavailable (DESIGN.md 9.12). */
  describedBy?: string;
  /** Whether the popup it opens is shown (`aria-expanded`). */
  expanded: boolean;
  /** What it opens. Default `menu`. */
  popup?: 'menu' | 'dialog';
  onPress: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void;
  testId?: string;
}

interface SplitButtonProps {
  /** Accessible name of the group, e.g. "Capture". */
  groupLabel: string;
  tone: SplitTone;
  main: MainSegment;
  chevron: ChevronSegment;
  /** Focus target of the chevron (returned to after the popup closes). */
  chevronRef?: Ref<HTMLButtonElement>;
  /**
   * The group fills its column (the side panel, 3.6): the main segment takes the room and the chevron
   * stays at the right edge. The segment widths of the default placement are unchanged.
   */
  fullWidth?: boolean;
  /** The popup the chevron opens (a `Menu` or `Popover`), rendered inside the group. */
  children?: ReactNode;
}

/**
 * Two buttons in one group: a main action and a chevron that opens a popup. Geometry is fixed
 * (main 128px, chevron 26px, height `--control-height`), so no state moves the layout. One focus
 * ring goes around the whole group, not one per segment (`:has()` in SplitButton.css).
 */
export function SplitButton({
  groupLabel,
  tone,
  main,
  chevron,
  chevronRef,
  fullWidth,
  children,
}: SplitButtonProps) {
  return (
    <div
      className={fullWidth ? 'split-button split-button-full' : 'split-button'}
      role="group"
      aria-label={groupLabel}
      data-tone={tone}
    >
      <button
        type="button"
        className="split-main"
        onClick={main.onPress}
        disabled={main.disabled}
        aria-disabled={main.busy || undefined}
        aria-label={main.ariaLabel}
        aria-describedby={main.describedBy}
        title={main.title}
        data-mode={main.dataMode}
        data-state={main.dataState}
        data-testid={main.testId}
      >
        {main.icon}
        <span className="split-label">{main.label}</span>
      </button>
      <button
        ref={chevronRef}
        type="button"
        className="split-chevron"
        onClick={chevron.onPress}
        onKeyDown={chevron.onKeyDown}
        disabled={chevron.disabled}
        aria-disabled={chevron.locked || undefined}
        aria-haspopup={chevron.popup ?? 'menu'}
        aria-expanded={chevron.expanded}
        aria-label={chevron.ariaLabel}
        aria-describedby={chevron.describedBy}
        title={chevron.title}
        data-testid={chevron.testId}
      >
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden focusable="false">
          <path
            d="M2.5 4.5L6 8l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {children}
    </div>
  );
}
