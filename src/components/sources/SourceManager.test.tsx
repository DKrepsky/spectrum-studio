import '../../test/mockApi';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useSession } from '../../state/session';
import { fileDriver, plannedDriver, simulatorDriver, status } from '../../test/fixtures';
import { apiMock } from '../../test/mockApi';
import { SourceManager, fileDriverFor } from './SourceManager';

describe('SourceManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSession.setState({
      status: status(),
      drivers: [simulatorDriver, fileDriver, plannedDriver],
      savedSources: [],
      busy: null,
    });
  });

  it('groups sources by kind and marks planned integrations', () => {
    render(<SourceManager onClose={vi.fn()} />);
    expect(screen.getByText('Simulation')).toBeInTheDocument();
    expect(screen.getByText('Software-defined radios')).toBeInTheDocument();
    expect(screen.getByTestId('driver-soapysdr')).toHaveTextContent('Planned');
  });

  it('does not offer to connect planned integrations', async () => {
    render(<SourceManager onClose={vi.fn()} />);
    await userEvent.click(screen.getByTestId('driver-soapysdr'));
    expect(screen.getByTestId('planned-notice')).toBeInTheDocument();
    expect(screen.queryByTestId('manager-connect')).not.toBeInTheDocument();
  });

  it('requires a file before connecting a recording', async () => {
    apiMock.connectSource.mockResolvedValue(status({ state: 'connected' }));
    const onClose = vi.fn();
    render(<SourceManager onClose={onClose} initial={{ type: 'driver', id: 'iq-file' }} />);
    const connect = screen.getByTestId('manager-connect');
    expect(connect).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/File/), '/data/rec.cf32');
    expect(connect).toBeEnabled();
    await userEvent.click(connect);
    expect(apiMock.connectSource).toHaveBeenCalledWith(
      expect.objectContaining({ driverId: 'iq-file', connection: { path: '/data/rec.cf32' } }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('lists discovered devices for drivers with discovery', async () => {
    apiMock.discoverDevices.mockResolvedValue([
      {
        driverId: 'simulator',
        deviceId: 'sim0',
        label: 'Built-in simulator',
        details: [['Type', 'Virtual']],
      },
    ]);
    render(<SourceManager onClose={vi.fn()} />);
    expect(await screen.findByText('Built-in simulator')).toBeInTheDocument();
    expect(screen.getByRole('radio')).toBeChecked();
  });

  it('chooses the file driver from the extension', () => {
    expect(fileDriverFor('/a/b/trace.CSV')).toBe('trace-csv');
    expect(fileDriverFor('/a/rec.sigmf-meta')).toBe('iq-file');
  });
});
