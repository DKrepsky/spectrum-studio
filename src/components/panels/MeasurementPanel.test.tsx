import '../../test/mockApi';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SIMULATOR_CONFIG, useSession } from '../../state/session';
import { useSources } from '../../state/sources';
import { activeSimulator, simulatorDriver, status } from '../../test/fixtures';
import { apiMock } from '../../test/mockApi';
import { MeasurementPanel } from './MeasurementPanel';

const FIXED_SPAN = {
  ...activeSimulator,
  capabilities: { ...activeSimulator.capabilities, spanOptionsHz: [] },
};
const UNTUNABLE = {
  ...activeSimulator,
  capabilities: { ...activeSimulator.capabilities, tuning: null },
};

function connect(
  source: typeof activeSimulator | null,
  state: 'connected' | 'acquiring' = 'connected',
) {
  useSession.getState().receiveStatus(status({ revision: 2, state, source }));
}

describe('MeasurementPanel: Center and Span rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSession.setState({ status: null, drivers: [simulatorDriver], busy: null });
    useSources.setState({
      drivers: [simulatorDriver],
      list: [],
      active: { id: null, title: 'Signal simulator', config: SIMULATOR_CONFIG },
    });
  });

  it('renders Center then Span first, above FFT size, with visible labels and inline fields', () => {
    connect(activeSimulator);
    const { container } = render(<MeasurementPanel />);
    const labels = Array.from(container.querySelectorAll('.ui-field__label')).map(
      (l) => l.textContent,
    );
    expect(labels.slice(0, 4)).toEqual(['Center', 'Span', 'FFT size', 'Window']);
    expect(container.querySelectorAll('.ui-field--inline')).toHaveLength(5);
    expect(screen.getByLabelText('Center frequency')).toHaveValue('100.000000 MHz');
    expect(screen.getByLabelText('Span')).toHaveValue('2048000');
  });

  it('shows Center and Span disabled with no source, as the toolbar did', () => {
    render(<MeasurementPanel />);
    expect(screen.getByLabelText('Center frequency')).toBeDisabled();
    expect(screen.getByLabelText('Span')).toBeDisabled();
    expect(screen.getByLabelText('Span')).toHaveDisplayValue('—');
  });

  it('shows an em dash, not 0 Hz, for Center with no source', () => {
    render(<MeasurementPanel />);
    expect(screen.getByLabelText('Center frequency')).toHaveValue('—');
  });

  it('applies a typed centre frequency and leaves the span unchanged', async () => {
    apiMock.applySourceSettings.mockResolvedValue(activeSimulator.settings);
    connect(activeSimulator);
    render(<MeasurementPanel />);
    const input = screen.getByLabelText('Center frequency');
    await userEvent.clear(input);
    await userEvent.type(input, '433.92M{Enter}');
    expect(apiMock.applySourceSettings).toHaveBeenCalledWith({
      centerHz: 433.92e6,
      spanHz: null,
      params: {},
    });
  });

  it('keeps an out-of-range frequency visible as invalid instead of applying it', async () => {
    connect(activeSimulator);
    render(<MeasurementPanel />);
    const input = screen.getByLabelText('Center frequency');
    await userEvent.clear(input);
    await userEvent.type(input, '7G{Enter}');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(apiMock.applySourceSettings).not.toHaveBeenCalled();
  });

  it('applies a picked span', async () => {
    apiMock.applySourceSettings.mockResolvedValue(activeSimulator.settings);
    connect(activeSimulator);
    render(<MeasurementPanel />);
    await userEvent.selectOptions(screen.getByLabelText('Span'), '1024000');
    await waitFor(() =>
      expect(apiMock.applySourceSettings).toHaveBeenCalledWith({
        centerHz: null,
        spanHz: 1.024e6,
        params: {},
      }),
    );
  });

  it('lists a span the source does not offer as the current entry', () => {
    connect({ ...activeSimulator, settings: { ...activeSimulator.settings, spanHz: 5e6 } });
    render(<MeasurementPanel />);
    const options = Array.from(screen.getByLabelText<HTMLSelectElement>('Span').options).map(
      (o) => o.value,
    );
    expect(options).toEqual(['5000000', '1024000', '2048000']);
  });

  it('disables Center with the reason when the source cannot be tuned', () => {
    connect(UNTUNABLE);
    render(<MeasurementPanel />);
    const center = screen.getByLabelText('Center frequency');
    expect(center).toBeDisabled();
    expect(center).toHaveAttribute('title', 'This source cannot be tuned');
  });

  it('disables Span with the reason when the source has a fixed span', () => {
    connect(FIXED_SPAN);
    render(<MeasurementPanel />);
    const span = screen.getByLabelText('Span');
    expect(span).toBeDisabled();
    expect(span).toHaveAttribute('title', 'This source has a fixed span');
    expect(screen.getByLabelText('Center frequency')).toBeEnabled();
  });

  it('makes Center and Span read-only, not disabled, while settings are being applied', () => {
    connect(activeSimulator);
    useSession.setState({ busy: 'applying' });
    render(<MeasurementPanel />);
    // A disabled control drops keyboard focus (DESIGN 9.8), so both stay focusable.
    expect(screen.getByLabelText('Center frequency')).not.toBeDisabled();
    expect(screen.getByLabelText('Center frequency')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Span')).not.toBeDisabled();
    expect(screen.getByLabelText('Span')).toHaveAttribute('aria-readonly', 'true');
  });

  it('makes Center and Span editable again once the apply finishes', async () => {
    apiMock.applySourceSettings.mockResolvedValue(activeSimulator.settings);
    connect(activeSimulator);
    useSession.setState({ busy: 'applying' });
    const { rerender } = render(<MeasurementPanel />);
    expect(screen.getByLabelText('Center frequency')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Span')).toHaveAttribute('aria-readonly', 'true');
    useSession.setState({ busy: null });
    rerender(<MeasurementPanel />);
    expect(screen.getByLabelText('Center frequency')).not.toHaveAttribute('readonly');
    expect(screen.getByLabelText('Span')).not.toHaveAttribute('aria-readonly');
    const input = screen.getByLabelText('Center frequency');
    await userEvent.clear(input);
    await userEvent.type(input, '433.92M{Enter}');
    expect(apiMock.applySourceSettings).toHaveBeenCalledWith({
      centerHz: 433.92e6,
      spanHz: null,
      params: {},
    });
  });

  it('keeps focus on Span after a pick and ignores a second pick while applying', async () => {
    apiMock.applySourceSettings.mockResolvedValue(activeSimulator.settings);
    connect(activeSimulator);
    const { rerender } = render(<MeasurementPanel />);
    const span = screen.getByLabelText<HTMLSelectElement>('Span');
    span.focus();
    await userEvent.selectOptions(span, '1024000');
    expect(apiMock.applySourceSettings).toHaveBeenCalledTimes(1);
    // The pick sets busy = 'applying'; the same select re-renders read-only and keeps focus.
    useSession.setState({ busy: 'applying' });
    rerender(<MeasurementPanel />);
    expect(screen.getByLabelText('Span')).toBe(span);
    expect(span).toHaveFocus();
    expect(span).not.toBeDisabled();
    await userEvent.selectOptions(span, '1024000');
    expect(apiMock.applySourceSettings).toHaveBeenCalledTimes(1);
    expect(span).toHaveValue('2048000');
  });
});
