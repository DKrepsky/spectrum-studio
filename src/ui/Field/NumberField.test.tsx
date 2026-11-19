import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { NumberField } from './NumberField';

function renderField(props: Partial<Parameters<typeof NumberField>[0]> = {}) {
  const onCommit = vi.fn();
  const utils = render(
    <NumberField
      label="Reference level"
      value={-10}
      min={-100}
      max={20}
      step={5}
      onCommit={onCommit}
      {...props}
    />,
  );
  return { onCommit, input: screen.getByRole('spinbutton', { name: 'Reference level' }), ...utils };
}

describe('NumberField', () => {
  it('shows the value and forwards native attributes', () => {
    const { input } = renderField({ id: 'ref', 'data-testid': 'ref-level' } as Partial<
      Parameters<typeof NumberField>[0]
    >);
    expect(input).toHaveValue(-10);
    expect(input).toHaveAttribute('id', 'ref');
    expect(input).toHaveAttribute('min', '-100');
    expect(input).toHaveAttribute('max', '20');
    expect(input).toHaveAttribute('step', '5');
    expect(screen.getByTestId('ref-level')).toBe(input);
  });

  it('commits a changed valid value on Enter', async () => {
    const { input, onCommit } = renderField();
    await userEvent.clear(input);
    await userEvent.type(input, '-3{Enter}');
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(-3);
  });

  it('commits on blur', async () => {
    const { input, onCommit } = renderField();
    await userEvent.clear(input);
    await userEvent.type(input, '7');
    await userEvent.tab();
    expect(onCommit).toHaveBeenCalledWith(7);
  });

  it('does not commit a value that did not change', async () => {
    const { input, onCommit } = renderField();
    await userEvent.click(input);
    await userEvent.keyboard('{Enter}');
    await userEvent.tab();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('keeps an out-of-range entry visible on Enter and marks it invalid, without sending it', async () => {
    const { input, onCommit } = renderField();
    await userEvent.clear(input);
    await userEvent.type(input, '50{Enter}');
    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue(50);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveClass('ui-field__input--invalid');
    expect(input).toHaveAttribute('title', 'Enter a number between -100 and 20');
  });

  it('reverts an invalid entry on blur without sending it', async () => {
    const { input, onCommit } = renderField();
    await userEvent.clear(input);
    await userEvent.type(input, '50');
    await userEvent.tab();
    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue(-10);
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('treats an empty entry as invalid', async () => {
    const { input, onCommit } = renderField();
    await userEvent.clear(input);
    await userEvent.keyboard('{Enter}');
    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('reverts on Escape and does not commit the draft when focus leaves', async () => {
    const { input, onCommit } = renderField();
    await userEvent.clear(input);
    await userEvent.type(input, '4');
    await userEvent.keyboard('{Escape}');
    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue(-10);
  });

  it('rejects a fraction when integer is set', async () => {
    const { input, onCommit } = renderField({ integer: true, value: 1, min: 0, max: 10 });
    await userEvent.clear(input);
    await userEvent.type(input, '2.5{Enter}');
    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('title', 'Enter a whole number between 0 and 10');
  });

  it('steps with ArrowUp and ArrowDown when no edit is in progress', async () => {
    const { input, onCommit } = renderField({ value: 0 });
    input.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(onCommit).toHaveBeenLastCalledWith(5);
    await userEvent.keyboard('{ArrowDown}');
    expect(onCommit).toHaveBeenLastCalledWith(-5);
  });

  it('clamps stepping to the range', async () => {
    const { input, onCommit } = renderField({ value: 18 });
    input.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(onCommit).toHaveBeenLastCalledWith(20);
  });

  it('does not step while a draft is being typed', async () => {
    const { input, onCommit } = renderField({ value: 0 });
    await userEvent.clear(input);
    await userEvent.type(input, '2');
    await userEvent.keyboard('{ArrowUp}');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('shows the unit after the control', () => {
    renderField({ unit: 'dB' });
    expect(screen.getByText('dB')).toHaveClass('ui-field__unit');
  });

  it('shows an em dash placeholder and no value when there is no value', () => {
    const { input } = renderField({ value: null });
    expect(input).toHaveValue(null);
    expect(input).toHaveAttribute('placeholder', '—');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('title');
  });

  it('does not step with ArrowUp or ArrowDown when there is no value', async () => {
    const { input, onCommit } = renderField({ value: null });
    input.focus();
    await userEvent.keyboard('{ArrowUp}{ArrowDown}');
    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue(null);
  });

  it('commits nothing on Enter or blur when there is no value and no draft', async () => {
    const { input, onCommit } = renderField({ value: null });
    input.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.tab();
    expect(onCommit).not.toHaveBeenCalled();
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('still validates and commits a typed value when there is no value', async () => {
    const { input, onCommit } = renderField({ value: null });
    await userEvent.type(input, '5{Enter}');
    expect(onCommit).toHaveBeenCalledWith(5);
  });

  it('marks an out-of-range typed value invalid when there is no value', async () => {
    const { input, onCommit } = renderField({ value: null });
    await userEvent.type(input, '50{Enter}');
    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('announces the unit as the accessible description', () => {
    const { input } = renderField({ unit: 'kHz' });
    expect(input).toHaveAccessibleDescription('kHz');
  });

  it('keeps a caller description and appends the unit to it', () => {
    const { input } = renderField({ unit: 'kHz', 'aria-describedby': 'caller-hint' });
    const ids = input.getAttribute('aria-describedby')?.split(' ') ?? [];
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe('caller-hint');
    expect(document.getElementById(ids[1]!)).toHaveTextContent('kHz');
  });

  it('has no description without a unit', () => {
    const { input } = renderField({ 'aria-describedby': 'caller-hint' });
    expect(input).toHaveAttribute('aria-describedby', 'caller-hint');
  });

  it('is disabled when asked', () => {
    const { input } = renderField({ disabled: true });
    expect(input).toBeDisabled();
  });

  it('marks an externally invalid value without blocking the commit rules', async () => {
    const { input, onCommit } = renderField({ invalid: true });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    await userEvent.clear(input);
    await userEvent.type(input, '-4{Enter}');
    expect(onCommit).toHaveBeenCalledWith(-4);
  });

  it('is read-only when asked: stays focusable, is not stepped and is not committed', async () => {
    const { input, onCommit } = renderField({ readOnly: true });
    expect(input).not.toBeDisabled();
    expect(input).toHaveAttribute('readonly');
    input.focus();
    await userEvent.keyboard('{ArrowUp}{Enter}');
    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveFocus();
  });
});
