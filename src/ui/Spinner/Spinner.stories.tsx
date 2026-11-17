import type { Meta, StoryObj } from '@storybook/react-vite';

import { Spinner } from './index';

const meta = {
  title: 'UI/Spinner',
  component: Spinner,
  args: { label: 'Connecting…' },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithLabel: Story = {};

/** Without a label the spinner is decorative and hidden from assistive technology. */
export const Decorative: Story = {
  args: { label: undefined },
};

export const LongLabel: Story = {
  args: {
    label: 'Testing connection to Bench analyzer 3 on /dev/ttyACM0 (SA430 08FF41E50F8B3A34)…',
  },
};
