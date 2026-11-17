import type { Meta, StoryObj } from '@storybook/react-vite';

import { StatusDot } from './index';

const meta = {
  title: 'UI/StatusDot',
  component: StatusDot,
  args: { status: 'connected' },
} satisfies Meta<typeof StatusDot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Connected: Story = {};
export const Acquiring: Story = { args: { status: 'acquiring' } };
/** Animated, static under reduced motion. */
export const Connecting: Story = { args: { status: 'connecting' } };
export const Disconnecting: Story = { args: { status: 'disconnecting' } };
/** The one shape that is a cross, not a dot. */
export const Failed: Story = { args: { status: 'failed' } };
export const Absent: Story = { args: { status: 'absent' } };
export const Idle: Story = { args: { status: 'idle' } };
