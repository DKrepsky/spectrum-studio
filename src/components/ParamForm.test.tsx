import '../test/mockApi';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ParamSpec } from '../bindings/ParamSpec';
import { ParamForm } from './ParamForm';

const specs: ParamSpec[] = [
  {
    id: 'freq',
    label: 'Frequency',
    group: 'Tone',
    help: null,
    kind: { type: 'number', min: 0, max: 6e9, step: 1000, unit: 'Hz' },
    default: 100e6,
    required: false,
  },
  {
    id: 'level',
    label: 'Level',
    group: 'Tone',
    help: null,
    kind: { type: 'number', min: -140, max: 0, step: 1, unit: 'dBFS' },
    default: -20,
    required: false,
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
});
