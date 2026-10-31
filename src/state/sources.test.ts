import { apiMock } from '../test/mockApi';

import { savedSource, simulatorDriver, status } from '../test/fixtures';
import { useSession } from './session';
import { SCAN_INTERVAL_MS, UNDO_FORGET_MS, useSources } from './sources';

const a = savedSource({ id: 'a', label: 'Alpha' });
const b = savedSource({ id: 'b', name: 'Bravo' });

const reset = () =>
  useSources.setState({
    list: [],
    activeId: null,
    active: null,
    failed: null,
    forgotten: null,
    error: null,
    drivers: [simulatorDriver],
    discovery: { results: [], scanned: false, scanning: false, error: null },
  });

describe('sources store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    reset();
  });
  afterEach(() => vi.useRealTimers());

  it('init loads the list and the last active entry without connecting', async () => {
    apiMock.listSources.mockResolvedValue({ sources: [a, b], activeId: 'b' });
    await useSources.getState().init();
    const s = useSources.getState();
    expect(s.list).toEqual([a, b]);
    expect(s.active).toMatchObject({ id: 'b', title: 'Bravo' });
    expect(apiMock.connectRemembered).not.toHaveBeenCalled();
    expect(apiMock.connectSource).not.toHaveBeenCalled();
  });

  it('init leaves no active entry when nothing was selected, and records errors', async () => {
    apiMock.listSources.mockResolvedValueOnce({ sources: [a], activeId: null });
    await useSources.getState().init();
    expect(useSources.getState().active).toBeNull();
    apiMock.listSources.mockRejectedValueOnce({ message: 'boom' });
    await useSources.getState().init();
    expect(useSources.getState().error).toBe('boom');
  });

  it('scans immediately and every 3 s, one request at a time, until stopped', async () => {
    let resolve: (v: []) => void = () => undefined;
    apiMock.discoverAll.mockImplementationOnce(() => new Promise((r) => (resolve = r)));
    const stop = useSources.getState().startScanning();
    expect(apiMock.discoverAll).toHaveBeenCalledTimes(1);
    expect(useSources.getState().discovery.scanning).toBe(true);

    await vi.advanceTimersByTimeAsync(SCAN_INTERVAL_MS * 2); // pending: no new requests
    expect(apiMock.discoverAll).toHaveBeenCalledTimes(1);

    resolve([]);
    await vi.advanceTimersByTimeAsync(0);
    expect(useSources.getState().discovery).toMatchObject({ scanned: true, scanning: false });

    await vi.advanceTimersByTimeAsync(SCAN_INTERVAL_MS);
    expect(apiMock.discoverAll).toHaveBeenCalledTimes(2);

    stop();
    await vi.advanceTimersByTimeAsync(SCAN_INTERVAL_MS * 3);
    expect(apiMock.discoverAll).toHaveBeenCalledTimes(2);
  });

  it('updates results silently and keeps the last ones when a scan fails', async () => {
    const result = { driverId: 'sa430', devices: [], error: null };
    apiMock.discoverAll.mockResolvedValueOnce([result]);
    const stop = useSources.getState().startScanning();
    await vi.advanceTimersByTimeAsync(0);
    const first = useSources.getState().discovery;
    apiMock.discoverAll.mockResolvedValueOnce([{ ...result }]);
    await vi.advanceTimersByTimeAsync(SCAN_INTERVAL_MS);
    expect(useSources.getState().discovery).toBe(first); // unchanged: no re-render
    apiMock.discoverAll.mockRejectedValueOnce({ message: 'no udev' });
    await vi.advanceTimersByTimeAsync(SCAN_INTERVAL_MS);
    expect(useSources.getState().discovery).toMatchObject({ results: [result], error: 'no udev' });
    stop();
  });

  it('forgets an entry and restores it with Undo within 5 s', async () => {
    useSources.setState({ list: [a, b] });
    apiMock.forgetSource.mockResolvedValue({ sources: [b], activeId: null });
    await useSources.getState().forget('a');
    expect(useSources.getState().list).toEqual([b]);
    expect(useSources.getState().forgotten).toEqual(a);

    apiMock.restoreSource.mockResolvedValue({ sources: [a, b], activeId: null });
    await useSources.getState().undoForget();
    expect(apiMock.restoreSource).toHaveBeenCalledWith(a);
    expect(useSources.getState().list).toEqual([a, b]);
    expect(useSources.getState().forgotten).toBeNull();
  });

  it('drops the undo offer after 5 s', async () => {
    useSources.setState({ list: [a] });
    apiMock.forgetSource.mockResolvedValue({ sources: [], activeId: null });
    await useSources.getState().forget('a');
    await vi.advanceTimersByTimeAsync(UNDO_FORGET_MS - 1);
    expect(useSources.getState().forgotten).toEqual(a);
    await vi.advanceTimersByTimeAsync(1);
    expect(useSources.getState().forgotten).toBeNull();
    await useSources.getState().undoForget();
    expect(apiMock.restoreSource).not.toHaveBeenCalled();
  });

  it('forgetting the connected source keeps it active until another is picked', async () => {
    useSession.setState({ status: status({ state: 'connected' }) });
    useSources.setState({ list: [a], active: { id: 'a', title: 'Alpha', config: a.config } });
    apiMock.forgetSource.mockResolvedValue({ sources: [], activeId: 'a' });
    await useSources.getState().forget('a');
    expect(useSources.getState().active?.title).toBe('Alpha');
    useSession.setState({ status: null });
  });

  it('forgetting a selected source that is not connected clears the selection', async () => {
    useSession.setState({ status: status({ state: 'disconnected' }) });
    useSources.setState({
      list: [a, b],
      active: { id: 'a', title: 'Alpha', config: a.config },
    });
    apiMock.forgetSource.mockResolvedValue({ sources: [b], activeId: 'a' });
    await useSources.getState().forget('a');
    expect(useSources.getState().active).toBeNull();
    // Forgetting some other entry leaves the selection alone.
    useSources.setState({ list: [a, b], active: { id: 'a', title: 'Alpha', config: a.config } });
    apiMock.forgetSource.mockResolvedValue({ sources: [a], activeId: 'a' });
    await useSources.getState().forget('b');
    expect(useSources.getState().active?.id).toBe('a');
    useSession.setState({ status: null });
  });

  describe('add, update and test', () => {
    const active = { id: 'a', title: 'Alpha', config: a.config };

    it('addSource refreshes the list and returns the record', async () => {
      const created = savedSource({ id: 'n', name: 'New' });
      apiMock.addSource.mockResolvedValueOnce(created);
      apiMock.listSources.mockResolvedValueOnce({ sources: [created, a], activeId: null });
      expect(await useSources.getState().addSource('New', created.config)).toEqual(created);
      expect(apiMock.addSource).toHaveBeenCalledWith('New', created.config);
      expect(useSources.getState().list).toEqual([created, a]);
    });

    it('updateSource refreshes the list and keeps the active title in sync', async () => {
      useSources.setState({ list: [a], activeId: 'a', active });
      const update = { name: 'Bench', deviceId: null, connection: {} };
      apiMock.updateSource.mockResolvedValueOnce({ ...a, name: 'Bench' });
      apiMock.listSources.mockResolvedValueOnce({
        sources: [{ ...a, name: 'Bench' }],
        activeId: 'a',
      });
      await useSources.getState().updateSource('a', update);
      expect(apiMock.updateSource).toHaveBeenCalledWith('a', update);
      expect(useSources.getState().active?.title).toBe('Bench');
    });

    it('failures reject with the backend message and leave the state untouched', async () => {
      useSources.setState({ list: [a], activeId: 'a', active });
      apiMock.addSource.mockRejectedValueOnce({ message: 'That name is already used.' });
      await expect(useSources.getState().addSource('x', a.config)).rejects.toEqual({
        message: 'That name is already used.',
      });
      apiMock.updateSource.mockRejectedValueOnce({ message: 'Name too long.' });
      await expect(
        useSources.getState().updateSource('a', { name: 'x', deviceId: null, connection: {} }),
      ).rejects.toEqual({ message: 'Name too long.' });
      const s = useSources.getState();
      expect(s.list).toEqual([a]);
      expect(s.active).toEqual(active);
      expect(apiMock.listSources).not.toHaveBeenCalled();
    });

    it('testSource passes through without touching active or failed', async () => {
      useSources.setState({ active, failed: 'k' });
      const result = await useSources.getState().testSource('sa430', { port: '/dev/ttyACM0' });
      expect(result).toMatchObject({ ok: true, deviceId: '08FF41E50F8B3A34' });
      expect(apiMock.testSource).toHaveBeenCalledWith('sa430', { port: '/dev/ttyACM0' });
      expect(useSources.getState().active).toEqual(active);
      expect(useSources.getState().failed).toBe('k');
      expect(apiMock.listSources).not.toHaveBeenCalled();
    });

    it('init re-adopts the active id after a merge removed the old one', async () => {
      useSources.setState({ list: [a, b], activeId: 'a', active });
      apiMock.listSources.mockResolvedValueOnce({ sources: [b], activeId: 'b' });
      await useSources.getState().init();
      expect(useSources.getState().active).toMatchObject({ id: 'b', title: 'Bravo' });
    });

    it('has no rename action any more', () => {
      expect('rename' in useSources.getState()).toBe(false);
    });
  });
});
