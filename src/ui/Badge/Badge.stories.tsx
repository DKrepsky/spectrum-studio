import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge } from './index';

const meta = {
  title: 'UI/Badge',
  component: Badge,
  args: { variant: 'chip', children: 'USB' },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A transport chip beside a control (DESIGN.md 4.7). */
export const Chip: Story = {};

/** A transport chip in the 64px badge column of a source row (`source-row-badge`). */
export const ChipInColumn: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 'var(--badge-column)' }}>
        <Story />
      </div>
    ),
  ],
  args: { children: 'Built-in' },
};

/**
 * Long text in a 140px chip (a parameter-field width). The text stays on one line and ends in an
 * ellipsis inside the pill; the full text is the pill's `title` (DESIGN.md 4.7, 5.9). The accessible
 * name is the full text.
 */
export const ChipLongText: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 'var(--field-width-param)' }}>
        <Story />
      </div>
    ),
  ],
  args: { children: 'Serial over USB CDC-ACM, bench unit 08FF41E50F8B3A34' },
};

/** A state over the canvas: pointer events are off (DESIGN.md 4.7). */
export const TagLive: Story = {
  args: { variant: 'tag', tone: 'live', children: 'LIVE' },
};

export const TagCapturing: Story = {
  args: { variant: 'tag', tone: 'capturing', children: 'CAPTURING' },
};

export const TagWaiting: Story = {
  args: { variant: 'tag', tone: 'waiting', children: 'WAITING' },
};

export const TagWarn: Story = {
  args: { variant: 'tag', tone: 'warn', children: 'STALE' },
};

export const TagNeutral: Story = {
  args: { variant: 'tag', tone: 'neutral', children: 'STOPPED' },
};
