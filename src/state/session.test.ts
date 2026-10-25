import { apiMock } from '../test/mockApi';

import { activeSimulator, status } from '../test/fixtures';
import { useSession } from './session';

describe('session store', () => {
  beforeEach(() => {
    useSession.setState({ status: null, busy: null, commandError: null });
    vi.clearAllMocks();
  });

  it('ignores out-of-order status updates', () => {
    const { receiveStatus } = useSession.getState();
    receiveStatus(status({ revision: 5, state: 'acquiring', source: activeSimulator }));
    receiveStatus(status({ revision: 4, state: 'disconnected' }));
    expect(useSession.getState().status?.state).toBe('acquiring');
  });

  it('run connects the selected source, then starts acquisition', async () => {
    apiMock.connectSource.mockResolvedValue(status({ state: 'connected' }));
    useSession.getState().receiveStatus(status({ revision: 1 }));
    await useSession.getState().run();
    expect(apiMock.connectSource).toHaveBeenCalledWith(useSession.getState().selectedConfig);
    expect(apiMock.startAcquisition).toHaveBeenCalled();
  });

  it('does not start when connecting fails and surfaces the error', async () => {
    apiMock.connectSource.mockRejectedValue({ message: 'Device busy.' });
    useSession.getState().receiveStatus(status({ revision: 1 }));
    await useSession.getState().run();
    expect(apiMock.startAcquisition).not.toHaveBeenCalled();
    expect(useSession.getState().commandError).toBe('Device busy.');
    expect(useSession.getState().busy).toBeNull();
  });

  it('sends complete processing settings when one field changes', async () => {
    useSession.getState().receiveStatus(status({ revision: 1 }));
    await useSession.getState().setProcessing({ fftSize: 1024 });
    expect(apiMock.setProcessing).toHaveBeenCalledWith(
      expect.objectContaining({ fftSize: 1024, window: 'hann', averaging: 1 }),
    );
  });
});
