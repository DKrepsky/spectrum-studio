import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { Field, type FieldControl } from './Field';
import { Checkbox } from './Checkbox';
import { FrequencyField } from './FrequencyField';
import { NumberField } from './NumberField';
import { Select } from './Select';
import { TextField } from './TextField';

/*
 * One stories file for the field family (Field, TextField, NumberField, FrequencyField, Select,
 * Checkbox). Each story is one state: the story name says which control it shows.
 */

/** A text control wired to the wrapper's id, description and invalid state (DESIGN.md 4.4). */
const text =
  (value: string, extra: Partial<ComponentProps<typeof TextField>> = {}) =>
  (control: FieldControl) => (
    <TextField
      id={control.id}
      aria-describedby={control.describedBy}
      invalid={control.invalid}
      value={value}
      onChange={fn()}
      {...extra}
    />
  );

const meta = {
  title: 'UI/Field',
  component: Field,
  // Every story overrides the child control; render-only stories ignore args.
  args: { label: 'Name', layout: 'stacked', children: text('Bench SA430') },
  decorators: [
    (Story) => (
      <div style={{ width: 'var(--popover-width)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

/* Field: label, control, hint and error (DESIGN.md 4.4). */

/** Dialog and connect form: the label sits above the control. */
export const FieldStacked: Story = {
  args: { hint: 'Shown in the source list.' },
};

/** Side panel: the label sits left of a fixed-width control. */
export const FieldInline: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 'var(--panel-width)' }}>
        <Story />
      </div>
    ),
  ],
  args: { layout: 'inline', label: 'Gain', children: text('12') },
};

export const FieldInvalid: Story = {
  args: {
    label: 'Name',
    error: 'Enter a name for this source.',
    children: text('', { invalid: true }),
  },
};

export const FieldEmpty: Story = {
  args: {
    label: 'Name',
    children: text('', { placeholder: 'e.g. Bench SA430' }),
  },
};

export const FieldUnavailable: Story = {
  args: {
    label: 'Span',
    hint: 'This source has a fixed span.',
    children: text('100 MHz', { disabled: true }),
  },
};

export const FieldReadOnly: Story = {
  args: {
    label: 'Driver',
    hint: 'The driver cannot be changed. To use another, forget this source.',
    children: text('SA430 USB', { readOnly: true }),
  },
};

export const FieldFocus: Story = {
  args: { children: text('Bench SA430') },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Name' });
    input.focus();
    await expect(input).toHaveFocus();
  },
};

export const FieldLongText: Story = {
  args: {
    label: 'Name',
    hint: 'Shown in the source list and in the status bar.',
    children: text(
      'Bench analyzer 3 on /dev/ttyACM0 (SA430 08FF41E50F8B3A34) with the long calibration file',
    ),
  },
};

/* TextField. */

export const TextFieldToolbar: Story = {
  args: {
    label: 'Filter',
    children: (control) => (
      <TextField
        id={control.id}
        size="toolbar"
        value="433"
        onChange={fn()}
        aria-describedby={control.describedBy}
      />
    ),
  },
};

/* NumberField: committed on Enter or blur, reverted by Escape (DESIGN.md 4.4). */

export const NumberFieldDefault: Story = {
  render: () => (
    <Field label="Gain" layout="inline">
      {(control) => (
        <NumberField
          id={control.id}
          label="Gain"
          unit="dB"
          value={12}
          min={0}
          max={60}
          onCommit={fn()}
          aria-describedby={control.describedBy}
        />
      )}
    </Field>
  ),
};

/** Out of range while typing: the entry stays visible for correction and is never sent. */
export const NumberFieldOutOfRange: Story = {
  render: () => (
    <Field label="Gain" layout="inline" error="Enter a number between 0 and 60 dB">
      {(control) => (
        <NumberField
          id={control.id}
          label="Gain"
          unit="dB"
          value={12}
          min={0}
          max={60}
          onCommit={fn()}
          invalid={control.invalid}
          aria-describedby={control.describedBy}
        />
      )}
    </Field>
  ),
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('spinbutton', { name: 'Gain' });
    await userEvent.clear(input);
    await userEvent.type(input, '99');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
  },
};

/* FrequencyField. */

export const FrequencyFieldDefault: Story = {
  render: () => (
    <Field label="Centre frequency" layout="inline">
      {(control) => (
        <FrequencyField
          id={control.id}
          label="Centre frequency"
          value={433920000}
          min={24000000}
          max={1766000000}
          onCommit={fn()}
          aria-describedby={control.describedBy}
        />
      )}
    </Field>
  ),
};

export const FrequencyFieldInvalid: Story = {
  render: () => (
    <Field label="Centre frequency" layout="inline" error="Allowed range: 24 MHz – 1.766 GHz">
      {(control) => (
        <FrequencyField
          id={control.id}
          label="Centre frequency"
          value={433920000}
          min={24000000}
          max={1766000000}
          onCommit={fn()}
          invalid={control.invalid}
          aria-describedby={control.describedBy}
        />
      )}
    </Field>
  ),
};

/* Select: a short fixed list, the native element (DESIGN.md 4.5). */

export const SelectDefault: Story = {
  render: () => (
    <Field label="Span" layout="inline">
      {(control) => (
        <Select
          id={control.id}
          label="Span"
          value="100 MHz"
          onChange={fn()}
          options={[
            { value: '10 MHz', label: '10 MHz' },
            { value: '100 MHz', label: '100 MHz' },
            { value: '1 GHz', label: '1 GHz', disabled: true },
          ]}
        />
      )}
    </Field>
  ),
};

export const SelectUnavailable: Story = {
  args: { hint: 'This source has a fixed span.' },
  render: () => (
    <Field label="Span" hint="This source has a fixed span.">
      {(control) => (
        <Select
          id={control.id}
          label="Span"
          value="100 MHz"
          onChange={fn()}
          disabled
          aria-describedby={control.describedBy}
          options={[{ value: '100 MHz', label: '100 MHz' }]}
        />
      )}
    </Field>
  ),
};

export const SelectReadOnly: Story = {
  render: () => (
    <Field label="Span" layout="inline">
      {(control) => (
        <Select
          id={control.id}
          label="Span"
          value="100 MHz"
          onChange={fn()}
          readOnly
          options={[
            { value: '10 MHz', label: '10 MHz' },
            { value: '100 MHz', label: '100 MHz' },
          ]}
        />
      )}
    </Field>
  ),
};

/* Checkbox: the box comes before the text (DESIGN.md 4.6). */

export const CheckboxUnchecked: Story = {
  render: () => <Checkbox label="Hold" checked={false} onChange={fn()} />,
};

export const CheckboxChecked: Story = {
  render: () => <Checkbox label="Max hold" checked onChange={fn()} />,
};

/** The swatch is the trace the checkbox controls (max hold orange, min hold blue). */
export const CheckboxWithSwatch: Story = {
  render: () => (
    <Checkbox
      label="Max hold"
      checked
      onChange={fn()}
      adornment={
        <span
          style={{ width: 'var(--legend-swatch-width)', height: 'var(--legend-swatch-width)' }}
        />
      }
    />
  ),
};

export const CheckboxUnavailable: Story = {
  render: () => <Checkbox label="Averaging" checked={false} disabled onChange={fn()} />,
};

export const CheckboxFocus: Story = {
  render: () => <Checkbox label="Averaging" checked={false} onChange={fn()} />,
  play: async ({ canvasElement }) => {
    const box = within(canvasElement).getByRole('checkbox', { name: 'Averaging' });
    box.focus();
    await expect(box).toHaveFocus();
  },
};
