import type { Meta, StoryObj } from '@storybook/react-vite';

import { InlineMessage } from './index';

const meta = {
  title: 'UI/InlineMessage',
  component: InlineMessage,
  args: { children: 'Enter a number between 1 and 6000 MHz.' },
} satisfies Meta<typeof InlineMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Secondary text under a section or a control. */
export const Hint: Story = {
  args: { variant: 'hint', children: 'Only sources that need manual setup are listed.' },
};

export const Note: Story = {
  args: { variant: 'note', children: 'The name changes now; connection settings are locked.' },
};

/** A state that is not an error. */
export const Info: Story = {
  args: { variant: 'info', children: 'Using the built-in simulator.' },
};

export const Warn: Story = {
  args: { variant: 'warn', children: 'Uncalibrated: levels are dBFS, not dBm.' },
};

export const ErrorMessage: Story = {
  args: { variant: 'error', children: 'Enter a number between 1 and 6000 MHz.' },
};

export const LongText: Story = {
  args: {
    variant: 'error',
    children:
      'The device at /dev/ttyACM0 (SA430 08FF41E50F8B3A34) rejected the sweep configuration because the requested span of 6000 MHz is outside the range the firmware reports.',
  },
};
