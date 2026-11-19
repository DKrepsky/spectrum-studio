import '../../test/mockApi';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ParamSpec } from '../../bindings/ParamSpec';
import { SIMULATOR_CONFIG, useSession } from '../../state/session';
import { activeSimulator, status } from '../../test/fixtures';
import { apiMock } from '../../test/mockApi';
import { SourcePanel } from './SourcePanel';

const stepKhz: ParamSpec = {
  id: 'stepKhz',
  label: 'Frequency step',
  group: null,
  help: null,
  kind: { type: 'number', min: 10, max: 500, step: 5, unit: 'kHz' },
  default: 100,
  required: false,
  placement: 'measurement',
};
const tone: ParamSpec = {
  id: 'tone',
  label: 'Tone level',
  group: null,
  help: null,
  kind: { type: 'number', min: -60, max: 0, step: 1, unit: 'dBFS' },
  default: -20,
  required: false,
  placement: 'source',
};

function connect(params: ParamSpec[]) {
  useSession.getState().receiveStatus(
    status({
      revision: 2,
      state: 'connected',
      source: {
        ...activeSimulator,
        config: SIMULATOR_CONFIG,
        capabilities: { ...activeSimulator.capabilities, params },
        settings: { ...activeSimulator.settings, params: { tone: -20, stepKhz: 100 } },
      },
    }),
  );
}

describe('SourcePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSession.setState({ status: null, busy: null });
  });

  it('lists only the source parameters, not the ones the Measurement group shows', () => {
    connect([stepKhz, tone]);
    render(<SourcePanel />);
    expect(screen.getByLabelText('Tone level')).toBeInTheDocument();
    expect(screen.queryByLabelText('Frequency step')).not.toBeInTheDocument();
  });

  it('asks the user to connect a source when none is open', () => {
    render(<SourcePanel />);
    expect(screen.getByText('Connect a source to see its settings.')).toBeInTheDocument();
    expect(screen.queryByText('Choose a source to see its settings.')).not.toBeInTheDocument();
  });

  it('shows the no-settings hint when every parameter is a measurement row', () => {
    connect([stepKhz]);
    render(<SourcePanel />);
    expect(screen.getByText('This source has no additional settings.')).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('shows the no-settings hint for a source with no parameters', () => {
    connect([]);
    render(<SourcePanel />);
    expect(screen.getByText('This source has no additional settings.')).toBeInTheDocument();
  });

  it('applies a source parameter from its own field', async () => {
    apiMock.applySourceSettings.mockResolvedValue(activeSimulator.settings);
    connect([tone]);
    render(<SourcePanel />);
    const field = screen.getByLabelText('Tone level');
    await userEvent.clear(field);
    await userEvent.type(field, '-5{Enter}');
    expect(apiMock.applySourceSettings).toHaveBeenCalledWith({
      centerHz: null,
      spanHz: null,
      params: { tone: -5 },
    });
  });
});
