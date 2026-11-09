import '../../test/mockApi';

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';

import type { SavedSource } from '../../bindings/SavedSource';
import { useSession } from '../../state/session';
import { useSources } from '../../state/sources';
import {
  OTHER_SA430_SERIAL,
  SA430_SERIAL,
  sa430Device,
  sa430Driver,
  savedSource,
  simulatorDriver,
  status,
} from '../../test/fixtures';
import { apiMock, fakeBackend } from '../../test/mockApi';
import { SourceDialog, type DialogTarget } from './SourceDialog';

const bench: SavedSource = savedSource({
  id: 'bench',
  name: 'Bench SA430',
  label: `SA430 ${SA430_SERIAL}`,
  config: {
    driverId: 'sa430',
    deviceId: SA430_SERIAL,
    connection: { port: '/dev/ttyACM0' },
    settings: { centerHz: null, spanHz: null, params: {} },
  },
});
const spare: SavedSource = savedSource({
  id: 'spare',
  name: 'Spare',
  label: `SA430 ${OTHER_SA430_SERIAL}`,
  config: {
    driverId: 'sa430',
    deviceId: OTHER_SA430_SERIAL,
    connection: { port: '/dev/ttyACM5' },
    settings: { centerHz: null, spanHz: null, params: {} },
  },
});
const sim: SavedSource = savedSource({ id: 'sim', name: 'Sim', label: 'Signal simulator' });

const onClose = vi.fn();

/** Mounts the dialog the way the menu does: an opener button that must get focus back. */
function Harness({ target }: { target: DialogTarget }) {
  const [open, setOpen] = useState(true);
  const opener = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={opener} data-testid="opener">
        opener
      </button>
      {open && (
        <SourceDialog
          target={target}
          returnFocusTo={opener}
          onClose={(r) => {
            onClose(r);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function setup(
  target: DialogTarget,
  {
    list = [bench, spare],
    activeId = null,
  }: { list?: SavedSource[]; activeId?: string | null } = {},
) {
  fakeBackend.reset(list, activeId);
  fakeBackend.install();
  useSources.setState({
    list,
    activeId,
    drivers: [simulatorDriver, sa430Driver],
    error: null,
  });
  return render(<Harness target={target} />);
}

const name = () => screen.getByTestId('add-source-name');
const save = () => screen.getByTestId('add-source-save');
const port = () => screen.getByLabelText('Serial port');
const result = () => screen.getByTestId('add-source-test-result');
const typeInto = async (el: HTMLElement, text: string) => {
  await userEvent.clear(el);
  if (text) await userEvent.type(el, text);
};
const test = () => userEvent.click(screen.getByTestId('add-source-test'));

describe('SourceDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSession.setState({ status: status({ state: 'disconnected' }), busy: null });
  });

  describe('add', () => {
    it('opens empty with focus in Name, Save disabled, driver list and helper', () => {
      setup({ mode: 'add' });
      const dlg = screen.getByRole('dialog', { name: 'Add source' });
      expect(dlg).toHaveAttribute('aria-modal', 'true');
      expect(name()).toHaveValue('');
      expect(name()).toHaveFocus();
      expect(screen.getByTestId('add-source-driver')).toBeEnabled();
      expect(screen.getByRole('option', { name: 'SA430 spectrum analyzer' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: /simulator/i })).not.toBeInTheDocument();
      expect(dlg).toHaveTextContent('Only sources that need manual setup are listed.');
      expect(save()).toBeDisabled();
      expect(screen.queryByTestId('edit-source-forget')).not.toBeInTheDocument();
      expect(result()).toHaveTextContent(/^Not tested\./);
      expect(result()).toHaveAttribute('role', 'status');
    });

    it('enables Save once the name and port are valid and saves untested', async () => {
      setup({ mode: 'add' });
      await userEvent.type(name(), 'Lab SA430');
      expect(save()).toBeDisabled();
      await userEvent.type(port(), '/dev/ttyACM9');
      expect(save()).toBeEnabled();
      await userEvent.click(save());
      expect(apiMock.addSource).toHaveBeenCalledWith('Lab SA430', {
        driverId: 'sa430',
        deviceId: null,
        connection: { port: '/dev/ttyACM9' },
        settings: { centerHz: null, spanHz: null, params: {} },
      });
      expect(onClose).toHaveBeenCalledWith({
        saved: expect.objectContaining({ name: 'Lab SA430' }) as SavedSource,
        forgotten: false,
      });
      expect(apiMock.connectSource).not.toHaveBeenCalled();
      expect(apiMock.connectRemembered).not.toHaveBeenCalled();
    });

    it('validates the name: required, length and duplicates (case-insensitive)', async () => {
      setup({ mode: 'add' });
      await userEvent.type(port(), '/dev/ttyACM9');
      await userEvent.type(name(), 'x');
      await userEvent.clear(name());
      expect(screen.getByText('Enter a name.')).toBeInTheDocument();
      expect(name()).toHaveAttribute('aria-invalid', 'true');
      await typeInto(name(), 'bench sa430');
      expect(screen.getByText('A source with this name already exists.')).toBeInTheDocument();
      expect(save()).toBeDisabled();
      await typeInto(name(), 'x'.repeat(61));
      expect(screen.getByText('At most 60 characters.')).toBeInTheDocument();
      await typeInto(name(), 'Fresh');
      expect(screen.queryByText(/already exists/)).not.toBeInTheDocument();
      expect(save()).toBeEnabled();
    });

    it('pre-fills a blank name after a successful test and never overwrites typed text', async () => {
      setup({ mode: 'add' });
      await userEvent.type(port(), '/dev/ttyACM0');
      await test();
      await waitFor(() => expect(result()).toHaveTextContent('Connection OK.'));
      expect(name()).toHaveValue(`SA430 ${SA430_SERIAL}`);
      expect(result()).toHaveTextContent(`Serial number ${SA430_SERIAL}`);
      expect(result()).not.toHaveTextContent('matches');

      await typeInto(name(), 'Mine');
      await typeInto(port(), '/dev/ttyACM1');
      await test();
      await waitFor(() => expect(result()).toHaveTextContent('Connection OK.'));
      expect(name()).toHaveValue('Mine');
    });

    it('saves with the tested serial', async () => {
      setup({ mode: 'add' }, { list: [] });
      await userEvent.type(port(), '/dev/ttyACM0');
      await test();
      await waitFor(() => expect(result()).toHaveTextContent('Connection OK.'));
      await userEvent.click(save());
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(apiMock.addSource).toHaveBeenCalledWith(
        `SA430 ${SA430_SERIAL}`,
        expect.objectContaining({ deviceId: SA430_SERIAL }),
      );
    });

    it('shows a failed test verbatim and still allows saving', async () => {
      setup({ mode: 'add' });
      await userEvent.type(name(), 'Offline');
      await userEvent.type(port(), '/dev/ttyUSB9');
      await test();
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(
        'Test failed: Could not open /dev/ttyUSB9: No such file or directory (os error 2)',
      );
      expect(alert).toBe(result());
      expect(screen.getByText('You can still save an untested source.')).toBeInTheDocument();
      expect(save()).toBeEnabled();
    });

    it('editing a parameter resets the test to idle', async () => {
      setup({ mode: 'add' });
      await userEvent.type(port(), '/dev/ttyACM0');
      await test();
      await waitFor(() => expect(result()).toHaveTextContent('Connection OK.'));
      await userEvent.type(port(), '1');
      expect(result()).toHaveTextContent(/^Not tested\./);
    });

    it('discards a test that finishes after the parameter changed', async () => {
      setup({ mode: 'add' });
      let finish: (r: Awaited<ReturnType<typeof apiMock.testSource>>) => void = () => undefined;
      apiMock.testSource.mockImplementationOnce(() => new Promise((res) => (finish = res)));
      await userEvent.type(port(), '/dev/ttyACM0');
      await test();
      expect(result()).toHaveTextContent('Testing connection…');
      expect(screen.getByTestId('add-source-test')).toBeDisabled();
      await userEvent.type(port(), '1');
      await act(async () => {
        finish({ ok: true, message: 'late', deviceId: 'X', label: null, inUse: false });
        await Promise.resolve();
      });
      expect(result()).toHaveTextContent(/^Not tested\./);
    });

    it('keeps the dialog open and shows the backend error when add fails', async () => {
      setup({ mode: 'add' });
      apiMock.addSource.mockRejectedValueOnce(
        new Error('That name is already used by another source.'),
      );
      await userEvent.type(name(), 'Another');
      await userEvent.type(port(), '/dev/ttyACM9');
      await userEvent.click(save());
      const err = await screen.findByTestId('add-source-error');
      expect(err).toHaveTextContent('That name is already used by another source.');
      expect(err).toHaveAttribute('role', 'alert');
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('edit remembered', () => {
    it('prefills, locks the driver and selects the name', () => {
      setup({ mode: 'edit', entry: bench });
      expect(screen.getByRole('dialog', { name: 'Edit source' })).toBeInTheDocument();
      expect(name()).toHaveValue('Bench SA430');
      expect(name()).toHaveFocus();
      expect((name() as HTMLInputElement).selectionEnd).toBe('Bench SA430'.length);
      expect((name() as HTMLInputElement).selectionStart).toBe(0);
      expect(screen.getByTestId('add-source-driver')).toBeDisabled();
      expect(screen.getByTestId('add-source-driver')).toHaveValue('sa430');
      expect(screen.getByRole('dialog')).toHaveTextContent('The driver cannot be changed.');
      expect(port()).toHaveValue('/dev/ttyACM0');
      expect(screen.getByTestId('edit-source-forget')).toBeInTheDocument();
      expect(save()).toBeEnabled();
    });

    it('renames only, keeping the stored identity', async () => {
      setup({ mode: 'edit', entry: bench });
      await typeInto(name(), 'Renamed');
      await userEvent.click(save());
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(apiMock.updateSource).toHaveBeenCalledWith('bench', {
        name: 'Renamed',
        deviceId: null,
        connection: { port: '/dev/ttyACM0' },
      });
      expect(apiMock.addSource).not.toHaveBeenCalled();
    });

    it('allows keeping its own name (uniqueness excludes itself)', async () => {
      setup({ mode: 'edit', entry: bench });
      await userEvent.type(name(), '!');
      await userEvent.type(name(), '{Backspace}');
      expect(screen.queryByText(/already exists/)).not.toBeInTheDocument();
      expect(save()).toBeEnabled();
    });

    it('a port change without a test sends the port and keeps the identity', async () => {
      setup({ mode: 'edit', entry: bench });
      await typeInto(port(), '/dev/ttyACM3');
      await userEvent.click(save());
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(apiMock.updateSource).toHaveBeenCalledWith('bench', {
        name: 'Bench SA430',
        deviceId: null,
        connection: { port: '/dev/ttyACM3' },
      });
    });

    it('same serial after a port change: matches note, identity kept', async () => {
      setup({ mode: 'edit', entry: bench });
      await typeInto(port(), '/dev/ttyACM1');
      await test();
      await waitFor(() =>
        expect(result()).toHaveTextContent(`Serial number ${SA430_SERIAL} (matches this source)`),
      );
      expect(screen.queryByText(/Different device/)).not.toBeInTheDocument();
      await userEvent.click(save());
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(apiMock.updateSource).toHaveBeenCalledWith(
        'bench',
        expect.objectContaining({ deviceId: null, connection: { port: '/dev/ttyACM1' } }),
      );
    });

    it('a different free serial shows the amber re-bind note and sends the new deviceId', async () => {
      setup({ mode: 'edit', entry: bench }, { list: [bench] });
      await typeInto(port(), '/dev/ttyACM2');
      await test();
      const note = await screen.findByText(/^⚠ Different device:/);
      expect(note).toHaveTextContent(
        `Different device: serial ${OTHER_SA430_SERIAL}, this source is ${SA430_SERIAL}. ` +
          `Saving binds this source to serial ${OTHER_SA430_SERIAL}; its name and settings are kept.`,
      );
      expect(note).toHaveAttribute('role', 'alert');
      expect(save()).toBeEnabled();
      await userEvent.click(save());
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(apiMock.updateSource).toHaveBeenCalledWith('bench', {
        name: 'Bench SA430',
        deviceId: OTHER_SA430_SERIAL,
        connection: { port: '/dev/ttyACM2' },
      });
    });

    it('a serial owned by another record disables Save', async () => {
      setup({ mode: 'edit', entry: bench });
      await typeInto(port(), '/dev/ttyACM2');
      await test();
      const note = await screen.findByText(/already in Your sources as/);
      expect(note).toHaveTextContent('This device is already in Your sources as "Spare".');
      expect(note).toHaveAttribute('role', 'alert');
      expect(save()).toBeDisabled();
    });

    it('shows the in-use message from the backend and still allows Save', async () => {
      fakeBackend.reset([bench, spare], 'bench');
      setup({ mode: 'edit', entry: spare }, { list: [bench, spare], activeId: 'bench' });
      fakeBackend.session = { state: 'connected', active: bench.config };
      await typeInto(port(), '/dev/ttyACM0');
      await test();
      await waitFor(() =>
        expect(result()).toHaveTextContent(
          'Test failed: /dev/ttyACM0 is in use by the active source. Stop and disconnect it first.',
        ),
      );
      expect(save()).toBeEnabled();
    });

    it('keeps the dialog open with the backend error from updateSource', async () => {
      setup({ mode: 'edit', entry: bench });
      apiMock.updateSource.mockRejectedValueOnce('Disk full');
      await userEvent.click(save());
      expect(await screen.findByTestId('add-source-error')).toHaveTextContent('Disk full');
      expect(onClose).not.toHaveBeenCalled();
      expect(save()).toBeEnabled();
      expect(name()).toHaveFocus();
    });

    it('Forget calls forget and reports forgotten', async () => {
      setup({ mode: 'edit', entry: bench });
      await userEvent.click(screen.getByTestId('edit-source-forget'));
      await waitFor(() => expect(onClose).toHaveBeenCalledWith({ saved: null, forgotten: true }));
      expect(apiMock.forgetSource).toHaveBeenCalledWith('bench');
      expect(apiMock.updateSource).not.toHaveBeenCalled();
    });
  });

  describe('edit detected', () => {
    it('shows the note, default name and port, no Forget; Save adds without connecting', async () => {
      setup(
        { mode: 'edit-detected', device: sa430Device(OTHER_SA430_SERIAL, '/dev/ttyACM2') },
        { list: [bench] },
      );
      const dlg = screen.getByRole('dialog', { name: 'Edit source' });
      expect(dlg).toHaveTextContent(
        'New device, not remembered yet. Save remembers it; it does not connect.',
      );
      expect(name()).toHaveValue(`SA430 ${OTHER_SA430_SERIAL}`);
      expect(port()).toHaveValue('/dev/ttyACM2');
      expect(screen.queryByTestId('edit-source-forget')).not.toBeInTheDocument();
      await userEvent.click(save());
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(apiMock.addSource).toHaveBeenCalledWith(
        `SA430 ${OTHER_SA430_SERIAL}`,
        expect.objectContaining({
          driverId: 'sa430',
          deviceId: OTHER_SA430_SERIAL,
          connection: { port: '/dev/ttyACM2' },
        }),
      );
      expect(apiMock.updateSource).not.toHaveBeenCalled();
      expect(apiMock.connectSource).not.toHaveBeenCalled();
    });
  });

  describe('simulator entries', () => {
    it('simulator: note, locked driver, no fields, no Test, renames only', async () => {
      setup({ mode: 'edit', entry: sim }, { list: [sim] });
      expect(screen.getByRole('dialog')).toHaveTextContent(
        'The simulator has no settings; only its name can be changed.',
      );
      expect(screen.getByTestId('add-source-driver')).toBeDisabled();
      expect(
        screen.getByRole('option', { name: 'Signal simulator (built-in)' }),
      ).toBeInTheDocument();
      expect(screen.queryByTestId('add-source-test')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Fail to connect')).not.toBeInTheDocument();
      await typeInto(name(), 'Demo');
      await userEvent.click(save());
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(apiMock.updateSource).toHaveBeenCalledWith('sim', {
        name: 'Demo',
        deviceId: null,
        connection: {},
      });
    });
  });

  describe('connected lock', () => {
    it('locks parameters and driver, hides Test and renames only', async () => {
      useSession.setState({ status: status({ state: 'connected' }), busy: null });
      setup({ mode: 'edit', entry: bench }, { activeId: 'bench' });
      useSession.setState({ status: status({ state: 'connected' }) });
      expect(await screen.findByLabelText('Serial port')).toBeDisabled();
      expect(screen.getByTestId('add-source-driver')).toBeDisabled();
      expect(screen.queryByTestId('add-source-test')).not.toBeInTheDocument();
      const dlg = screen.getByRole('dialog');
      expect(dlg).toHaveTextContent(
        'In use by the active connection. Disconnect to change the port.',
      );
      expect(dlg).toHaveTextContent(
        'This source is connected. The name changes now; connection settings are locked until you disconnect.',
      );
      expect(screen.getByTestId('edit-source-forget')).toBeEnabled();
      await typeInto(name(), 'Live');
      await userEvent.click(save());
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(apiMock.updateSource).toHaveBeenCalledWith('bench', {
        name: 'Live',
        deviceId: null,
        connection: { port: '/dev/ttyACM0' },
      });
    });

    it('is not locked for another entry while a different source is connected', () => {
      setup({ mode: 'edit', entry: spare }, { activeId: 'bench' });
      useSession.setState({ status: status({ state: 'connected' }) });
      expect(port()).toBeEnabled();
      expect(screen.getByTestId('add-source-test')).toBeInTheDocument();
    });
  });

  describe('keyboard and focus', () => {
    it('Tab cycles through the controls and stays inside the dialog', async () => {
      setup({ mode: 'edit', entry: bench });
      const order = [
        'add-source-name',
        null, // Serial port has no test id
        'add-source-test',
        'edit-source-forget',
        'add-source-cancel',
        'add-source-save',
        'add-source-name', // wraps
      ];
      for (const id of order) {
        if (id === 'add-source-name' && document.activeElement === name()) {
          // first stop: already focused
          if (order.indexOf(id) === 0) continue;
        }
        await userEvent.tab();
        if (id) expect(screen.getByTestId(id)).toHaveFocus();
        else expect(port()).toHaveFocus();
      }
      await userEvent.tab({ shift: true });
      expect(screen.getByTestId('add-source-save')).toHaveFocus();
    });

    it('skips locked fields', async () => {
      useSession.setState({ status: status({ state: 'acquiring' }) });
      setup({ mode: 'edit', entry: bench }, { activeId: 'bench' });
      await userEvent.tab();
      expect(screen.getByTestId('edit-source-forget')).toHaveFocus();
    });

    it('Escape cancels without saving and returns focus to the opener', async () => {
      setup({ mode: 'edit', entry: bench });
      await typeInto(name(), 'Changed');
      await userEvent.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalledWith({ saved: null, forgotten: false });
      expect(apiMock.updateSource).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByTestId('opener')).toHaveFocus();
    });

    it('Cancel returns focus to the opener', async () => {
      setup({ mode: 'add' });
      await userEvent.click(screen.getByTestId('add-source-cancel'));
      expect(screen.getByTestId('opener')).toHaveFocus();
    });

    it('focus that escapes is pulled back into the dialog', () => {
      setup({ mode: 'add' });
      act(() => screen.getByTestId('opener').focus());
      expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
    });

    it('Enter in a text field saves when enabled and does nothing when not', async () => {
      setup({ mode: 'add' });
      await userEvent.type(name(), 'Quick{Enter}');
      expect(apiMock.addSource).not.toHaveBeenCalled();
      await userEvent.type(port(), '/dev/ttyACM9{Enter}');
      await waitFor(() => expect(apiMock.addSource).toHaveBeenCalledTimes(1));
    });

    it('closing while a test runs discards it and does not throw', async () => {
      setup({ mode: 'add' });
      apiMock.testSource.mockImplementationOnce(() => new Promise(() => undefined));
      await userEvent.type(port(), '/dev/ttyACM0');
      await test();
      await userEvent.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalledWith({ saved: null, forgotten: false });
    });
  });
});
