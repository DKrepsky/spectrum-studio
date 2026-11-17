import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';

import { InlineMessage } from '../InlineMessage';
import { Button } from './index';

const meta = {
  title: 'UI/Button',
  component: Button,
  args: { children: 'Connect', onClick: fn() },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Primary: Story = {
  args: { variant: 'primary', children: 'Save' },
};

export const Destructive: Story = {
  args: { variant: 'destructive', children: 'Forget' },
};

export const Small: Story = {
  args: { size: 'small', children: 'Test' },
};

export const WithIcon: Story = {
  args: { icon: '▶', children: 'Start' },
};

export const Focus: Story = {
  args: { children: 'Connect' },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Connect' });
    button.focus();
    await expect(button).toHaveFocus();
  },
};

export const Unavailable: Story = {
  args: { unavailable: true, children: 'Connect' },
};

export const Busy: Story = {
  args: { busy: true, children: 'Connecting…' },
};

export const BusyWithIcon: Story = {
  args: { busy: true, icon: '▶', children: 'Start' },
};

export const LongLabel: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 'var(--field-width-param)' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    variant: 'primary',
    children: 'Connect to Bench analyzer 3 on the lab network (SA430 08FF41E50F8B3A34)',
  },
};

/** The error is never a button state: it is an inline message beside the control (DESIGN.md 4.1). */
export const WithErrorMessage: Story = {
  decorators: [
    (Story) => (
      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <Story />
        <InlineMessage variant="error">The device did not answer. Check the cable.</InlineMessage>
      </div>
    ),
  ],
  args: { children: 'Test connection' },
};
