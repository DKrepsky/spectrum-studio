import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';

import { IconButton } from './index';

const meta = {
  title: 'UI/IconButton',
  component: IconButton,
  args: { label: 'Dismiss', children: '×', onClick: fn() },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Rows and tables: the fill shows on hover only. */
export const Ghost: Story = {};

/** Popover row actions: a control fill. */
export const Filled: Story = {
  args: { variant: 'filled', label: 'Edit Bench SA430', children: '✎' },
};

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Dismiss' });
    button.focus();
    await expect(button).toHaveFocus();
  },
};

/** Focusable and inert: the reason is in a visible description elsewhere (DESIGN.md 5.4). */
export const Unavailable: Story = {
  args: { variant: 'filled', label: 'Forget Bench SA430', unavailable: true, children: '🗑' },
};
