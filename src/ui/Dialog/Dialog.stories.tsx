import { useRef, type ComponentProps, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { Button } from '../Button';
import { Field, TextField, type FieldControl } from '../Field';
import { InlineMessage } from '../InlineMessage';
import { Dialog } from './Dialog';
import { DialogFooter } from './DialogFooter';

type DialogProps = ComponentProps<typeof Dialog>;

/** The dialog returns focus to the control that opened it; the story supplies that control. */
function DialogOnTrigger({ children, ...rest }: Omit<DialogProps, 'returnFocusTo'>) {
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button ref={trigger}>Add a source</Button>
      <Dialog {...rest} returnFocusTo={trigger}>
        {children}
      </Dialog>
    </>
  );
}

const text = (value: string, extra: Partial<ComponentProps<typeof TextField>> = {}) =>
  function TextControl(control: FieldControl) {
    return (
      <TextField
        id={control.id}
        aria-describedby={control.describedBy}
        invalid={control.invalid}
        value={value}
        onChange={fn()}
        {...extra}
      />
    );
  };

/** Cancel and the primary action, at the right of the footer (DESIGN.md 4.12). */
const footer = (primary: ReactNode, extra?: ReactNode) => (
  <DialogFooter start={extra}>
    <Button>Cancel</Button>
    {primary}
  </DialogFooter>
);

const meta = {
  title: 'UI/Dialog',
  component: DialogOnTrigger,
  args: {
    title: 'Add a source',
    onClose: fn(),
    children: (
      <>
        <Field label="Name" hint="Shown in the source list.">
          {text('Bench SA430')}
        </Field>
        {footer(<Button variant="primary">Save</Button>)}
      </>
    ),
  },
} satisfies Meta<typeof DialogOnTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Idle: the first control has focus when the dialog opens. */
export const Idle: Story = {};

export const ValidationError: Story = {
  args: {
    children: (
      <>
        <Field label="Name" error="Enter a name for this source.">
          {text('', { invalid: true, placeholder: 'e.g. Bench SA430' })}
        </Field>
        {footer(<Button variant="primary">Save</Button>)}
      </>
    ),
  },
};

/** Testing: the test runs as a busy button; Cancel stays enabled and discards the result. */
export const Testing: Story = {
  args: {
    children: (
      <>
        <Field label="Port">{text('/dev/ttyACM0')}</Field>
        <DialogFooter start={<Button busy>Testing connection…</Button>}>
          <Button>Cancel</Button>
          <Button variant="primary">Save</Button>
        </DialogFooter>
      </>
    ),
  },
};

/** Saving: the fields are unavailable; Save is busy at full strength; Cancel and Forget are off. */
export const Saving: Story = {
  args: {
    dismissable: false,
    children: (
      <>
        <Field label="Name">{text('Bench SA430', { disabled: true })}</Field>
        <DialogFooter
          start={
            <Button variant="destructive" disabled>
              Forget
            </Button>
          }
        >
          <Button disabled>Cancel</Button>
          <Button variant="primary" busy>
            Saving…
          </Button>
        </DialogFooter>
      </>
    ),
  },
};

export const SaveError: Story = {
  args: {
    children: (
      <>
        <Field label="Name">{text('Bench SA430')}</Field>
        <InlineMessage variant="error">
          Could not save: a source named Bench SA430 already exists.
        </InlineMessage>
        {footer(<Button variant="primary">Save</Button>)}
      </>
    ),
  },
};

/** A connected source: its connection fields are read-only, with a note saying why. */
export const Locked: Story = {
  args: {
    children: (
      <>
        <Field label="Name">{text('Bench SA430')}</Field>
        <Field label="Driver" hint="The driver cannot be changed.">
          {text('SA430 USB', { readOnly: true })}
        </Field>
        <InlineMessage variant="note">
          This source is connected. The name changes now; connection settings are locked until you
          disconnect.
        </InlineMessage>
        {footer(
          <Button variant="primary">Save</Button>,
          <Button variant="destructive">Forget</Button>,
        )}
      </>
    ),
  },
};

export const LongTitle: Story = {
  args: {
    title: 'Connection settings for the second bench analyzer in the lab (SA430 08FF41E50F8B3A34)',
  },
};
