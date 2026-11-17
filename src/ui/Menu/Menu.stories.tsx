import { useRef, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { Button } from '../Button';
import { Menu } from './Menu';
import { MenuItemRadio } from './MenuItemRadio';

type MenuProps = ComponentProps<typeof Menu>;

/**
 * The 18px glyph in the first column. Every item has one, as in the app's capture mode menu: an
 * item without an icon has no first track in the grid, so its name falls into the glyph column.
 */
const GLYPH = (
  <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden focusable="false">
    <path
      d="M1.5 12.5h2l1.5-6 1.5 6 1.5-6 1.5 6 1.5-6 1.5 6 1.5-6 1.5 6h2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  </svg>
);

/** The menu opens from a trigger it is anchored to; the story supplies the trigger. */
function MenuOnTrigger({ children, ...rest }: Omit<MenuProps, 'anchorRef'>) {
  const anchor = useRef<HTMLButtonElement>(null);
  return (
    <div style={{ position: 'relative', width: 'var(--popover-width-mode)' }}>
      <Button ref={anchor}>Capture mode: Continuous</Button>
      <Menu {...rest} anchorRef={anchor}>
        {children}
      </Menu>
    </div>
  );
}

const meta = {
  title: 'UI/Menu',
  component: MenuOnTrigger,
  args: {
    label: 'Capture mode',
    heading: 'Capture mode',
    onClose: fn(),
    children: (
      <>
        <MenuItemRadio
          icon={GLYPH}
          name="Continuous"
          description="Frames until stopped"
          checked
          onSelect={fn()}
        />
        <MenuItemRadio
          icon={GLYPH}
          name="Single"
          description="One frame, then stop"
          checked={false}
          onSelect={fn()}
        />
      </>
    ),
  },
} satisfies Meta<typeof MenuOnTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Open: focus goes to the checked item. */
export const Default: Story = {};

export const LongName: Story = {
  args: {
    heading: undefined,
    children: (
      <>
        <MenuItemRadio
          icon={GLYPH}
          name="Continuous acquisition with the averaging filter of the second bench analyzer"
          description="Frames until stopped; the long description wraps to a second line of text"
          checked
          onSelect={fn()}
        />
        <MenuItemRadio icon={GLYPH} name="Single" checked={false} onSelect={fn()} />
      </>
    ),
  },
};

/**
 * No item has an icon: the 18px first column stays reserved and empty, so the names still line up
 * with the check mark column and the description (DESIGN.md 4.11).
 */
export const NoIcon: Story = {
  args: {
    children: (
      <>
        <MenuItemRadio
          name="Continuous"
          description="Frames until stopped"
          checked
          onSelect={fn()}
        />
        <MenuItemRadio
          name="Single"
          description="One frame, then stop"
          checked={false}
          onSelect={fn()}
        />
      </>
    ),
  },
};

export const NoDescription: Story = {
  args: {
    children: (
      <>
        <MenuItemRadio icon={GLYPH} name="Continuous" checked={false} onSelect={fn()} />
        <MenuItemRadio icon={GLYPH} name="Single" checked onSelect={fn()} />
      </>
    ),
  },
};
