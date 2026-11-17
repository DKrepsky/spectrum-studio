import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { Button } from '../Button';
import { Banner, BannerRegion } from './index';

const meta = {
  title: 'UI/Banner',
  component: Banner,
  args: {
    tone: 'warning',
    urgency: 'status',
    onDismiss: fn(),
    children: 'Acquisition stopped: no frames for 3 s.',
  },
  decorators: [
    (Story) => (
      <BannerRegion>
        <Story />
      </BannerRegion>
    ),
  ],
} satisfies Meta<typeof Banner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An acquisition problem: polite, the user decides (DESIGN.md 9.6). */
export const Warning: Story = {};

/** An unexpected failure is announced at once (`role="alert"`). */
export const ErrorAlert: Story = {
  args: {
    tone: 'error',
    urgency: 'alert',
    children: 'Connection lost. The device stopped responding.',
  },
};

export const WithRecovery: Story = {
  args: {
    tone: 'error',
    urgency: 'alert',
    children: 'Connection lost. The device stopped responding.',
    actions: <Button size="small">Reconnect</Button>,
  },
};

/** A rejected command: dismiss only, no recovery. */
export const CommandRejected: Story = {
  args: {
    tone: 'error',
    urgency: 'status',
    children: 'The span cannot be changed while acquisition runs.',
  },
};

export const LongText: Story = {
  args: {
    tone: 'warning',
    urgency: 'status',
    children:
      'Acquisition failed on Bench analyzer 3 (SA430 08FF41E50F8B3A34) after 12 frames: the device returned an unexpected sweep length of 4096 points while 2048 were configured. Check the span and the reference level, then start again.',
  },
};

/** Dismissed: the banner leaves the region and the region keeps its place. */
export const Dismissed: Story = {
  render: function DismissedStory(args) {
    const [shown, setShown] = useState(true);
    return (
      <BannerRegion>
        {shown ? (
          <Banner {...args} onDismiss={() => setShown(false)}>
            {args.children}
          </Banner>
        ) : (
          <Button size="small" onClick={() => setShown(true)}>
            Show banner again
          </Button>
        )}
      </BannerRegion>
    );
  },
  args: { tone: 'warning', urgency: 'status', children: 'Acquisition stopped.' },
};
