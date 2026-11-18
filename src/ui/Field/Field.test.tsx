import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { rule } from '../../test/css';
import { Checkbox } from './Checkbox';
import { Field } from './Field';
import { Select } from './Select';
import { TextField } from './TextField';

const css = readFileSync(resolve(__dirname, 'Field.css'), 'utf8');

describe('Field', () => {
  it('labels the control through htmlFor and passes its id to the render function', () => {
    render(
      <Field label="Name" id="name">
        {({ id }) => <input id={id} />}
      </Field>,
    );
    expect(screen.getByLabelText('Name')).toHaveAttribute('id', 'name');
  });

  it('generates a unique id when none is given', () => {
    render(
      <>
        <Field label="A">{({ id }) => <input id={id} />}</Field>
        <Field label="B">{({ id }) => <input id={id} />}</Field>
      </>,
    );
    const a = screen.getByLabelText('A');
    const b = screen.getByLabelText('B');
    expect(a.id).not.toBe('');
    expect(a.id).not.toBe(b.id);
  });

  it('wires the hint and the error into aria-describedby and marks the control invalid', () => {
    render(
      <Field label="Port" id="port" hint="Usually 5000" error="Port must be a number">
        {({ id, describedBy, invalid }) => (
          <input id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
        )}
      </Field>,
    );
    const control = screen.getByLabelText('Port');
    expect(control).toHaveAttribute('aria-invalid', 'true');
    const described = (control.getAttribute('aria-describedby') ?? '').split(' ');
    expect(described).toHaveLength(2);
    expect(described.map((id) => document.getElementById(id)?.textContent)).toEqual([
      'Usually 5000',
      'Port must be a number',
    ]);
    expect(screen.getByText('Port must be a number')).toHaveClass('ui-inline-message--error');
  });

  it('leaves the control undescribed and valid without hint or error', () => {
    render(
      <Field label="Port">
        {({ id, describedBy, invalid }) => (
          <input id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
        )}
      </Field>,
    );
    const control = screen.getByLabelText('Port');
    expect(control).not.toHaveAttribute('aria-describedby');
    expect(control).not.toHaveAttribute('aria-invalid');
  });

  it('describes the control with the hint alone when there is no error', () => {
    render(
      <Field label="Center" hint="Allowed range: 70 MHz – 6 GHz">
        {({ id, describedBy }) => <input id={id} aria-describedby={describedBy} />}
      </Field>,
    );
    expect(screen.getByLabelText('Center')).toHaveAccessibleDescription(
      'Allowed range: 70 MHz – 6 GHz',
    );
  });

  it('puts the label beside the control in the inline layout and above it when stacked', () => {
    const { container, rerender } = render(
      <Field label="Span" layout="inline">
        {({ id }) => <input id={id} />}
      </Field>,
    );
    expect(container.firstElementChild).toHaveClass('ui-field--inline');
    rerender(
      <Field label="Span" layout="stacked">
        {({ id }) => <input id={id} />}
      </Field>,
    );
    expect(container.firstElementChild).toHaveClass('ui-field--stacked');
  });

  it('draws a stacked label in secondary text, as beside a control (DESIGN.md 4.4)', () => {
    const label = rule(css, '.ui-field--stacked .ui-field__label');
    expect(label).toContain('color: var(--color-text-secondary)');
    expect(label).not.toContain('--color-text-primary');
  });

  it('forwards data-testid to the wrapper', () => {
    render(
      <Field label="Name" data-testid="name-field">
        {({ id }) => <input id={id} />}
      </Field>,
    );
    expect(screen.getByTestId('name-field')).toBeInTheDocument();
  });

  it('uses the boundary border token for the input (F15)', () => {
    expect(rule(css, '.ui-field__input')).toContain('border: 1px solid var(--color-border-input)');
    expect(rule(css, '.ui-field__input')).toContain('height: var(--field-height-compact)');
    expect(rule(css, '.ui-field__input--toolbar')).toContain('height: var(--control-height)');
  });

  it('dims disabled inputs with the unavailable opacity and marks read-only ones', () => {
    expect(rule(css, '.ui-field__input:disabled')).toContain('opacity: var(--opacity-unavailable)');
    expect(rule(css, '.ui-field__input[readonly]')).toContain('opacity: var(--opacity-read-only)');
    expect(rule(css, ".ui-field__input[aria-readonly='true']")).toContain(
      'opacity: var(--opacity-read-only)',
    );
  });
});

describe('TextField', () => {
  function Controlled({ initial }: { initial: string }) {
    const [text, setText] = useState(initial);
    return (
      <Field label="Name">
        {({ id }) => <TextField id={id} value={text} onChange={setText} data-testid="name" />}
      </Field>
    );
  }

  it('reports every change and shows the current value', async () => {
    render(<Controlled initial="Bench" />);
    const input = screen.getByLabelText('Name');
    expect(input).toHaveValue('Bench');
    await userEvent.clear(input);
    await userEvent.type(input, 'Lab');
    expect(input).toHaveValue('Lab');
    expect(screen.getByTestId('name')).toBe(input);
  });

  it('is a text input with aria-invalid when invalid', () => {
    render(<TextField aria-label="Host" value="" onChange={() => undefined} invalid />);
    const input = screen.getByRole('textbox', { name: 'Host' });
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveClass('ui-field__input--invalid');
  });

  it('keeps readOnly and forwards native attributes', () => {
    render(
      <TextField
        aria-label="Serial"
        value="08FF"
        onChange={() => undefined}
        readOnly
        maxLength={20}
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Serial' });
    expect(input).toHaveAttribute('readonly');
    expect(input).toHaveAttribute('maxlength', '20');
  });
});

describe('Select', () => {
  it('lists the options and reports the chosen value', async () => {
    const onChange = vi.fn();
    render(
      <Select
        label="Span"
        value="1"
        onChange={onChange}
        options={[
          { value: '1', label: '1 MHz' },
          { value: '2', label: '2 MHz' },
          { value: '3', label: 'Fixed', disabled: true },
        ]}
      />,
    );
    const select = screen.getByRole('combobox', { name: 'Span' });
    expect(select).toHaveValue('1');
    expect(screen.getByRole('option', { name: 'Fixed' })).toBeDisabled();
    await userEvent.selectOptions(select, '2');
    expect(onChange).toHaveBeenCalledWith('2');
  });

  it('ignores a pick while read-only and keeps focus on the select', async () => {
    const onChange = vi.fn();
    render(
      <Select
        label="Span"
        value="1"
        readOnly
        onChange={onChange}
        options={[
          { value: '1', label: '1 MHz' },
          { value: '2', label: '2 MHz' },
        ]}
      />,
    );
    const select = screen.getByRole('combobox', { name: 'Span' });
    expect(select).toHaveAttribute('aria-readonly', 'true');
    expect(select).toBeEnabled();
    select.focus();
    await userEvent.selectOptions(select, '2');
    expect(onChange).not.toHaveBeenCalled();
    expect(select).toHaveValue('1');
    expect(select).toHaveFocus();
  });

  it('takes its description from aria-describedby', () => {
    render(
      <Select
        label="Span"
        value="1"
        onChange={() => undefined}
        aria-describedby="span-reason"
        options={[{ value: '1', label: '1 MHz' }]}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Span' })).toHaveAttribute(
      'aria-describedby',
      'span-reason',
    );
  });
});

describe('Checkbox', () => {
  it('uses the label text as its name and reports the new state', async () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} label="Max hold" />);
    const box = screen.getByRole('checkbox', { name: 'Max hold' });
    expect(box).not.toBeChecked();
    await userEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('toggles with Space from the keyboard', async () => {
    const onChange = vi.fn();
    render(<Checkbox checked onChange={onChange} label="Min hold" />);
    const box = screen.getByRole('checkbox', { name: 'Min hold' });
    box.focus();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('keeps the swatch out of the accessible name', () => {
    render(
      <Checkbox
        checked
        onChange={() => undefined}
        label="Max hold"
        adornment={<span data-testid="swatch" />}
      />,
    );
    expect(screen.getByRole('checkbox', { name: 'Max hold' })).toBeInTheDocument();
    expect(screen.getByTestId('swatch').parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('is unavailable when disabled and does not report changes', async () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} label="Peaks" disabled />);
    expect(screen.getByRole('checkbox', { name: 'Peaks' })).toBeDisabled();
    expect(screen.getByText('Peaks').closest('label')).toHaveClass('ui-checkbox--disabled');
    await userEvent.click(screen.getByText('Peaks'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('is read-only when asked: stays enabled, shows the state and ignores changes', async () => {
    const onChange = vi.fn();
    render(<Checkbox checked onChange={onChange} label="Peaks" readOnly />);
    const box = screen.getByRole('checkbox', { name: 'Peaks' });
    expect(box).not.toBeDisabled();
    expect(box).toHaveAttribute('aria-readonly', 'true');
    expect(screen.getByText('Peaks').closest('label')).toHaveClass('ui-checkbox--read-only');
    await userEvent.click(box);
    expect(onChange).not.toHaveBeenCalled();
    expect(box).toBeChecked();
  });

  it('dims a read-only checkbox with the read-only opacity', () => {
    expect(rule(css, '.ui-checkbox--read-only')).toContain('opacity: var(--opacity-read-only)');
  });

  it('makes the label at least 24px high (F14)', () => {
    expect(rule(css, '.ui-checkbox')).toContain('min-height: var(--control-height-small)');
  });
});
