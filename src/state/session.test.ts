import { apiMock } from '../test/mockApi';

import type { SessionStatus } from '../bindings/SessionStatus';
import { activeSimulator, savedSource, simulatorDriver, status } from '../test/fixtures';
import { useSession } from './session';
import { emptyConfig } from './sourceConfig';
import { useSources } from './sources';

const entry = savedSource({ id: 'e1' });

describe('session store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSession.setState({ status: null, busy: null, commandError: null });
    useSources.setState({
      list: [entry],
      activeId: 'e1',
      active: { id: 'e1', title: 'Signal simulator', config: entry.config },
      failed: null,
      drivers: [simulatorDriver],
    });
    apiMock.listSources.mockResolvedValue({ sources: [entry], activeId: 'e1' });
  });

  it('ignores out-of-order status updates', () => {
    const { receiveStatus } = useSession.getState();
    receiveStatus(status({ revision: 5, state: 'acquiring', source: activeSimulator }));
    receiveStatus(status({ revision: 4, state: 'disconnected' }));
    expect(useSession.getState().status?.state).toBe('acquiring');
  });

  it('connectTo a remembered entry shows it as active while connecting, then refreshes', async () => {
    let finish: (s: SessionStatus) => void = () => undefined;
    apiMock.connectRemembered.mockImplementation(() => new Promise((r) => (finish = r)));
    apiMock.listSources.mockResolvedValue({ sources: [entry], activeId: 'e1' });
    const pending = useSession.getState().connectTo({ type: 'remembered', id: 'e1' });
    expect(useSession.getState().busy).toBe('connecting');
    expect(useSources.getState().active).toMatchObject({ id: 'e1', title: 'Signal simulator' });
    finish(status({ state: 'connected' }));
    expect(await pending).toBe(true);
    expect(apiMock.connectRemembered).toHaveBeenCalledWith('e1');
    expect(apiMock.listSources).toHaveBeenCalled();
    expect(useSources.getState().failed).toBeNull();
    expect(useSession.getState().busy).toBeNull();
  });

  it('connectTo a config uses connect_source and adopts the remembered record', async () => {
    const config = emptyConfig('simulator');
    apiMock.connectSource.mockResolvedValue(status({ state: 'connected' }));
    apiMock.listSources.mockResolvedValue({ sources: [entry], activeId: 'e1' });
    expect(await useSession.getState().connectTo({ type: 'config', config })).toBe(true);
    expect(apiMock.connectSource).toHaveBeenCalledWith(config);
    expect(useSources.getState().active?.id).toBe('e1');
  });

  it('a failed connect surfaces the message, marks the row and keeps the target active', async () => {
    apiMock.connectRemembered.mockRejectedValue({ message: 'Device busy.' });
    expect(await useSession.getState().connectTo({ type: 'remembered', id: 'e1' })).toBe(false);
    expect(useSession.getState().commandError).toBe('Device busy.');
    expect(useSources.getState().failed).toBe('source-entry-e1');
    expect(useSources.getState().active?.id).toBe('e1');
    expect(useSession.getState().busy).toBeNull();
  });

  it('a failed new config stays active in memory with a failed key', async () => {
    const config = { ...emptyConfig('iq-file'), connection: { path: '/x/rec.cf32' } };
    apiMock.connectSource.mockRejectedValue({ message: 'No such file.' });
    await useSession.getState().connectTo({ type: 'config', config, title: 'rec' });
    expect(useSources.getState().active).toMatchObject({ id: null, title: 'rec' });
    expect(useSources.getState().failed).toBe('iq-file');
  });

  it('ignores an unknown remembered id', async () => {
    expect(await useSession.getState().connectTo({ type: 'remembered', id: 'nope' })).toBe(false);
    expect(apiMock.connectRemembered).not.toHaveBeenCalled();
  });

  it('run connects the active source, then starts acquisition', async () => {
    apiMock.connectRemembered.mockResolvedValue(status({ state: 'connected' }));
    useSession.getState().receiveStatus(status({ revision: 1 }));
    await useSession.getState().run();
    expect(apiMock.connectRemembered).toHaveBeenCalledWith('e1');
    expect(apiMock.startAcquisition).toHaveBeenCalled();
  });

  it('run reconnects a forgotten active source via its config', async () => {
    useSources.setState({ list: [] });
    apiMock.connectSource.mockResolvedValue(status({ state: 'connected' }));
    await useSession.getState().run();
    expect(apiMock.connectSource).toHaveBeenCalledWith(entry.config);
    expect(apiMock.startAcquisition).toHaveBeenCalled();
  });

  it('run only starts when already connected', async () => {
    useSession.getState().receiveStatus(status({ revision: 1, state: 'connected' }));
    await useSession.getState().run();
    expect(apiMock.connectRemembered).not.toHaveBeenCalled();
    expect(apiMock.startAcquisition).toHaveBeenCalled();
  });

  it('run is a no-op without an active source', async () => {
    useSources.setState({ active: null });
    await useSession.getState().run();
    expect(apiMock.connectRemembered).not.toHaveBeenCalled();
    expect(apiMock.connectSource).not.toHaveBeenCalled();
    expect(apiMock.startAcquisition).not.toHaveBeenCalled();
  });

  it('does not start when connecting fails and surfaces the error', async () => {
    apiMock.connectRemembered.mockRejectedValue({ message: 'Device busy.' });
    useSession.getState().receiveStatus(status({ revision: 1 }));
    await useSession.getState().run();
    expect(apiMock.startAcquisition).not.toHaveBeenCalled();
    expect(useSession.getState().commandError).toBe('Device busy.');
    expect(useSession.getState().busy).toBeNull();
  });

  it('switching while acquiring connects the new target and makes it active', async () => {
    const other = savedSource({ id: 'e2', name: 'Other' });
    useSources.setState({ list: [entry, other] });
    useSession
      .getState()
      .receiveStatus(status({ revision: 1, state: 'acquiring', source: activeSimulator }));
    apiMock.connectRemembered.mockResolvedValue(status({ revision: 2, state: 'connected' }));
    apiMock.listSources.mockResolvedValue({ sources: [entry, other], activeId: 'e2' });
    await useSession.getState().connectTo({ type: 'remembered', id: 'e2' });
    expect(apiMock.connectRemembered).toHaveBeenCalledWith('e2');
    expect(useSources.getState().active).toMatchObject({ id: 'e2', title: 'Other' });
  });

  it('follows an external reconnect to a different source', () => {
    const other = savedSource({ id: 'e2', name: 'Other', config: emptyConfig('iq-file') });
    useSources.setState({ list: [entry, other] });
    const source = { ...activeSimulator, config: emptyConfig('iq-file') };
    useSession.getState().receiveStatus(status({ revision: 1, state: 'connected', source }));
    expect(useSources.getState().active).toMatchObject({ id: 'e2', title: 'Other' });
  });

  it('follows an external connection by identity, not by port', () => {
    const sa = (id: string, deviceId: string, port: string) =>
      savedSource({
        id,
        name: id,
        config: { ...emptyConfig('sa430'), deviceId, connection: { port } },
      });
    const one = sa('one', 'S1', '/dev/ttyACM0');
    const two = sa('two', 'S2', '/dev/ttyACM1');
    useSources.setState({
      list: [one, two],
      active: { id: 'one', title: 'one', config: one.config },
    });
    // S1 was replugged on another port: same identity, active entry stays.
    const moved = { ...one.config, connection: { port: '/dev/ttyACM5' } };
    useSession
      .getState()
      .receiveStatus(
        status({ revision: 1, state: 'connected', source: { ...activeSimulator, config: moved } }),
      );
    expect(useSources.getState().active?.id).toBe('one');
    // An external connection to S2 (even on S1's old port) switches to entry two.
    const other = { ...two.config, connection: { port: '/dev/ttyACM0' } };
    useSession
      .getState()
      .receiveStatus(
        status({ revision: 2, state: 'connected', source: { ...activeSimulator, config: other } }),
      );
    expect(useSources.getState().active?.id).toBe('two');
  });

  it('adopts an unremembered connected source and ignores same-identity statuses', () => {
    useSources.setState({ active: null, list: [] });
    useSession
      .getState()
      .receiveStatus(status({ revision: 1, state: 'connected', source: activeSimulator }));
    expect(useSources.getState().active).toMatchObject({ id: null, title: 'Signal simulator' });
    useSources.setState({ active: { id: 'e1', title: 'Mine', config: emptyConfig('simulator') } });
    useSession
      .getState()
      .receiveStatus(status({ revision: 2, state: 'acquiring', source: activeSimulator }));
    expect(useSources.getState().active?.title).toBe('Mine');
  });

  it('sends complete processing settings when one field changes', async () => {
    useSession.getState().receiveStatus(status({ revision: 1 }));
    await useSession.getState().setProcessing({ fftSize: 1024 });
    expect(apiMock.setProcessing).toHaveBeenCalledWith(
      expect.objectContaining({ fftSize: 1024, window: 'hann', averaging: 1 }),
    );
  });
});
