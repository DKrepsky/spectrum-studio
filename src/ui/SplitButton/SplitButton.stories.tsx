import { useRef, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';

import { InlineMessage } from '../InlineMessage';
import { Menu } from '../Menu/Menu';
import { MenuItemRadio } from '../Menu/MenuItemRadio';
import { SplitButton } from './index';

type SplitProps = ComponentProps<typeof SplitButton>;

const meta = {
  title: 'UI/SplitButton',
  component: SplitButton,
  args: {
    groupLabel: 'Capture',
    tone: 'accent',
    main: { label: 'Continuous', onPress: fn() },
    chevron: { ariaLabel: 'Capture mode: Continuous', expanded: false, onPress: fn() },
  },
} satisfies Meta<typeof SplitButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Idle, continuous: teal. One focus ring goes around both segments. */
export const Continuous: Story = {};

/** Idle, single: violet. */
export const Single: Story = {
  args: {
    tone: 'violet',
    main: { label: 'Single', onPress: fn() },
    chevron: { ariaLabel: 'Capture mode: Single', expanded: false, onPress: fn() },
  },
};

/** Acquiring: the stop tone is red for either mode; the chevron is locked with its reason. */
export const Acquiring: Story = {
  args: {
    tone: 'danger',
    main: { label: 'Stop', ariaLabel: 'Stop acquisition', onPress: fn() },
    chevron: {
      ariaLabel: 'Capture mode: Continuous',
      expanded: false,
      locked: true,
      describedBy: 'capture-locked',
      onPress: fn(),
    },
  },
  render: (args: SplitProps) => (
    <>
      <SplitButton {...args} />
      <InlineMessage id="capture-locked" variant="hint">
        Pause or cancel acquisition to change the mode.
      </InlineMessage>
    </>
  ),
};

/** A command in flight: the main segment keeps its strength; the label stays (DESIGN.md 4.3). */
export const Busy: Story = {
  args: {
    main: { label: 'Continuous', busy: true, onPress: fn() },
  },
};

/** No source: both segments are native-disabled; the reason is the plot hint. */
export const NoSource: Story = {
  args: {
    main: { label: 'Continuous', disabled: true, describedBy: 'capture-no-source', onPress: fn() },
    chevron: {
      ariaLabel: 'Capture mode: Continuous',
      expanded: false,
      disabled: true,
      describedBy: 'capture-no-source',
      onPress: fn(),
    },
  },
  render: (args: SplitProps) => (
    <>
      <SplitButton {...args} />
      <InlineMessage id="capture-no-source" variant="hint">
        Choose a source to begin…
      </InlineMessage>
    </>
  ),
};

/** Connecting: unavailable, the reason is the plot tag. */
export const Connecting: Story = {
  args: {
    main: { label: 'Continuous', disabled: true, onPress: fn() },
    chevron: {
      ariaLabel: 'Capture mode: Continuous',
      expanded: false,
      disabled: true,
      onPress: fn(),
    },
  },
};

/** Full width, as in the side panel's column: the main segment takes the room, the chevron stays at the end. */
export const FullWidth: Story = {
  args: { fullWidth: true },
  render: (args: SplitProps) => (
    <div style={{ width: 'var(--panel-width)' }}>
      <SplitButton {...args} />
    </div>
  ),
};

/** Keyboard focus on the main segment shows the group ring. */
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    const main = within(canvasElement).getByRole('button', { name: 'Continuous' });
    main.focus();
    await expect(main).toHaveFocus();
  },
};

/** The chevron opened its menu: `aria-expanded` is true and the menu is inside the group. */
function CaptureWithMenu() {
  const chevron = useRef<HTMLButtonElement>(null);
  return (
    <div style={{ position: 'relative' }}>
      <SplitButton
        groupLabel="Capture"
        tone="accent"
        chevronRef={chevron}
        main={{ label: 'Continuous', onPress: fn() }}
        chevron={{ ariaLabel: 'Capture mode: Continuous', expanded: true, onPress: fn() }}
      >
        <Menu label="Capture mode" anchorRef={chevron} onClose={fn()}>
          <MenuItemRadio name="Continuous" checked onSelect={fn()} />
          <MenuItemRadio name="Single" checked={false} onSelect={fn()} />
        </Menu>
      </SplitButton>
    </div>
  );
}

export const MenuOpen: Story = {
  render: () => <CaptureWithMenu />,
};
