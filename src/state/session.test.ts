import { apiMock } from '../test/mockApi';

import type { SessionStatus } from '../bindings/SessionStatus';
import { activeSimulator, savedSource, simulatorDriver, status } from '../test/fixtures';
import { type BusyOperation, useSession } from './session';
import { emptyConfig } from './sourceConfig';
import { useSources } from './sources';

const entry = savedSource({ id: 'e1' });

describe('session store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSession.setState({ status: null, busy: null, commandError: null, commandErrorFrom: null });
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
    const config = { ...emptyConfig('sa430'), connection: { port: '/dev/ttyUSB9' } };
    apiMock.connectSource.mockRejectedValue({ message: 'No such port.' });
    await useSession.getState().connectTo({ type: 'config', config, title: 'bench' });
    expect(useSources.getState().active).toMatchObject({ id: null, title: 'bench' });
    expect(useSources.getState().failed).toBe('sa430');
  });

  it('a connect the UI did not start clears the stale Failed marker and connect error', async () => {
    apiMock.connectRemembered.mockRejectedValue({ message: 'Could not open /dev/ttyACM0' });
    const { receiveStatus } = useSession.getState();
    receiveStatus(
      status({
        revision: 1,
        lastNotice: { kind: 'deviceLost', message: 'USB device unplugged.', timestampMs: 0 },
      }),
    );
    expect(await useSession.getState().connectTo({ type: 'remembered', id: 'e1' })).toBe(false);
    receiveStatus(
      status({
        revision: 2,
        lastNotice: {
          kind: 'connectFailed',
          message: 'Could not connect to SA430: Could not open /dev/ttyACM0',
          timestampMs: 0,
        },
      }),
    );
    expect(useSources.getState().failed).toBe('source-entry-e1');
    expect(useSession.getState().commandError).toBe('Could not open /dev/ttyACM0');

    // The plug-in auto-connect: the backend connects without a UI command.
    receiveStatus(status({ revision: 3, state: 'connecting' }));
    receiveStatus(status({ revision: 4, state: 'connected', source: activeSimulator }));

    expect(useSources.getState().failed).toBeNull();
    expect(useSession.getState().commandError).toBeNull();
    expect(useSession.getState().commandErrorFrom).toBeNull();
    expect(useSession.getState().status?.state).toBe('connected');
  });

  it('a failed connect keeps its Failed marker when the real event order is connecting then disconnected', async () => {
    apiMock.connectRemembered.mockImplementation(() => {
      const { receiveStatus } = useSession.getState();
      receiveStatus(status({ revision: 2, state: 'connecting' }));
      receiveStatus(
        status({
          revision: 3,
          lastNotice: { kind: 'connectFailed', message: 'Could not connect', timestampMs: 0 },
        }),
      );
      return Promise.reject(new Error('Could not open /dev/ttyACM0'));
    });
    expect(await useSession.getState().connectTo({ type: 'remembered', id: 'e1' })).toBe(false);
    expect(useSources.getState().failed).toBe('source-entry-e1');
    expect(useSession.getState().commandError).toBe('Could not open /dev/ttyACM0');
    expect(useSession.getState().commandErrorFrom).toBe('connecting');
  });

  it('keeps a command error that is not from a connect when the status changes', () => {
    useSession.setState({ commandError: 'Could not start.', commandErrorFrom: 'starting' });
    useSession
      .getState()
      .receiveStatus(status({ revision: 2, state: 'connected', source: activeSimulator }));
    expect(useSession.getState().commandError).toBe('Could not start.');
    expect(useSession.getState().commandErrorFrom).toBe('starting');
  });

  it('an out-of-order status clears nothing', () => {
    const { receiveStatus } = useSession.getState();
    receiveStatus(status({ revision: 5, state: 'disconnected' }));
    useSources.setState({ failed: 'source-entry-e1' });
    useSession.setState({ commandError: 'Could not open', commandErrorFrom: 'connecting' });
    receiveStatus(status({ revision: 4, state: 'connected', source: activeSimulator }));
    expect(useSources.getState().failed).toBe('source-entry-e1');
    expect(useSession.getState().commandError).toBe('Could not open');
    expect(useSession.getState().status?.state).toBe('disconnected');
  });

  it('ignores an unknown remembered id', async () => {
    expect(await useSession.getState().connectTo({ type: 'remembered', id: 'nope' })).toBe(false);
    expect(apiMock.connectRemembered).not.toHaveBeenCalled();
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
    const other = savedSource({ id: 'e2', name: 'Other', config: emptyConfig('sa430') });
    useSources.setState({ list: [entry, other] });
    const source = { ...activeSimulator, config: emptyConfig('sa430') };
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

describe('session store capture mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSession.setState({ status: null, busy: null, commandError: null, commandErrorFrom: null });
  });

  it('sends the chosen mode and reports the settingMode operation while in flight', async () => {
    let finish: () => void = () => undefined;
    apiMock.setCaptureMode.mockImplementationOnce(
      () => new Promise((r) => (finish = () => r(null))),
    );
    const pending = useSession.getState().setCaptureMode('single');
    expect(useSession.getState().busy).toBe('settingMode');
    finish();
    await pending;
    expect(apiMock.setCaptureMode).toHaveBeenCalledWith('single');
    expect(useSession.getState().busy).toBeNull();
    expect(useSession.getState().commandError).toBeNull();
  });

  it('does not change the mode locally: only a backend status does', async () => {
    useSession.getState().receiveStatus(status({ revision: 1, captureMode: 'continuous' }));
    await useSession.getState().setCaptureMode('single');
    expect(useSession.getState().status?.captureMode).toBe('continuous');
    useSession.getState().receiveStatus(status({ revision: 2, captureMode: 'single' }));
    expect(useSession.getState().status?.captureMode).toBe('single');
  });

  it('surfaces a rejected change as commandError and keeps the status mode', async () => {
    useSession.getState().receiveStatus(status({ revision: 1, captureMode: 'continuous' }));
    apiMock.setCaptureMode.mockRejectedValue({
      message: 'Pause or cancel acquisition to change the capture mode.',
    });
    await useSession.getState().setCaptureMode('single');
    expect(useSession.getState().commandError).toBe(
      'Pause or cancel acquisition to change the capture mode.',
    );
    expect(useSession.getState().commandErrorFrom).toBe('settingMode');
    expect(useSession.getState().status?.captureMode).toBe('continuous');
    expect(useSession.getState().busy).toBeNull();
  });
});

describe('session store start and stop while a start is in flight (BUG-1)', () => {
  /** A start command the test resolves or rejects by hand, as the backend's reply would. */
  function holdStart() {
    let finish: (ok: boolean) => void = () => undefined;
    apiMock.startAcquisition.mockImplementation(
      () =>
        new Promise((resolve, reject) => {
          finish = (ok) => (ok ? resolve(null) : reject(new Error('No sweep')));
        }),
    );
    return (ok = true) => finish(ok);
  }

  beforeEach(() => {
    useSession.setState({ status: null, busy: null, commandError: null, commandErrorFrom: null });
  });

  it('sends a Stop queued during the start only after the start resolved, with no busy gap', async () => {
    const finish = holdStart();
    const busy: (BusyOperation | null)[] = [];
    const unsubscribe = useSession.subscribe((s) => busy.push(s.busy));
    const starting = useSession.getState().start();
    const stopped = useSession.getState().stop();
    expect(apiMock.stopAcquisition).not.toHaveBeenCalled();
    expect(useSession.getState().busy).toBe('stopping');

    finish();
    expect(await stopped).toBe(true);
    await starting;
    unsubscribe();
    expect(apiMock.stopAcquisition).toHaveBeenCalledTimes(1);
    expect(busy.slice(0, -1)).not.toContain(null);
    expect(busy.at(-1)).toBeNull();
    expect(useSession.getState().busy).toBeNull();
  });

  it('sends one Stop for a second stop request while one is queued', async () => {
    const finish = holdStart();
    const starting = useSession.getState().start();
    const first = useSession.getState().stop();
    const second = useSession.getState().stop();
    finish();
    expect(await Promise.all([first, second])).toEqual([true, true]);
    await starting;
    expect(apiMock.stopAcquisition).toHaveBeenCalledTimes(1);
  });

  it('does not send a queued Stop when the start fails, and reports the start failure', async () => {
    const finish = holdStart();
    const starting = useSession.getState().start();
    const stopped = useSession.getState().stop();
    finish(false);
    expect(await stopped).toBe(false);
    await starting;
    expect(apiMock.stopAcquisition).not.toHaveBeenCalled();
    expect(useSession.getState().commandError).toBe('No sweep');
    expect(useSession.getState().commandErrorFrom).toBe('starting');
    expect(useSession.getState().busy).toBeNull();
  });

  it('reports a queued Stop that fails as a stopping failure and resolves false', async () => {
    const finish = holdStart();
    apiMock.stopAcquisition.mockRejectedValueOnce({ message: 'the port is busy' });
    const starting = useSession.getState().start();
    const stopped = useSession.getState().stop();
    finish();
    expect(await stopped).toBe(false);
    await starting;
    expect(useSession.getState().commandError).toBe('the port is busy');
    expect(useSession.getState().commandErrorFrom).toBe('stopping');
    expect(useSession.getState().busy).toBeNull();
  });

  it('stops directly when no start is in flight', async () => {
    expect(await useSession.getState().stop()).toBe(true);
    expect(apiMock.stopAcquisition).toHaveBeenCalledTimes(1);
  });
});
