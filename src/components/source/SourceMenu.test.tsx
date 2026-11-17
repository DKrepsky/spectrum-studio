import '../../test/mockApi';

import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { DriverInfo } from '../../bindings/DriverInfo';
import type { SavedSource } from '../../bindings/SavedSource';
import { SIMULATOR_CONFIG, useSession } from '../../state/session';
import { emptyConfig } from '../../state/sourceConfig';
import { useSources } from '../../state/sources';
import {
  activeSimulator,
  plannedDriver,
  SA430_SERIAL,
  sa430Device,
  sa430Driver,
  savedSource,
  simulatorDriver,
  status,
} from '../../test/fixtures';
import { apiMock } from '../../test/mockApi';
import type { SourceDialogProps } from './SourceDialog';
import { SourceButton } from './SourceButton';
import { useSourceMenu } from './menuState';

// The real dialog is T15; the menu is tested against its props contract.
vi.mock('./SourceDialog', () => ({
  SourceDialog: ({ target, onClose }: SourceDialogProps) => {
    const entry = target.mode === 'edit' ? target.entry : null;
    return (
      <div
        data-testid="dialog-stub"
        data-mode={target.mode}
        data-name={entry?.name ?? ''}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose({ saved: null, forgotten: false });
        }}
      >
        <button
          data-testid="dialog-cancel"
          onClick={() => onClose({ saved: null, forgotten: false })}
        >
          Cancel
        </button>
        <button
          data-testid="dialog-save-charlie"
          onClick={() =>
            onClose({
              saved: { id: 'c', name: 'Charlie' } as SavedSource,
              forgotten: false,
            })
          }
        >
          Save
        </button>
        <button
          data-testid="dialog-forgot"
          onClick={() => onClose({ saved: null, forgotten: true })}
        >
          Forgot
        </button>
        <input data-testid="dialog-input" autoFocus />
      </div>
    );
  },
}));

const networkDriver: DriverInfo = {
  id: 'rtl-tcp',
  name: 'Network SDR',
  description: 'IQ over TCP',
  kind: 'sdr',
  transport: 'network',
  status: 'available',
  supportsDiscovery: false,
  connectionParams: [
    {
      id: 'host',
      label: 'Host',
      group: null,
      help: null,
      kind: { type: 'text', maxLength: 100 },
      default: '',
      required: true,
    },
    {
      id: 'port',
      label: 'Port',
      group: null,
      help: null,
      kind: { type: 'number', min: 1, max: 65535, step: 1, unit: null },
      default: 1234,
      required: false,
    },
  ],
};

const serialDriver: DriverInfo = {
  ...networkDriver,
  id: 'sa430',
  name: 'Serial analyzer',
  kind: 'spectrumAnalyzer',
  transport: 'serial',
  supportsDiscovery: true,
  connectionParams: [{ ...networkDriver.connectionParams[0]!, id: 'port', label: 'Serial port' }],
};

const scanDriver: DriverInfo = { ...serialDriver, connectionParams: [] };

const alpha = savedSource({ id: 'a', name: 'Alpha', lastUsedMs: 3 });
const bravo = savedSource({
  id: 'b',
  name: '',
  label: 'Bravo radio',
  lastUsedMs: 2,
  config: { ...emptyConfig('sa430'), deviceId: '/dev/ttyACM0' },
});
const charlie = savedSource({ id: 'c', name: 'Charlie', lastUsedMs: 1 });

const baseDrivers = [simulatorDriver, plannedDriver, networkDriver];

function setup({
  list = [],
  activeId = null,
  drivers = baseDrivers,
}: { list?: SavedSource[]; activeId?: string | null; drivers?: DriverInfo[] } = {}) {
  useSources.setState({
    list,
    activeId,
    active: null,
    failed: null,
    forgotten: null,
    error: null,
    drivers,
    discovery: { results: [], scanned: false, scanning: false, error: null },
  });
  const entry = list.find((e) => e.id === activeId);
  if (entry) {
    useSources.setState({
      active: { id: entry.id, title: entry.name || entry.label, config: entry.config },
    });
  }
  apiMock.listSources.mockResolvedValue({ sources: list, activeId });
  return render(<SourceButton />);
}

const button = () => screen.getByTestId('source-button');
const menu = () => screen.getByTestId('source-menu');
const openMenu = async () => {
  await userEvent.click(button());
  return menu();
};

describe('source button and menu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSourceMenu.setState({ open: false });
    useSession.setState({ status: status({ revision: 1 }), busy: null, commandError: null });
    apiMock.discoverAll.mockResolvedValue([]);
  });

  describe('first launch', () => {
    it('shows "Choose a source" and does not open on its own', () => {
      setup();
      expect(button()).toHaveTextContent('Choose a source');
      expect(button()).toHaveAccessibleName('Source: Choose a source');
      expect(button()).toHaveAttribute('aria-haspopup', 'dialog');
      expect(button()).toHaveAttribute('aria-expanded', 'false');
      expect(button()).toHaveAttribute('title', 'Choose source (Ctrl+K)');
      expect(screen.queryByTestId('source-menu')).not.toBeInTheDocument();
      expect(apiMock.discoverAll).not.toHaveBeenCalled();
    });

    it('lists only the fixed block, never Planned drivers, and scans while open', async () => {
      setup();
      await openMenu();
      expect(button()).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('dialog', { name: 'Sources' })).toBeInTheDocument();
      expect(screen.getByTestId('source-simulator')).toBeInTheDocument();
      expect(screen.getByTestId('source-add')).toHaveTextContent('Add source…');
      expect(screen.queryByText(/Other sources/)).not.toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Your sources' })).not.toBeInTheDocument();
      expect(menu()).not.toHaveTextContent('SoapySDR');
      expect(menu()).not.toHaveTextContent('Planned');
      expect(screen.queryByText(/Switch|Sources…|^Connect$/)).not.toBeInTheDocument();
      await waitFor(() => expect(apiMock.discoverAll).toHaveBeenCalled());
      expect(
        await screen.findByText(
          'No new devices found. Plug one in; this list updates automatically.',
        ),
      ).toBeInTheDocument();
    });

    it('opens the menu when the shared state asks for it (Ctrl+K)', () => {
      setup();
      act(() => useSourceMenu.getState().setOpen(true));
      expect(menu()).toBeInTheDocument();
    });
  });

  describe('picking', () => {
    it('connects the simulator, closes the menu and shows the target while connecting', async () => {
      apiMock.connectSource.mockReturnValue(new Promise(() => undefined));
      setup();
      await openMenu();
      await userEvent.click(screen.getByTestId('source-simulator'));
      expect(apiMock.connectSource).toHaveBeenCalledWith(SIMULATOR_CONFIG);
      expect(screen.queryByTestId('source-menu')).not.toBeInTheDocument();
      expect(button()).toHaveFocus();
      expect(button()).toHaveTextContent('Signal simulator');
      expect(button()).toHaveAccessibleName('Source: Signal simulator, Connecting…');
    });

    it('hides the fixed simulator row once the simulator is remembered', async () => {
      setup({ list: [alpha] });
      await openMenu();
      expect(screen.queryByTestId('source-simulator')).not.toBeInTheDocument();
      expect(screen.getByTestId('source-entry-a')).toHaveTextContent('Alpha');
    });

    it('connects a remembered entry by id and ignores clicks while busy', async () => {
      apiMock.connectRemembered.mockResolvedValue(status({ revision: 2, state: 'connected' }));
      setup({ list: [alpha, charlie] });
      await openMenu();
      await userEvent.click(screen.getByTestId('source-entry-c'));
      expect(apiMock.connectRemembered).toHaveBeenCalledWith('c');
      expect(apiMock.connectRemembered).toHaveBeenCalledTimes(1);

      act(() => useSession.setState({ busy: 'connecting' }));
      await openMenu();
      expect(screen.getByTestId('source-entry-a')).toHaveAttribute('aria-disabled', 'true');
      await userEvent.click(screen.getByTestId('source-entry-a'));
      expect(apiMock.connectRemembered).toHaveBeenCalledTimes(1);
    });

    it('keeps Disconnected and shows Failed with the backend message after a failed pick', async () => {
      apiMock.connectRemembered.mockRejectedValue({ message: 'Cannot open the device.' });
      setup({ list: [alpha, charlie], activeId: 'a' });
      await openMenu();
      await userEvent.click(screen.getByTestId('source-entry-c'));
      await waitFor(() =>
        expect(useSession.getState().commandError).toBe('Cannot open the device.'),
      );
      expect(button()).toHaveAccessibleName('Source: Charlie, Disconnected');
      expect(useSession.getState().status?.state).toBe('disconnected');
      await openMenu();
      expect(screen.getByTestId('source-entry-c')).toHaveTextContent('Failed');
    });

    it('marks the active entry connected and offers Disconnect only while connected', async () => {
      apiMock.disconnectSource.mockResolvedValue(null);
      setup({ list: [alpha, charlie], activeId: 'a' });
      await openMenu();
      expect(screen.queryByTestId('source-disconnect')).not.toBeInTheDocument();
      await userEvent.keyboard('{Escape}');

      act(() =>
        useSession
          .getState()
          .receiveStatus(status({ revision: 5, state: 'acquiring', source: activeSimulator })),
      );
      await openMenu();
      const row = screen.getByTestId('source-entry-a');
      expect(row).toHaveAttribute('aria-current', 'true');
      expect(row).toHaveTextContent('Acquiring');
      await userEvent.click(screen.getByTestId('source-disconnect'));
      expect(apiMock.disconnectSource).toHaveBeenCalled();
    });

    it('disables Disconnect while transitioning', async () => {
      setup({ list: [alpha], activeId: 'a' });
      act(() =>
        useSession
          .getState()
          .receiveStatus(status({ revision: 6, state: 'disconnecting', source: activeSimulator })),
      );
      await openMenu();
      expect(screen.getByTestId('source-disconnect')).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByTestId('source-entry-a')).toHaveAttribute('aria-disabled', 'true');
    });

    it('can pick a remembered simulator entry with Fail to connect and shows the backend error', async () => {
      const failing = savedSource({
        id: 'f',
        name: 'Failing sim',
        config: {
          ...emptyConfig('simulator'),
          connection: { failConnect: true },
        },
      });
      apiMock.connectRemembered.mockRejectedValue({ message: 'Simulated connection failure.' });
      setup({ list: [failing] });
      await openMenu();
      await userEvent.click(screen.getByTestId('source-entry-f'));
      await waitFor(() =>
        expect(useSession.getState().commandError).toBe('Simulated connection failure.'),
      );
    });
  });

  describe('detected devices', () => {
    const device = {
      driverId: 'sa430',
      deviceId: '/dev/ttyACM0',
      label: 'SA430 · 0a1b',
      location: null,
      details: [] as [string, string][],
    };
    const other = {
      driverId: 'sa430',
      deviceId: '/dev/ttyACM1',
      label: 'SA430 · 2c3d',
      location: null,
      details: [['Serial', '2c3d']] as [string, string][],
    };

    it('lists new devices, hides remembered ones and picks a detected device', async () => {
      apiMock.discoverAll.mockResolvedValue([
        { driverId: 'sa430', devices: [device, other], error: null },
      ]);
      apiMock.connectSource.mockResolvedValue(status({ revision: 2, state: 'connected' }));
      setup({
        list: [bravo],
        drivers: [...baseDrivers, scanDriver],
      });
      await openMenu();
      const detected = await screen.findByTestId('source-detected-sa430-/dev/ttyACM1');
      expect(detected).toHaveTextContent('SA430 · 2c3d');
      expect(screen.queryByTestId('source-detected-sa430-/dev/ttyACM0')).not.toBeInTheDocument();
      expect(screen.getByTestId('source-entry-b')).not.toHaveTextContent('Not detected');
      expect(detected).toHaveAttribute('title', expect.stringContaining('Serial: 2c3d'));
      await userEvent.click(detected);
      expect(apiMock.connectSource).toHaveBeenCalledWith(
        expect.objectContaining({ driverId: 'sa430', deviceId: '/dev/ttyACM1' }),
      );
    });

    it('marks a remembered device that a successful scan did not find', async () => {
      apiMock.discoverAll.mockResolvedValue([{ driverId: 'sa430', devices: [], error: null }]);
      setup({
        list: [bravo],
        drivers: [...baseDrivers, scanDriver],
      });
      await openMenu();
      await waitFor(() =>
        expect(screen.getByTestId('source-entry-b')).toHaveTextContent('Not detected'),
      );
    });

    it('reports a failed scan without hiding the rest', async () => {
      apiMock.discoverAll.mockResolvedValue([
        { driverId: 'sa430', devices: [], error: 'udev down' },
      ]);
      setup({
        list: [alpha],
        drivers: [...baseDrivers, scanDriver],
      });
      await openMenu();
      expect(await screen.findByText('Could not scan for devices: udev down')).toBeInTheDocument();
      expect(screen.getByTestId('source-entry-a')).toBeInTheDocument();
    });
  });

  describe('keyboard', () => {
    it('opens with ArrowDown, focuses the active row, moves between rows and stops at the ends', async () => {
      setup({
        list: [alpha, bravo, charlie],
        activeId: 'b',
        drivers: [simulatorDriver, networkDriver, scanDriver],
      });
      button().focus();
      await userEvent.keyboard('{ArrowDown}');
      expect(menu()).toBeInTheDocument();
      expect(screen.getByTestId('source-entry-b')).toHaveFocus();
      await userEvent.keyboard('{ArrowDown}');
      expect(screen.getByTestId('source-entry-c')).toHaveFocus();
      await userEvent.keyboard('{End}');
      expect(screen.getByTestId('source-add')).toHaveFocus();
      await userEvent.keyboard('{ArrowDown}');
      expect(screen.getByTestId('source-add')).toHaveFocus(); // no wrap
      await userEvent.keyboard('{ArrowUp}');
      expect(screen.getByTestId('source-entry-c')).toHaveFocus();
      await userEvent.keyboard('{Home}');
      expect(screen.getByTestId('source-entry-a')).toHaveFocus();
    });

    it('is a dialog with list content: no menu, menuitem or radio roles', async () => {
      setup({ list: [alpha, charlie], activeId: 'a' });
      await openMenu();
      expect(screen.getByRole('dialog', { name: 'Sources' })).toBeInTheDocument();
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
      expect(screen.queryAllByRole('menuitemradio')).toHaveLength(0);
      const group = screen.getByRole('group', { name: 'Your sources' });
      expect(within(group).getAllByRole('list')).toHaveLength(1);
      expect(within(group).getByRole('button', { name: 'Alpha' })).toHaveAttribute('aria-current');
    });

    it('marks the active row with aria-current, not a checked state', async () => {
      setup({ list: [alpha, charlie], activeId: 'a' });
      await openMenu();
      const active = screen.getByTestId('source-entry-a');
      expect(active).toHaveAttribute('aria-current', 'true');
      expect(active).not.toHaveAttribute('aria-checked');
      expect(screen.getByTestId('source-entry-c')).not.toHaveAttribute('aria-current');
    });

    it('has no type-ahead: typing a letter moves nothing, Enter activates the focused row', async () => {
      apiMock.connectRemembered.mockResolvedValue(status({ revision: 2, state: 'connected' }));
      setup({ list: [alpha, bravo, charlie] });
      await openMenu();
      expect(screen.getByTestId('source-entry-a')).toHaveFocus();
      await userEvent.keyboard('c');
      expect(screen.getByTestId('source-entry-a')).toHaveFocus();
      await userEvent.keyboard('{ArrowDown}');
      expect(screen.getByTestId('source-entry-c')).toHaveFocus();
      await userEvent.keyboard('{Enter}');
      expect(apiMock.connectRemembered).toHaveBeenCalledWith('c');
    });

    it('closes with Escape and returns focus to the source button', async () => {
      setup({ list: [alpha] });
      await openMenu();
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByTestId('source-menu')).not.toBeInTheDocument();
      expect(button()).toHaveFocus();
    });

    it('keeps open while Tab moves between its controls', async () => {
      setup({ list: [alpha] });
      await openMenu();
      expect(screen.getByTestId('source-entry-a')).toHaveFocus();
      await userEvent.tab();
      expect(screen.getByTestId('source-edit')).toHaveFocus();
      await userEvent.tab();
      expect(screen.getByTestId('source-forget')).toHaveFocus();
      expect(screen.getByTestId('source-menu')).toBeInTheDocument();
    });

    it('closes without moving focus back to the button when Tab leaves past the last control', async () => {
      setup({ list: [alpha] });
      await openMenu();
      screen.getByTestId('source-add').focus();
      await userEvent.tab();
      expect(screen.queryByTestId('source-menu')).not.toBeInTheDocument();
      expect(button()).not.toHaveFocus();
      expect(button()).toHaveAttribute('aria-expanded', 'false');
    });

    it('closes when Shift+Tab leaves before the first control; focus goes to the previous control in order', async () => {
      setup({ list: [alpha] });
      await openMenu();
      await userEvent.tab({ shift: true });
      expect(screen.queryByTestId('source-menu')).not.toBeInTheDocument();
      expect(button()).toHaveFocus(); // the trigger is the previous control; it is not "returned to"
    });

    it('closes on a click outside', async () => {
      setup({ list: [alpha] });
      await openMenu();
      await userEvent.click(document.body);
      expect(screen.queryByTestId('source-menu')).not.toBeInTheDocument();
    });

    it('reaches the row actions with ArrowRight/ArrowLeft', async () => {
      setup({ list: [alpha] });
      await openMenu();
      expect(screen.getByTestId('source-entry-a')).toHaveFocus();
      await userEvent.keyboard('{ArrowRight}');
      expect(screen.getByTestId('source-edit')).toHaveFocus();
      await userEvent.keyboard('{ArrowRight}');
      expect(screen.getByTestId('source-forget')).toHaveFocus();
      await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
      expect(screen.getByTestId('source-entry-a')).toHaveFocus();
    });
  });

  describe('forget and edit', () => {
    it('forgets with Delete, shows the toast and restores with Undo', async () => {
      apiMock.forgetSource.mockResolvedValue({ sources: [charlie], activeId: null });
      apiMock.restoreSource.mockResolvedValue({ sources: [alpha, charlie], activeId: null });
      setup({ list: [alpha, charlie] });
      await openMenu();
      // DESIGN 9.6: the polite region exists before anything is announced; the toast goes into it.
      const live = screen.getByTestId('source-forgot-live');
      expect(live).toHaveAttribute('role', 'status');
      expect(live).toHaveAttribute('aria-live', 'polite');
      expect(screen.queryByTestId('source-forgot-toast')).not.toBeInTheDocument();
      await userEvent.keyboard('{Delete}');
      expect(apiMock.forgetSource).toHaveBeenCalledWith('a');
      const toast = await screen.findByTestId('source-forgot-toast');
      expect(live).toContainElement(toast);
      expect(toast).toHaveTextContent('Forgot "Alpha".');
      expect(screen.queryByTestId('source-entry-a')).not.toBeInTheDocument();
      expect(screen.getByTestId('source-undo')).toHaveFocus();
      await userEvent.click(screen.getByTestId('source-undo'));
      expect(apiMock.restoreSource).toHaveBeenCalledWith(alpha);
      expect(await screen.findByTestId('source-entry-a')).toBeInTheDocument();
      expect(screen.queryByTestId('source-forgot-toast')).not.toBeInTheDocument();
    });

    it('forgets with the Forget button and the toast expires after 5 s', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        apiMock.forgetSource.mockResolvedValue({ sources: [], activeId: null });
        setup({ list: [alpha] });
        await openMenu();
        await userEvent.click(screen.getByTestId('source-forget'));
        expect(await screen.findByTestId('source-forgot-toast')).toBeInTheDocument();
        act(() => {
          vi.advanceTimersByTime(5100);
        });
        expect(screen.queryByTestId('source-forgot-toast')).not.toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it('keeps focus in the menu after Forget then Undo, and Escape returns to the button', async () => {
      apiMock.forgetSource.mockResolvedValue({ sources: [charlie], activeId: null });
      apiMock.restoreSource.mockResolvedValue({ sources: [alpha, charlie], activeId: null });
      setup({ list: [alpha, charlie] });
      await openMenu();
      await userEvent.keyboard('{Delete}');
      await userEvent.click(await screen.findByTestId('source-undo'));
      await waitFor(() => expect(screen.getByTestId('source-entry-a')).toHaveFocus());
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByTestId('source-menu')).not.toBeInTheDocument();
      expect(button()).toHaveFocus();
    });

    it('keeps focus in the menu when the toast expires, and Escape closes it', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        apiMock.forgetSource.mockResolvedValue({ sources: [charlie], activeId: null });
        setup({ list: [alpha, charlie] });
        await openMenu();
        await userEvent.keyboard('{Delete}');
        expect(await screen.findByTestId('source-undo')).toHaveFocus();
        act(() => {
          vi.advanceTimersByTime(5100);
        });
        expect(screen.queryByTestId('source-forgot-toast')).not.toBeInTheDocument();
        expect(menu().contains(document.activeElement)).toBe(true);
        await userEvent.keyboard('{Escape}');
        expect(screen.queryByTestId('source-menu')).not.toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it('restores focus to the row when the only row is forgotten and then undone', async () => {
      apiMock.forgetSource.mockResolvedValue({ sources: [], activeId: null });
      apiMock.restoreSource.mockResolvedValue({ sources: [alpha], activeId: null });
      setup({ list: [alpha] });
      await openMenu();
      await userEvent.keyboard('{Delete}');
      await userEvent.click(await screen.findByTestId('source-undo'));
      await waitFor(() => expect(screen.getByTestId('source-entry-a')).toHaveFocus());
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByTestId('source-menu')).not.toBeInTheDocument();
    });

    it('opens the Edit dialog with F2 and with the pencil, and never renames inline', async () => {
      setup({ list: [alpha] });
      await openMenu();
      await userEvent.keyboard('{F2}');
      expect(screen.getByTestId('dialog-stub')).toHaveAttribute('data-mode', 'edit');
      expect(screen.getByTestId('dialog-stub')).toHaveAttribute('data-name', 'Alpha');
      expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument();
      expect(screen.queryByTestId('source-menu')).not.toBeInTheDocument(); // the dialog replaces the popover

      await userEvent.click(screen.getByTestId('dialog-cancel'));
      expect(screen.queryByTestId('dialog-stub')).not.toBeInTheDocument();
      expect(screen.queryByTestId('source-menu')).not.toBeInTheDocument();
      expect(button()).toHaveFocus(); // Cancel closes the menu and returns focus to the button

      await openMenu();
      await userEvent.click(screen.getByTestId('source-edit'));
      expect(screen.getByTestId('dialog-stub')).toHaveAttribute('data-mode', 'edit');
    });

    it('opens Edit for a detected device with only a pencil action', async () => {
      apiMock.discoverAll.mockResolvedValue([
        { driverId: 'sa430', devices: [sa430Device(SA430_SERIAL, '/dev/ttyACM3')], error: null },
      ]);
      setup({ drivers: [...baseDrivers, sa430Driver] });
      await openMenu();
      const row = (await screen.findByTestId(`source-detected-sa430-${SA430_SERIAL}`)).closest(
        'li',
      ) as HTMLElement;
      expect(within(row).queryByTestId('source-forget')).not.toBeInTheDocument();
      expect(within(row).getByRole('button', { name: `Edit SA430 ${SA430_SERIAL}` })).toBe(
        within(row).getByTestId('source-edit'),
      );
      await userEvent.click(within(row).getByTestId('source-edit'));
      expect(screen.getByTestId('dialog-stub')).toHaveAttribute('data-mode', 'edit-detected');
    });

    it('Add source… opens the dialog; saving re-opens the menu on the saved row, highlighted for 3 s', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        apiMock.discoverAll.mockResolvedValue([]);
        setup({ list: [alpha] });
        await openMenu();
        await userEvent.click(screen.getByTestId('source-add'));
        expect(screen.getByTestId('dialog-stub')).toHaveAttribute('data-mode', 'add');
        const scans = apiMock.discoverAll.mock.calls.length;
        // saving adds the entry to the store, then closes the dialog
        act(() => {
          useSources.setState({ list: [alpha, charlie] });
        });
        await userEvent.click(screen.getByTestId('dialog-save-charlie'));
        const row = screen.getByTestId('source-entry-c');
        expect(row).toHaveAttribute('data-highlight');
        await waitFor(() => expect(row).toHaveFocus());
        expect(screen.getByTestId('source-menu')).toBeVisible();
        expect(apiMock.discoverAll.mock.calls.length).toBeGreaterThanOrEqual(scans);
        act(() => {
          vi.advanceTimersByTime(3100);
        });
        expect(screen.getByTestId('source-entry-c')).not.toHaveAttribute('data-highlight');
      } finally {
        vi.useRealTimers();
      }
    });

    it('Escape from the dialog goes back to the source button; a forget from it shows Undo', async () => {
      setup({ list: [alpha] });
      await openMenu();
      await userEvent.click(screen.getByTestId('source-add'));
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByTestId('dialog-stub')).not.toBeInTheDocument();
      expect(button()).toHaveFocus();

      apiMock.forgetSource.mockResolvedValue({ sources: [], activeId: null });
      await openMenu();
      await userEvent.click(screen.getByTestId('source-edit'));
      await act(async () => {
        await useSources.getState().forget('a');
      });
      await userEvent.click(screen.getByTestId('dialog-forgot'));
      expect(screen.getByTestId('source-forgot-toast')).toHaveTextContent('Forgot "Alpha".');
      expect(screen.getByTestId('source-undo')).toHaveFocus();
    });
  });

  describe('row structure', () => {
    const OTHER_SERIAL = 'B7C100A2E9D41F05';
    const present = savedSource({
      id: 'p',
      name: 'Bench SA430',
      config: {
        ...emptyConfig('sa430'),
        deviceId: SA430_SERIAL,
        connection: { port: '/dev/ttyACM0' },
      },
    });
    const absent = savedSource({
      id: 'x',
      name: 'RTL-SDR Blog V4 0000000000000000000000000000000000000001 and more',
      config: {
        ...emptyConfig('sa430'),
        deviceId: OTHER_SERIAL,
        connection: { port: '/dev/ttyUSB0' },
      },
    });
    const sim = savedSource({ id: 's', name: 'Signal simulator' });
    const drivers = [simulatorDriver, sa430Driver];
    const list = [present, absent, sim];

    const scan = (devices = [sa430Device(SA430_SERIAL, '/dev/ttyACM0')]) =>
      apiMock.discoverAll.mockResolvedValue([{ driverId: 'sa430', devices, error: null }]);

    /** One status dot, a badge in the name row's third column, the status line, and an Edit action. */
    function expectStructure(
      testId: string,
      expected: { status: string; badge: string; line2: string },
    ) {
      const id = testId.replace(/^source-/, '');
      const dot = screen.getByTestId(`source-status-${id}`);
      expect(dot).toHaveAttribute('data-status', expected.status);
      expect(dot).toHaveAttribute('aria-hidden', 'true');
      expect(screen.getByTestId(`source-badge-${id}`)).toHaveTextContent(expected.badge);
      expect(screen.getByTestId(`source-sub-${id}`).textContent).toBe(expected.line2);
      const row = screen.getByTestId(testId).closest<HTMLElement>('[data-list-row]')!;
      expect(within(row).getByTestId('source-edit')).toHaveAttribute(
        'aria-label',
        expect.stringMatching(/^Edit /),
      );
    }

    it('gives remembered rows one glyph, badge and line 2 each, with the status text of the table', async () => {
      scan();
      setup({ list, drivers });
      await openMenu();
      await screen.findByText('Not detected');
      expectStructure('source-entry-p', { status: 'idle', badge: 'USB', line2: '/dev/ttyACM0' });
      expectStructure('source-entry-x', {
        status: 'absent',
        badge: 'USB',
        line2: 'Not detected·/dev/ttyUSB0',
      });
      expectStructure('source-entry-s', { status: 'idle', badge: 'Built-in', line2: '' });
      for (const id of ['p', 'x', 's']) {
        const row = screen
          .getByTestId(`source-entry-${id}`)
          .closest<HTMLElement>('[data-list-row]')!;
        expect(
          [...row.querySelectorAll<HTMLElement>('[data-row-action]')].map((e) =>
            e.getAttribute('data-row-action'),
          ),
        ).toEqual(['edit', 'forget']);
      }
      expect(screen.getByTestId('source-entry-x')).toHaveClass('dimmed');
    });

    it('shows New for a detected device and a glyph + badge for the fixed simulator item', async () => {
      scan([sa430Device(OTHER_SERIAL, '/dev/ttyACM5')]);
      setup({ drivers });
      await openMenu();
      await screen.findByTestId(`source-detected-sa430-${OTHER_SERIAL}`);
      expectStructure(`source-detected-sa430-${OTHER_SERIAL}`, {
        status: 'idle',
        badge: 'USB',
        line2: 'New·/dev/ttyACM5',
      });
      expect(screen.getByTestId('source-status-simulator')).toHaveAttribute('data-status', 'idle');
      expect(screen.getByTestId('source-badge-simulator')).toHaveTextContent('Built-in');
    });

    it.each([
      ['connected', 'Connected·/dev/ttyACM0', 'connected'],
      ['acquiring', 'Acquiring·/dev/ttyACM0', 'acquiring'],
      ['connecting', 'Connecting…·/dev/ttyACM0', 'connecting'],
    ] as const)('the active row is %s', async (state, line2, glyph) => {
      scan();
      setup({ list, drivers, activeId: 'p' });
      act(() =>
        useSession
          .getState()
          .receiveStatus(
            status({ revision: 4, state, source: { ...activeSimulator, config: present.config } }),
          ),
      );
      await openMenu();
      expectStructure('source-entry-p', { status: glyph, badge: 'USB', line2 });
      expect(screen.getByTestId('source-entry-p')).toHaveAttribute('aria-current', 'true');
      // the source button wears the same glyph
      expect(screen.getByTestId('source-button-status')).toHaveAttribute('data-status', glyph);
    });

    it('a failed row shows the cross and Failed with its port', async () => {
      scan();
      setup({ list, drivers });
      act(() => useSources.setState({ failed: 'source-entry-p' }));
      await openMenu();
      expectStructure('source-entry-p', {
        status: 'failed',
        badge: 'USB',
        line2: 'Failed·/dev/ttyACM0',
      });
    });

    it('a row marked failed shows its connected status while the backend is connected', async () => {
      scan();
      setup({ list, drivers, activeId: 'p' });
      act(() => useSources.setState({ failed: 'source-entry-p' }));
      act(() =>
        useSession.setState({
          status: status({
            revision: 4,
            state: 'connected',
            source: { ...activeSimulator, config: present.config },
          }),
        }),
      );
      await openMenu();
      expectStructure('source-entry-p', {
        status: 'connected',
        badge: 'USB',
        line2: 'Connected·/dev/ttyACM0',
      });
    });

    it('keeps the actions in the DOM and the layout classes the same on hover and focus', async () => {
      scan();
      setup({ list, drivers });
      await openMenu();
      const item = screen.getByTestId('source-entry-p');
      const snapshot = () => item.closest('li')!.innerHTML.replace(/ data-highlight=""/g, '');
      const before = snapshot();
      await userEvent.hover(item);
      expect(snapshot()).toBe(before);
      await userEvent.keyboard('{ArrowRight}');
      expect(screen.getAllByTestId('source-edit')[0]).toHaveFocus();
      expect(snapshot()).toBe(before);
    });

    it('is one row per device: a renamed device replugged on another port keeps its name', async () => {
      apiMock.discoverAll.mockResolvedValue([
        {
          driverId: 'sa430',
          devices: [sa430Device(SA430_SERIAL, '/dev/ttyACM7')],
          error: null,
        },
      ]);
      setup({ list: [present], drivers });
      await openMenu();
      await waitFor(() =>
        expect(screen.getByTestId('source-sub-entry-p')).toHaveTextContent('/dev/ttyACM7'),
      );
      expect(screen.getByTestId('source-entry-p')).toHaveAttribute('aria-label', 'Bench SA430');
      expect(screen.queryByTestId(`source-detected-sa430-${SA430_SERIAL}`)).not.toBeInTheDocument();
      const labels = [...menu().querySelectorAll('[data-list-item]')].map((e) =>
        e.getAttribute('aria-label'),
      );
      expect(new Set(labels).size).toBe(labels.length);
      expect(labels).not.toContain(`SA430 ${SA430_SERIAL}`);
    });
  });

  describe('inline form', () => {
    const sdrDriver: DriverInfo = {
      ...networkDriver,
      id: 'sdr',
      name: 'Net SDR',
      transport: 'usb',
      supportsDiscovery: true,
    };
    const sdrDevice = {
      driverId: 'sdr',
      deviceId: 'sdr-1',
      label: 'Net SDR 1',
      location: null,
      details: [] as [string, string][],
    };
    const openForm = async () => {
      apiMock.discoverAll.mockResolvedValue([
        { driverId: 'sdr', devices: [sdrDevice], error: null },
      ]);
      setup({ drivers: [...baseDrivers, sdrDriver] });
      await openMenu();
      await userEvent.click(await screen.findByTestId('source-detected-sdr-sdr-1'));
      return screen.getByTestId('source-form');
    };

    it('a detected device missing a required parameter opens the form; Connect needs it', async () => {
      apiMock.connectSource.mockResolvedValue(status({ revision: 2, state: 'connected' }));
      const form = await openForm();
      expect(within(form).getByText('Net SDR')).toBeInTheDocument();
      const host = within(form).getByLabelText(/Host/);
      expect(host).toHaveAttribute('id', 'conn-sdr-host');
      expect(host).toHaveFocus();
      expect(within(form).queryByLabelText('Port')).not.toBeInTheDocument(); // optional: behind Show more
      expect(screen.getByTestId('source-form-connect')).toBeDisabled();
      await userEvent.type(host, '192.168.1.20{Enter}');
      expect(apiMock.connectSource).toHaveBeenCalledWith(
        expect.objectContaining({
          driverId: 'sdr',
          deviceId: 'sdr-1',
          connection: { host: '192.168.1.20' },
        }),
      );
      await waitFor(() => expect(screen.queryByTestId('source-menu')).not.toBeInTheDocument());
    });

    it('Show more reveals optional fields', async () => {
      await openForm();
      await userEvent.click(screen.getByRole('button', { name: 'Show more' }));
      expect(screen.getByLabelText('Port')).toHaveAttribute('id', 'conn-sdr-port');
    });

    it('keeps the form open with the backend error on failure and allows editing', async () => {
      apiMock.connectSource.mockRejectedValue({ message: 'Connection refused.' });
      await openForm();
      await userEvent.type(screen.getByLabelText(/Host/), 'nowhere');
      await userEvent.click(screen.getByTestId('source-form-connect'));
      const error = await screen.findByTestId('source-form-error');
      expect(screen.getByRole('status')).toContainElement(error);
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
      expect(error).toHaveTextContent('Connection failed: Connection refused.');
      expect(screen.getByLabelText(/Host/)).toBeEnabled();
      expect(useSession.getState().status?.state).toBe('disconnected');
    });

    it('shows Connecting… with disabled fields while the connect is pending', async () => {
      apiMock.connectSource.mockReturnValue(new Promise(() => undefined));
      await openForm();
      await userEvent.type(screen.getByLabelText(/Host/), 'h{Enter}');
      expect(screen.getByTestId('source-form-connect')).toHaveTextContent('Connecting…');
      expect(screen.getByLabelText(/Host/)).toBeDisabled();
      await userEvent.keyboard('{Escape}');
      expect(screen.getByTestId('source-form')).toBeInTheDocument(); // Escape does not cancel a connect
    });

    it('Back and Escape return to the list; Cancel closes the menu', async () => {
      await openForm();
      await userEvent.click(screen.getByTestId('source-form-back'));
      expect(screen.getByTestId('source-simulator')).toBeInTheDocument();
      await userEvent.click(screen.getByTestId('source-detected-sdr-sdr-1'));
      await userEvent.keyboard('{Escape}');
      expect(screen.getByTestId('source-simulator')).toBeInTheDocument();
      await userEvent.click(screen.getByTestId('source-detected-sdr-sdr-1'));
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByTestId('source-menu')).not.toBeInTheDocument();
    });

    it('hides Add source… when no driver qualifies', async () => {
      setup({ drivers: [simulatorDriver, plannedDriver] });
      await openMenu();
      expect(screen.queryByTestId('source-add')).not.toBeInTheDocument();
    });
  });
});
