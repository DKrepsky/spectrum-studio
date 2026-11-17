import type { Meta, StoryObj } from '@storybook/react-vite';

import { LiveRegion } from './index';

const meta = {
  title: 'UI/LiveRegion',
  component: LiveRegion,
  args: { message: 'Acquisition started.' },
  // The region is visually hidden: the story shows what it announces, not the element.
  decorators: [
    (Story) => (
      <div>
        <Story />
        <p>Screen readers announce the message above; nothing is drawn.</p>
      </div>
    ),
  ],
} satisfies Meta<typeof LiveRegion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Announcing: Story = {};

/** Always in the DOM, filled only for an announcement (DESIGN.md 9.6). */
export const Empty: Story = {
  args: { message: '' },
};
