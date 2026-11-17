import type { Meta, StoryObj } from '@storybook/react-vite';

import { Field, TextField } from '../Field';
import { Section } from './index';

const meta = {
  title: 'UI/Section',
  component: Section,
  args: { title: 'Acquisition', children: 'Frames per second, averaging and detection.' },
  decorators: [
    (Story) => (
      <div style={{ width: 'var(--panel-width)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Section>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Closed by default: set-and-forget settings. */
export const Closed: Story = {};

export const Open: Story = {
  args: { open: true },
};

export const Focus: Story = {
  args: { open: true },
  play: ({ canvasElement }) => {
    canvasElement.querySelector<HTMLElement>('summary')?.focus();
  },
};

export const LongTitle: Story = {
  args: {
    open: true,
    title: 'Connection and device settings for the second bench analyzer in the lab',
    children: (
      <Field label="Name">
        {(control) => <TextField id={control.id} value="Bench SA430" onChange={() => undefined} />}
      </Field>
    ),
  },
};
