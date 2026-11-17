import type { Meta, StoryObj } from '@storybook/react-vite';

import { StatusStrip, type StatusItem } from './index';

const items: StatusItem[] = [
  { id: 'state', value: 'Live', dropOrder: 3 },
  { id: 'device', label: 'Device', value: 'SA430 08FF41E50F8B3A34', dropOrder: 1 },
  { id: 'span', label: 'Span', value: '100 MHz', dropOrder: 2 },
  { id: 'unit', label: 'Unit', value: 'Uncalibrated' },
];

const meta = {
  title: 'UI/StatusStrip',
  component: StatusStrip,
  args: { items },
  decorators: [
    (Story) => (
      <div style={{ width: 'var(--panel-width)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StatusStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** No source: the empty content is shown instead of items. */
export const Empty: Story = {
  args: { items: [], empty: 'No source' },
};

/** Narrow: the droppable items go whole, lowest first; the pinned ones stay (DESIGN.md 3.4). */
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 'var(--field-width-param)' }}>
        <Story />
      </div>
    ),
  ],
};

export const LongValue: Story = {
  args: {
    items: [
      {
        id: 'device',
        label: 'Device',
        value: 'Bench analyzer 3 on /dev/ttyACM0 (SA430 08FF41E50F8B3A34)',
      },
      { id: 'unit', label: 'Unit', value: 'Uncalibrated' },
    ],
  },
};
