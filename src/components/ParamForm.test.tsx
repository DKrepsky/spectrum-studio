import '../test/mockApi';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ParamSpec } from '../bindings/ParamSpec';
import { formatFrequency } from '../format/frequency';
import { rule } from '../test/css';
import { ParamField, ParamForm } from './ParamForm';

const css = readFileSync(resolve(__dirname, 'ParamForm.css'), 'utf8');

const specs: ParamSpec[] = [
  {
    id: 'freq',
    label: 'Frequency',
    group: 'Tone',
    help: null,
    kind: { type: 'number', min: 0, max: 6e9, step: 1000, unit: 'Hz' },
    default: 100e6,
    required: false,
    placement: 'source',
  },
  {
    id: 'level',
    label: 'Level',
    group: 'Tone',
    help: null,
    kind: { type: 'number', min: -140, max: 0, step: 1, unit: 'dBFS' },
    default: -20,
    required: false,
    placement: 'source',
  },
  {
    id: 'mode',
    label: 'Mode',
    group: null,
    help: null,
    kind: {
      type: 'choice',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    },
    default: 'a',
    required: false,
    placement: 'source',
  },
];

describe('ParamForm', () => {
  it('renders grouped controls from specs and reports valid changes', async () => {
    const onChange = vi.fn();
    render(<ParamForm idPrefix="t" specs={specs} values={{}} onChange={onChange} />);
    expect(screen.getByRole('group', { name: 'Tone' })).toBeInTheDocument();

    const freq = screen.getByLabelText('Frequency');
    await userEvent.clear(freq);
    await userEvent.type(freq, '100.3M{Enter}');
    expect(onChange).toHaveBeenCalledWith('freq', 100.3e6);

    await userEvent.selectOptions(screen.getByLabelText('Mode'), 'b');
    expect(onChange).toHaveBeenCalledWith('mode', 'b');
  });

  it('rejects values outside the declared range', async () => {
    const onChange = vi.fn();
    render(<ParamForm idPrefix="t" specs={specs} values={{ level: -20 }} onChange={onChange} />);
    const level = screen.getByLabelText('Level');
    await userEvent.clear(level);
    await userEvent.type(level, '5');
    expect(level).toHaveAttribute('aria-invalid', 'true');
    await userEvent.tab();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reverts a frequency draft on Escape without sending it', async () => {
    const onChange = vi.fn();
    render(<ParamForm idPrefix="t" specs={specs} values={{}} onChange={onChange} />);
    const freq = screen.getByLabelText('Frequency');
    await userEvent.clear(freq);
    await userEvent.type(freq, '200M{Escape}');
    expect(onChange).not.toHaveBeenCalled();
    expect(freq).toHaveValue(formatFrequency(100e6, 1));
  });

  it('lays out fields inline for the side panel and stacked by default', () => {
    const { container, rerender } = render(
      <ParamForm idPrefix="t" specs={specs} values={{}} onChange={vi.fn()} layout="inline" />,
    );
    expect(container.querySelectorAll('.ui-field--inline').length).toBe(3);
    expect(container.querySelector('.ui-field--stacked')).toBeNull();
    rerender(<ParamForm idPrefix="t" specs={specs} values={{}} onChange={vi.fn()} />);
    expect(container.querySelectorAll('.ui-field--stacked').length).toBe(3);
    expect(container.querySelector('.ui-field--inline')).toBeNull();
  });

  it('frames each group by default and draws no frame with framed={false}', () => {
    const { container, rerender } = render(
      <ParamForm idPrefix="t" specs={specs} values={{}} onChange={vi.fn()} />,
    );
    const framedGroup = screen.getByRole('group', { name: 'Tone' });
    expect(framedGroup).toHaveClass('param-group');
    expect(framedGroup).not.toHaveClass('param-group--bare');
    rerender(
      <ParamForm idPrefix="t" specs={specs} values={{}} onChange={vi.fn()} framed={false} />,
    );
    const bare = screen.getByRole('group', { name: 'Tone' });
    expect(bare).toHaveClass('param-group', 'param-group--bare');
    expect(container.querySelectorAll('.param-group--bare')).toHaveLength(2); // every group, the unnamed one too
  });

  it('is read-only while applying: no control is disabled, focus stays and changes are ignored', async () => {
    const onChange = vi.fn();
    const all: ParamSpec[] = [
      ...specs,
      {
        id: 'on',
        label: 'Enabled',
        group: null,
        help: null,
        kind: { type: 'bool' },
        default: false,
        required: false,
        placement: 'source',
      },
      {
        id: 'name',
        label: 'Name',
        group: null,
        help: null,
        kind: { type: 'text', maxLength: 16 },
        default: 'bench',
        required: false,
        placement: 'source',
      },
    ];
    render(<ParamForm idPrefix="t" specs={all} values={{}} onChange={onChange} readOnly />);

    for (const label of ['Frequency', 'Level', 'Name']) {
      const field = screen.getByLabelText(label);
      expect(field).not.toBeDisabled();
      expect(field).toHaveAttribute('readonly');
    }
    expect(screen.getByLabelText('Mode')).not.toBeDisabled();
    expect(screen.getByLabelText('Mode')).toHaveAttribute('aria-readonly', 'true');
    const enabled = screen.getByLabelText('Enabled');
    expect(enabled).not.toBeDisabled();
    await userEvent.click(enabled);
    expect(onChange).not.toHaveBeenCalled();
    expect(enabled).not.toBeChecked();

    // Enter on a frequency keeps focus in the field (DESIGN.md 9.8).
    const freq = screen.getByLabelText('Frequency');
    freq.focus();
    await userEvent.keyboard('{Enter}');
    expect(freq).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('makes the driver help the accessible description, and keeps it as the tooltip', () => {
    const withHelp: ParamSpec[] = [{ ...specs[1]!, help: 'Lower levels are more sensitive.' }];
    const { container } = render(
      <ParamForm idPrefix="t" specs={withHelp} values={{}} onChange={vi.fn()} layout="inline" />,
    );
    // The unit (dBFS) is appended to the help text.
    expect(screen.getByLabelText('Level')).toHaveAccessibleDescription(
      'Lower levels are more sensitive. dBFS',
    );
    expect(container.querySelector('.ui-field')).toHaveAttribute(
      'title',
      'Lower levels are more sensitive.',
    );
  });

  it('adds no help description when the spec has none', () => {
    render(<ParamForm idPrefix="t" specs={specs} values={{}} onChange={vi.fn()} />);
    // The unit is the only description: no help text is added.
    expect(screen.getByLabelText('Level')).toHaveAccessibleDescription('dBFS');
  });

  it('shows a number with no value as an em dash that cannot be edited', () => {
    const onChange = vi.fn();
    render(
      <ParamField
        spec={{
          ...specs[0]!,
          id: 'step',
          label: 'Frequency step',
          kind: { type: 'number', min: 10, max: 500, step: 5, unit: 'kHz' },
        }}
        value={100}
        onChange={onChange}
        id="m-step"
        layout="inline"
        noValue
        disabled
      />,
    );
    const step = screen.getByLabelText('Frequency step');
    expect(step).toHaveValue(null);
    expect(step).toHaveAttribute('placeholder', '—');
    expect(step).toBeDisabled();
    expect(screen.getByLabelText('Frequency step')).toHaveAccessibleDescription('kHz');
  });

  it('shows a choice with no value as one em dash option', () => {
    render(
      <ParamField
        spec={specs[2]!}
        value="a"
        onChange={vi.fn()}
        id="m-mode"
        layout="inline"
        noValue
        disabled
      />,
    );
    const select = screen.getByLabelText<HTMLSelectElement>('Mode');
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['—']);
    expect(select).toHaveValue('');
    expect(select).toBeDisabled();
  });

  it('gives the reason the tooltip and the accessible description when a field is unavailable', () => {
    render(
      <ParamField
        spec={{ ...specs[1]!, help: 'Input level at the top of the range.' }}
        value={-20}
        onChange={vi.fn()}
        id="m-level"
        layout="inline"
        disabled
        reason="Connect a source first"
      />,
    );
    const level = screen.getByLabelText('Level');
    expect(level).toHaveAttribute('title', 'Connect a source first');
    expect(
      screen.getByText('Input level at the top of the range.', { selector: '.visually-hidden' }),
    ).toBeInTheDocument();
    expect(level).toHaveAccessibleDescription(
      'Input level at the top of the range. Connect a source first dBFS',
    );
  });

  it('removes the padding and the border of a bare group in its stylesheet', () => {
    expect(rule(css, '.param-group--bare')).toContain('padding: 0');
    expect(rule(css, '.param-group--bare')).toContain('border: 0');
  });
});
