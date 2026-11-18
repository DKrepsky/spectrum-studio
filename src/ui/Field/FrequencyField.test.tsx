import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FrequencyField } from './FrequencyField';

function renderField(props: Partial<Parameters<typeof FrequencyField>[0]> = {}) {
  const onCommit = vi.fn();
  const utils = render(
    <FrequencyField
      label="Center"
      value={100_200_000}
      min={70_000_000}
      max={6_000_000_000}
      step={1_000_000}
      onCommit={onCommit}
      {...props}
    />,
  );
  return { onCommit, input: screen.getByRole('textbox', { name: 'Center' }), ...utils };
}

describe('FrequencyField', () => {
  it('shows the value with an SI unit', () => {
    const { input } = renderField();
    expect(input).toHaveValue('100.200000 MHz');
    expect(input).toHaveClass('ui-field__input', 'ui-field__input--frequency');
  });

  it('forwards native attributes and data-testid', () => {
    renderField({ 'data-testid': 'center' } as Partial<Parameters<typeof FrequencyField>[0]>);
    expect(screen.getByTestId('center')).toHaveAttribute('spellcheck', 'false');
  });

  it('parses a suffixed entry and commits it in Hz on Enter', async () => {
    const { input, onCommit } = renderField();
    await userEvent.clear(input);
    await userEvent.type(input, '433.92M{Enter}');
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(433_920_000);
  });

  it('accepts a spaced unit such as 2.4 GHz', async () => {
    const { input, onCommit } = renderField();
    await userEvent.clear(input);
    await userEvent.type(input, '2.4 GHz{Enter}');
    expect(onCommit).toHaveBeenCalledWith(2_400_000_000);
  });

  it('commits on blur', async () => {
    const { input, onCommit } = renderField();
    await userEvent.clear(input);
    await userEvent.type(input, '145M');
    await userEvent.tab();
    expect(onCommit).toHaveBeenCalledWith(145_000_000);
  });

  it('keeps an unparsable entry visible on Enter and marks it invalid', async () => {
    const { input, onCommit } = renderField();
    await userEvent.clear(input);
    await userEvent.type(input, 'abc{Enter}');
    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue('abc');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('title', 'Enter a frequency such as 100.2M or 433.92 MHz');
  });

  it('reverts an unparsable entry on blur without sending it', async () => {
    const { input, onCommit } = renderField();
    await userEvent.clear(input);
    await userEvent.type(input, 'abc');
    await userEvent.tab();
    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue('100.200000 MHz');
  });

  it('rejects an out-of-range entry with the allowed range in its tooltip', async () => {
    const { input, onCommit } = renderField();
    await userEvent.clear(input);
    await userEvent.type(input, '10M{Enter}');
    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('title', expect.stringContaining('Allowed range:'));
    expect(input).toHaveAttribute('title', expect.stringContaining('GHz'));
  });

  it('reverts on Escape without committing the draft', async () => {
    const { input, onCommit } = renderField();
    await userEvent.clear(input);
    await userEvent.type(input, '145M');
    await userEvent.keyboard('{Escape}');
    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue('100.200000 MHz');
    expect(input).not.toHaveFocus();
  });

  it('does not commit an unchanged value', async () => {
    const { input, onCommit } = renderField();
    await userEvent.click(input);
    await userEvent.keyboard('{Enter}');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('steps by the step with ArrowUp and ArrowDown and clamps to the range', async () => {
    const { input, onCommit } = renderField();
    input.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(onCommit).toHaveBeenLastCalledWith(101_200_000);
    await userEvent.keyboard('{ArrowDown}');
    expect(onCommit).toHaveBeenLastCalledWith(99_200_000);
  });

  it('clamps stepping at the maximum', async () => {
    const { input, onCommit } = renderField({ value: 5_999_999_000 });
    input.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(onCommit).toHaveBeenLastCalledWith(6_000_000_000);
  });

  it('does not step while a draft is being typed', async () => {
    const { input, onCommit } = renderField();
    await userEvent.clear(input);
    await userEvent.type(input, '1');
    await userEvent.keyboard('{ArrowUp}');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('keeps focus in the field after Enter commits a valid entry', async () => {
    const { input, onCommit } = renderField();
    await userEvent.clear(input);
    await userEvent.type(input, '145M{Enter}');
    expect(onCommit).toHaveBeenCalledWith(145_000_000);
    expect(input).toHaveFocus();
  });

  it('keeps focus in the field after Enter on an unchanged value', async () => {
    const { input, onCommit } = renderField();
    await userEvent.click(input);
    await userEvent.keyboard('{Enter}');
    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveFocus();
  });

  it('shows an em dash and does not step when there is no value', async () => {
    const { input, onCommit } = renderField({ value: null, disabled: true });
    expect(input).toHaveValue('—');
    expect(input).not.toHaveAttribute('aria-invalid');
    input.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('is not invalid with no value and no draft, and a typed entry is still checked', async () => {
    const { input, onCommit } = renderField({ value: null });
    await userEvent.click(input);
    await userEvent.clear(input);
    await userEvent.type(input, '145M{Enter}');
    expect(onCommit).toHaveBeenCalledWith(145_000_000);
    await userEvent.clear(input);
    await userEvent.type(input, 'abc{Enter}');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('is read-only when asked: shows the value, is not stepped, and keeps focus', async () => {
    const { input, onCommit } = renderField({ readOnly: true });
    expect(input).toHaveValue('100.200000 MHz');
    expect(input).toHaveAttribute('readonly');
    input.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveFocus();
  });

  it('is disabled when asked', () => {
    const { input } = renderField({ disabled: true });
    expect(input).toBeDisabled();
  });

  it('uses the toolbar width class when sized for the toolbar', () => {
    const { input } = renderField({ size: 'toolbar' });
    expect(input).toHaveClass('ui-field__input--toolbar');
  });
});
