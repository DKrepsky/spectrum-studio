import '../../test/mockApi';

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ActiveSource } from '../../bindings/ActiveSource';
import type { ParamSpec } from '../../bindings/ParamSpec';
import type { DecodedFrame } from '../../ipc/frame';
import { frameStore } from '../../state/frames';
import { emptyConfig } from '../../state/sourceConfig';
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
    useSession.setState({
      status: null,
      drivers: [simulatorDriver],
      busy: null,
      capabilitiesByDriver: {},
    });
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

  it('shows Center and Span disabled with no source', () => {
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

describe('MeasurementPanel: FFT size and Window availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSession.setState({
      status: null,
      drivers: [simulatorDriver],
      busy: null,
      capabilitiesByDriver: {},
    });
    useSources.setState({
      drivers: [simulatorDriver],
      list: [],
      active: { id: null, title: 'Signal simulator', config: SIMULATOR_CONFIG },
    });
  });

  it('disables FFT size and Window with the reason when the simulator was connected and is now not (issue 21)', () => {
    connect(activeSimulator);
    useSession
      .getState()
      .receiveStatus(status({ revision: 3, state: 'disconnected', source: null }));
    render(<MeasurementPanel />);
    for (const label of ['FFT size', 'Window']) {
      const control = screen.getByLabelText(label);
      expect(control).toBeDisabled();
      expect(control).toHaveAttribute('title', 'Connect a source first');
      expect(control).toHaveAccessibleDescription('Connect a source first');
    }
    // Same as Center and Span: disabled, not read-only, so the reason is the only thing shown.
    expect(screen.getByLabelText('Center frequency')).toBeDisabled();
  });

  it('removes FFT size and Window while no source has been opened in this run', () => {
    useSession
      .getState()
      .receiveStatus(status({ revision: 2, state: 'disconnected', source: null }));
    render(<MeasurementPanel />);
    expect(screen.queryByLabelText('FFT size')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Window')).not.toBeInTheDocument();
  });

  it('says Loading… on the device rows while start-up has not finished', () => {
    useSession.getState().receiveStatus(
      status({
        revision: 1,
        state: 'disconnected',
        source: null,
        launching: true,
        processing: undefined,
      }),
    );
    render(<MeasurementPanel />);
    expect(screen.getByLabelText('Center frequency')).toBeDisabled();
    expect(screen.getByLabelText('Span')).toBeDisabled();
    expect(screen.getByLabelText('Center frequency')).toHaveValue('—');
    expect(screen.getByTestId('acquire-button')).toHaveAttribute('title', 'Loading…');
    expect(screen.queryByLabelText('Averaging')).not.toBeInTheDocument();
  });

  it('says Status unavailable, not Connect a source first, on the device rows when start-up failed (S12)', () => {
    useSession.setState({
      status: null,
      startupFailed: true,
      capabilitiesByDriver: { sa430: TRACE_SOURCE.capabilities },
    });
    useSources.setState({ active: TRACE_ACTIVE });
    render(<MeasurementPanel />);
    for (const label of ['Frequency step', 'Reference level']) {
      const control = screen.getByLabelText(label);
      expect(control).toBeDisabled();
      expect(control).toHaveAttribute('title', 'Status unavailable');
      expect(control).toHaveAccessibleDescription(expect.stringContaining('Status unavailable'));
      expect(control).not.toHaveAccessibleDescription(
        expect.stringContaining('Connect a source first'),
      );
    }
    // Center and Span are disabled and never say "Connect a source first" (S12).
    for (const label of ['Center frequency', 'Span']) {
      expect(screen.getByLabelText(label)).toBeDisabled();
      expect(screen.getByLabelText(label)).not.toHaveAccessibleDescription(
        expect.stringContaining('Connect a source first'),
      );
    }
  });

  it('says Connecting… while the no-source reason is a connection in progress', () => {
    connect(activeSimulator);
    useSession.getState().receiveStatus(status({ revision: 3, state: 'connecting', source: null }));
    render(<MeasurementPanel />);
    expect(screen.getByLabelText('FFT size')).toHaveAccessibleDescription('Connecting…');
  });

  it('enables FFT size and Window, with no description, while a source is connected', () => {
    connect(activeSimulator);
    render(<MeasurementPanel />);
    for (const label of ['FFT size', 'Window']) {
      expect(screen.getByLabelText(label)).toBeEnabled();
      expect(screen.getByLabelText(label)).not.toHaveAttribute('title');
      expect(screen.getByLabelText(label)).not.toHaveAccessibleDescription();
    }
  });

  it('removes FFT size and Window for a trace source', () => {
    connect({
      ...activeSimulator,
      capabilities: { ...activeSimulator.capabilities, dataKind: 'trace' },
    });
    render(<MeasurementPanel />);
    expect(screen.queryByLabelText('FFT size')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Window')).not.toBeInTheDocument();
  });
});

describe('MeasurementPanel: source button and capture control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSession.setState({
      status: null,
      drivers: [simulatorDriver],
      busy: null,
      capabilitiesByDriver: {},
    });
    useSources.setState({
      drivers: [simulatorDriver],
      list: [],
      active: { id: null, title: 'Signal simulator', config: SIMULATOR_CONFIG },
    });
  });

  it('puts the source button first and the capture control last in the Measurement group', () => {
    connect(activeSimulator);
    const { container } = render(<MeasurementPanel />);
    // The panel's rows are the children of the rows wrapper: the source control first, capture last.
    const rows = container.querySelector('.measurement-rows');
    expect(rows?.firstElementChild).toBe(screen.getByTestId('source-button').parentElement);
    expect(rows?.lastElementChild).toBe(screen.getByRole('group', { name: 'Capture' }));
  });

  it('fills the column: the source button and the capture group are full width', () => {
    render(<MeasurementPanel />);
    expect(screen.getByRole('group', { name: 'Capture' })).toHaveClass('split-button-full');
    expect(screen.getByTestId('source-button').parentElement).toHaveClass('source-control');
  });

  it('shows no state pill and a disabled capture button while disconnected', () => {
    useSession.getState().receiveStatus(status({ revision: 1 }));
    render(<MeasurementPanel />);
    expect(screen.queryByTestId('session-state')).not.toBeInTheDocument();
    expect(screen.getByTestId('source-button')).toHaveAttribute(
      'aria-label',
      'Source: Signal simulator, Disconnected',
    );
    const button = screen.getByTestId('acquire-button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-label', 'Start continuous acquisition');
    expect(button).toHaveAttribute('data-state', 'idle');
    expect(button).toHaveAttribute('title', 'Connect a source first');
    expect(button).toHaveTextContent('Continuous');
    expect(screen.queryByText(/^(Run|Stop)$/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('simulated-badge')).not.toBeInTheDocument();
  });

  it('has one source control and none of the old connect buttons', () => {
    useSession.getState().receiveStatus(status({ revision: 1 }));
    render(<MeasurementPanel />);
    expect(screen.getByTestId('source-button')).toHaveTextContent('Signal simulator');
    expect(
      screen.queryByRole('button', { name: /^(Connect|Disconnect|Switch|Sources…)$/ }),
    ).toBeNull();
    expect(screen.queryByTestId('connect-button')).not.toBeInTheDocument();
  });

  it('disables the capture control until a source is chosen', () => {
    useSources.setState({ active: null });
    useSession.getState().receiveStatus(status({ revision: 1 }));
    render(<MeasurementPanel />);
    expect(screen.getByTestId('source-button')).toHaveTextContent('Choose a source');
    expect(screen.getByTestId('acquire-button')).toBeDisabled();
    expect(screen.getByTestId('acquire-button')).toHaveAttribute('title', 'Connect a source first');
  });

  it.each(['connecting', 'disconnecting'] as const)(
    'disables the capture button while %s',
    (state) => {
      useSession.getState().receiveStatus(status({ revision: 1, state }));
      render(<MeasurementPanel />);
      expect(screen.getByTestId('acquire-button')).toBeDisabled();
    },
  );

  it('marks the capture button aria-disabled while a command is in flight, even when connected', () => {
    useSession.getState().receiveStatus(status({ revision: 1, state: 'connected' }));
    useSession.setState({ busy: 'starting' });
    render(<MeasurementPanel />);
    const button = screen.getByTestId('acquire-button');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toBeEnabled();
  });

  it('keeps keyboard focus on the capture button while busy and ignores clicks until the command ends', async () => {
    useSession.getState().receiveStatus(status({ revision: 1, state: 'connected' }));
    let finishStart!: () => void;
    apiMock.startAcquisition.mockImplementationOnce(
      () => new Promise<null>((resolve) => (finishStart = () => resolve(null))),
    );
    render(<MeasurementPanel />);
    const button = screen.getByTestId('acquire-button');
    button.focus();
    expect(button).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    expect(apiMock.startAcquisition).toHaveBeenCalledTimes(1);
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(button);
    await userEvent.keyboard(' ');
    expect(apiMock.startAcquisition).toHaveBeenCalledTimes(1);
    expect(apiMock.stopAcquisition).not.toHaveBeenCalled();
    expect(button).toHaveFocus();

    finishStart();
    await waitFor(() => expect(useSession.getState().busy).toBeNull());
    expect(button).not.toHaveAttribute('aria-disabled');
    expect(button).toHaveFocus();
  });

  it('starts acquisition from the capture button without connecting first', async () => {
    useSession.getState().receiveStatus(status({ revision: 1, state: 'connected' }));
    render(<MeasurementPanel />);
    const button = screen.getByTestId('acquire-button');
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('aria-label', 'Start continuous acquisition');
    await userEvent.click(button);
    expect(apiMock.startAcquisition).toHaveBeenCalledTimes(1);
    expect(apiMock.connectRemembered).not.toHaveBeenCalled();
    expect(apiMock.connectSource).not.toHaveBeenCalled();
  });

  it('shows Pause while acquiring and stops without clearing the last frame', async () => {
    const frame = { receivedAt: 1 } as unknown as DecodedFrame;
    frameStore.publish(frame);
    useSession
      .getState()
      .receiveStatus(status({ revision: 2, state: 'acquiring', source: activeSimulator }));
    render(<MeasurementPanel />);
    const button = screen.getByTestId('acquire-button');
    expect(button).toHaveAttribute('aria-label', 'Pause continuous acquisition');
    expect(button).toHaveAttribute('data-state', 'acquiring');
    expect(button).toHaveAttribute('title', 'Pause acquisition: the last trace stays on screen');
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(apiMock.stopAcquisition).toHaveBeenCalledTimes(1);
    expect(frameStore.latest).toBe(frame);
    frameStore.clear();
  });

  it('keeps the source button state-aware while acquiring', () => {
    useSession
      .getState()
      .receiveStatus(status({ revision: 2, state: 'acquiring', source: activeSimulator }));
    render(<MeasurementPanel />);
    expect(screen.getByTestId('source-button')).toHaveAttribute(
      'aria-label',
      'Source: Signal simulator, Acquiring',
    );
    expect(screen.queryByTestId('simulated-badge')).not.toBeInTheDocument();
  });

  it('describes why the capture button is unavailable, through its accessible description', () => {
    useSession.getState().receiveStatus(status({ revision: 1 }));
    render(<MeasurementPanel />);
    expect(
      screen.getByRole('button', { name: 'Start continuous acquisition' }),
    ).toHaveAccessibleDescription('Connect a source first');
  });
});

const stepSpec: ParamSpec = {
  id: 'stepKhz',
  label: 'Frequency step',
  group: null,
  help: 'Distance between measured points.',
  kind: { type: 'number', min: 10, max: 500, step: 5, unit: 'kHz' },
  default: 100,
  required: false,
  placement: 'measurement',
};
const levelSpec: ParamSpec = {
  id: 'refLevelDbm',
  label: 'Reference level',
  group: null,
  help: 'Input level at the top of the range.',
  kind: {
    type: 'choice',
    options: [
      { value: '-35', label: '-35 dBm' },
      { value: '-40', label: '-40 dBm' },
    ],
  },
  default: '-35',
  required: false,
  placement: 'measurement',
};
/** A trace source, as the SA430 reports itself: its two settings are measurement rows. */
const TRACE_SOURCE: ActiveSource = {
  ...activeSimulator,
  config: emptyConfig('sa430'),
  driverName: 'TI SA430 spectrum analyzer',
  deviceLabel: 'SA430 08FF41E50F8B3A34',
  kind: 'spectrumAnalyzer',
  transport: 'usb',
  simulated: false,
  capabilities: {
    dataKind: 'trace',
    tuning: { minHz: 300e6, maxHz: 928e6 },
    spanOptionsHz: [],
    amplitudeUnit: 'dbm',
    params: [stepSpec, levelSpec],
  },
  settings: { centerHz: 433.9e6, spanHz: 10e6, params: { stepKhz: 100, refLevelDbm: '-35' } },
};
const TRACE_ACTIVE = { id: null, title: 'SA430', config: TRACE_SOURCE.config };

/** The visible labels of the Measurement rows, in DOM order. */
function rowLabels(container: HTMLElement) {
  return Array.from(container.querySelectorAll('.ui-field__label')).map((l) => l.textContent);
}

/** True when `a` comes before `b` in the document. */
function precedes(a: Element, b: Element) {
  return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe('MeasurementPanel: rows follow the selected source', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSession.setState({
      status: null,
      drivers: [simulatorDriver],
      busy: null,
      capabilitiesByDriver: {},
      commandError: null,
    });
    useSources.setState({
      drivers: [simulatorDriver],
      list: [],
      active: { id: null, title: 'Signal simulator', config: SIMULATOR_CONFIG },
    });
  });

  it('shows Frequency step and Reference level, not FFT size or Window, for a trace source', () => {
    useSession
      .getState()
      .receiveStatus(status({ revision: 2, state: 'connected', source: TRACE_SOURCE }));
    useSources.setState({ active: TRACE_ACTIVE });
    const { container } = render(<MeasurementPanel />);
    expect(rowLabels(container)).toEqual([
      'Center',
      'Span',
      'Frequency step',
      'Reference level',
      'Averaging',
    ]);
    expect(screen.getByLabelText('Frequency step')).toHaveValue(100);
    expect(screen.getByLabelText('Frequency step')).toHaveAccessibleDescription(
      'Distance between measured points. kHz',
    );
    expect(screen.getByLabelText('Reference level')).toHaveDisplayValue('-35 dBm');
    expect(screen.getByLabelText('Frequency step')).toBeEnabled();
  });

  it('shows FFT size and Window, not the device rows, for an IQ source', () => {
    connect(activeSimulator);
    const { container } = render(<MeasurementPanel />);
    expect(rowLabels(container)).toEqual(['Center', 'Span', 'FFT size', 'Window', 'Averaging']);
    expect(screen.queryByLabelText('Frequency step')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Reference level')).not.toBeInTheDocument();
  });

  it('keeps the same rows and the same order as the flat list in DOM order, with hold and capture last', () => {
    useSession
      .getState()
      .receiveStatus(status({ revision: 2, state: 'connected', source: TRACE_SOURCE }));
    useSources.setState({ active: TRACE_ACTIVE });
    const { container } = render(<MeasurementPanel />);
    const order = [
      screen.getByTestId('source-button'),
      screen.getByLabelText('Center frequency'),
      screen.getByLabelText('Span'),
      screen.getByLabelText('Frequency step'),
      screen.getByLabelText('Reference level'),
      screen.getByLabelText('Averaging'),
      screen.getByRole('checkbox', { name: 'Max hold' }),
      screen.getByRole('group', { name: 'Capture' }),
    ];
    for (let i = 0; i + 1 < order.length; i++) {
      expect(precedes(order[i]!, order[i + 1]!)).toBe(true);
    }
    expect(container.querySelector('.measurement-rows')?.lastElementChild).toBe(
      screen.getByRole('group', { name: 'Capture' }),
    );
  });

  it('shows the trace rows with the device values as em dashes and disabled, with the reason, after the source closed', () => {
    useSession
      .getState()
      .receiveStatus(status({ revision: 2, state: 'connected', source: TRACE_SOURCE }));
    useSession
      .getState()
      .receiveStatus(status({ revision: 3, state: 'disconnected', source: null }));
    useSources.setState({ active: TRACE_ACTIVE });
    const { container } = render(<MeasurementPanel />);
    expect(rowLabels(container)).toEqual([
      'Center',
      'Span',
      'Frequency step',
      'Reference level',
      'Averaging',
    ]);
    const step = screen.getByLabelText('Frequency step');
    expect(step).toHaveValue(null);
    expect(step).toHaveAttribute('placeholder', '—');
    expect(step).toBeDisabled();
    expect(step).toHaveAttribute('title', 'Connect a source first');
    expect(step).toHaveAccessibleDescription(
      'Distance between measured points. Connect a source first kHz',
    );
    const level = screen.getByLabelText<HTMLSelectElement>('Reference level');
    expect(level).toHaveValue('');
    expect(level).toHaveDisplayValue('—');
    expect(level).toBeDisabled();
    expect(screen.getByLabelText('Averaging')).toBeEnabled();
  });

  it('says Connecting… on the device rows while the remembered source connects', () => {
    useSession
      .getState()
      .receiveStatus(status({ revision: 2, state: 'connected', source: TRACE_SOURCE }));
    useSession.getState().receiveStatus(status({ revision: 3, state: 'connecting', source: null }));
    useSources.setState({ active: TRACE_ACTIVE });
    render(<MeasurementPanel />);
    expect(screen.getByLabelText('Reference level')).toHaveAccessibleDescription(
      expect.stringContaining('Connecting…'),
    );
  });

  it('shows no device rows for a source never opened in this run, and Center, Span, Averaging only', () => {
    useSources.setState({ active: TRACE_ACTIVE });
    useSession
      .getState()
      .receiveStatus(status({ revision: 1, state: 'disconnected', source: null }));
    const { container } = render(<MeasurementPanel />);
    expect(rowLabels(container)).toEqual(['Center', 'Span', 'Averaging']);
    expect(screen.queryByLabelText('Frequency step')).not.toBeInTheDocument();
  });

  it('sends a typed Frequency step as a source setting, from the Measurement row', async () => {
    apiMock.applySourceSettings.mockResolvedValue(TRACE_SOURCE.settings);
    useSession
      .getState()
      .receiveStatus(status({ revision: 2, state: 'connected', source: TRACE_SOURCE }));
    useSources.setState({ active: TRACE_ACTIVE });
    render(<MeasurementPanel />);
    const step = screen.getByLabelText('Frequency step');
    await userEvent.clear(step);
    await userEvent.type(step, '50{Enter}');
    expect(apiMock.applySourceSettings).toHaveBeenCalledWith({
      centerHz: null,
      spanHz: null,
      params: { stepKhz: 50 },
    });
    expect(step).toHaveFocus();
  });

  it('does not send a Frequency step outside its range', async () => {
    useSession
      .getState()
      .receiveStatus(status({ revision: 2, state: 'connected', source: TRACE_SOURCE }));
    useSources.setState({ active: TRACE_ACTIVE });
    render(<MeasurementPanel />);
    const step = screen.getByLabelText('Frequency step');
    await userEvent.clear(step);
    await userEvent.type(step, '7{Enter}');
    expect(step).toHaveAttribute('aria-invalid', 'true');
    expect(apiMock.applySourceSettings).not.toHaveBeenCalled();
  });

  it('sends a picked Reference level as a source setting', async () => {
    apiMock.applySourceSettings.mockResolvedValue(TRACE_SOURCE.settings);
    useSession
      .getState()
      .receiveStatus(status({ revision: 2, state: 'connected', source: TRACE_SOURCE }));
    useSources.setState({ active: TRACE_ACTIVE });
    render(<MeasurementPanel />);
    await userEvent.selectOptions(screen.getByLabelText('Reference level'), '-40');
    expect(apiMock.applySourceSettings).toHaveBeenCalledWith({
      centerHz: null,
      spanHz: null,
      params: { refLevelDbm: '-40' },
    });
  });

  it('makes a device row read-only, not disabled, while a change applies', () => {
    useSession
      .getState()
      .receiveStatus(status({ revision: 2, state: 'connected', source: TRACE_SOURCE }));
    useSources.setState({ active: TRACE_ACTIVE });
    useSession.setState({ busy: 'applying' });
    render(<MeasurementPanel />);
    const step = screen.getByLabelText('Frequency step');
    expect(step).not.toBeDisabled();
    expect(step).toHaveAttribute('readonly');
  });

  it('moves focus to Averaging when the focused kind row leaves the panel', () => {
    useSession
      .getState()
      .receiveStatus(status({ revision: 2, state: 'connected', source: TRACE_SOURCE }));
    useSources.setState({ active: TRACE_ACTIVE });
    render(<MeasurementPanel />);
    screen.getByLabelText('Frequency step').focus();
    expect(screen.getByLabelText('Frequency step')).toHaveFocus();

    // A device with an IQ kind replaces the trace source: the Frequency step row goes.
    act(() => {
      useSources.setState({
        active: { id: null, title: 'Signal simulator', config: SIMULATOR_CONFIG },
      });
      useSession
        .getState()
        .receiveStatus(status({ revision: 3, state: 'connected', source: activeSimulator }));
    });
    expect(screen.queryByLabelText('Frequency step')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Averaging')).toHaveFocus();
  });
});
