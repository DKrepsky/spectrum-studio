import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';

import type { DriverInfo } from '../../bindings/DriverInfo';
import type { ParamValue } from '../../bindings/ParamValue';
import type { SavedSource } from '../../bindings/SavedSource';
import { SIMULATOR_CONFIG, useSession } from '../../state/session';
import {
  TRANSPORT_LABEL,
  configKey,
  dialogDrivers,
  menuModel,
  rowKey,
  rowTitle,
  type DetectedRow,
  type YourRow,
} from '../../state/sourceEntries';
import { useSources } from '../../state/sources';
import { SourceDialog, type DialogTarget } from './SourceDialog';
import { SourceForm } from './SourceForm';
import { STATUS_TEXT, StatusGlyph, activeStatus, type EntryStatus } from './status';
import { menuItems, useMenuKeys } from './useMenuKeys';

type View =
  | { kind: 'list' }
  | {
      kind: 'form';
      driver: DriverInfo;
      deviceId: string | null;
      title?: string;
      initial: Partial<Record<string, ParamValue>>;
    };

interface Props {
  buttonRef: RefObject<HTMLElement | null>;
  /** Closes the menu; `refocus` returns focus to the source button. */
  onClose: (refocus: boolean) => void;
}

const HIGHLIGHT_MS = 3000;

function tooltip(title: string, driver: DriverInfo | undefined, details: [string, string][]) {
  return [title, driver?.name, ...details.map(([k, v]) => `${k}: ${v}`)].filter(Boolean).join('\n');
}

function connectionDetails(entry: SavedSource): [string, string][] {
  const out: [string, string][] = [];
  if (entry.config.deviceId) out.push(['Device', entry.config.deviceId]);
  for (const [k, v] of Object.entries(entry.config.connection)) {
    if (typeof v === 'string' || typeof v === 'number') out.push([k, String(v)]);
  }
  return out;
}

/** The popover behind the source button: remembered sources, detected devices, fixed actions, inline form. */
export function SourceMenu({ buttonRef, onClose }: Props) {
  const list = useSources((s) => s.list);
  const active = useSources((s) => s.active);
  const discovery = useSources((s) => s.discovery);
  const failed = useSources((s) => s.failed);
  const forgotten = useSources((s) => s.forgotten);
  const drivers = useSources((s) => s.drivers);
  const state = useSession((s) => s.status?.state ?? 'disconnected');
  const lost = useSession(
    (s) => s.status?.lastNotice?.kind === 'deviceLost' && s.status.state === 'disconnected',
  );
  const busy = useSession((s) => s.busy);

  const [view, setView] = useState<View>({ kind: 'list' });
  const [dialog, setDialog] = useState<DialogTarget | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const popover = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const transitioning = state === 'connecting' || state === 'disconnecting' || busy !== null;
  const activeId = active?.id ?? null;
  const model = useMemo(
    () => menuModel(list, discovery, drivers, activeId),
    [list, discovery, drivers, activeId],
  );
  const canAdd = useMemo(() => dialogDrivers(drivers).length > 0, [drivers]);
  const driverOf = (id: string) => drivers.find((d) => d.id === id);

  // Scan only while the menu is shown (not while the Add/Edit dialog covers it).
  const dialogOpen = dialog !== null;
  useEffect(() => (dialogOpen ? undefined : useSources.getState().startScanning()), [dialogOpen]);

  // The saved row stays highlighted for 3 s after the dialog closes.
  useEffect(() => {
    if (highlight === null) return;
    const timer = setTimeout(() => setHighlight(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlight]);

  // Close on a press outside the menu and the source button (the dialog has its own backdrop).
  useEffect(() => {
    if (dialogOpen) return;
    const onDown = (e: MouseEvent) => {
      const node = e.target as Node;
      if (popover.current?.contains(node) || buttonRef.current?.contains(node)) return;
      onClose(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [buttonRef, onClose, dialogOpen]);

  // Focus: the active source (else the first enabled item) when the list is shown.
  useLayoutEffect(() => {
    if (view.kind === 'form' || dialogOpen) return;
    const items = menuItems(menu.current);
    const target = items.find((el) => el.getAttribute('aria-checked') === 'true') ?? items[0];
    (target ?? menu.current)?.focus();
  }, [view.kind, dialogOpen]);

  // Focus must stay in the menu when its focused element disappears (Forget moves it to Undo;
  // Undo or the toast expiring then removes that button): go to the restored
  // row, else the first remaining item, else the menu itself.
  const restoreFocus = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (view.kind !== 'list' || dialogOpen) return;
    const root = popover.current;
    if (!root) return;
    const pending = restoreFocus.current;
    if (pending) {
      const row = root.querySelector<HTMLElement>(`[data-testid="source-entry-${pending}"]`);
      if (row) {
        restoreFocus.current = null;
        row.focus();
        return;
      }
    }
    if (root.contains(document.activeElement)) return;
    if (forgotten) {
      root.querySelector<HTMLElement>('[data-testid="source-undo"]')?.focus();
    } else {
      (menuItems(menu.current)[0] ?? menu.current)?.focus();
    }
  }, [forgotten, list, view.kind, dialogOpen]);

  const close = useCallback(() => onClose(true), [onClose]);
  const onKeyDown = useMenuKeys({ container: menu, onEscape: close, onTab: close });

  const pick = (fn: () => Promise<unknown>) => {
    if (transitioning) return;
    onClose(true);
    void fn();
  };

  const onDialogClose = (result: { saved: SavedSource | null; forgotten: boolean }) => {
    setDialog(null);
    if (result.saved) {
      restoreFocus.current = result.saved.id;
      setHighlight(rowKey(result.saved));
    } else if (!result.forgotten) {
      onClose(true); // cancelled: the menu closes and focus returns to the source button
    }
  };

  const connectDetected = (row: DetectedRow) => {
    const driver = driverOf(row.device.driverId);
    if (!driver) return;
    const config = {
      driverId: driver.id,
      deviceId: row.device.deviceId,
      connection: {},
      settings: { centerHz: null, spanHz: null, params: {} },
    };
    if (driver.connectionParams.some((p) => p.required)) {
      setView({
        kind: 'form',
        driver,
        deviceId: config.deviceId,
        title: row.title,
        initial: {},
      });
    } else {
      pick(() => useSession.getState().connectTo({ type: 'config', config, title: row.title }));
    }
  };

  const noDeviceHint = (driver: DriverInfo) =>
    driver.supportsDiscovery &&
    !model.detected.some((d) => d.device.driverId === driver.id) &&
    !model.yours.some((y) => y.entry.config.driverId === driver.id && y.presence === 'present');

  const entryStatus = (row: YourRow): EntryStatus => {
    if (failed === row.key) return 'failed';
    if (row.active) return activeStatus(state, busy, false, lost);
    return row.presence === 'absent' ? 'absent' : 'idle';
  };

  const detectedStatus = (row: DetectedRow): EntryStatus => {
    if (failed === row.key) return 'failed';
    if (active?.id == null && active && configKey(active.config) === row.key) {
      const s = activeStatus(state, busy, false, false);
      return s === 'idle' ? 'idle' : s;
    }
    return 'idle';
  };

  const back = () => setView({ kind: 'list' });

  if (view.kind === 'form') {
    const form = view;
    return (
      <div className="source-popover" ref={popover} data-testid="source-menu">
        <SourceForm
          key={form.driver.id}
          driver={form.driver}
          deviceId={form.deviceId}
          title={form.title}
          initial={form.initial}
          noDeviceHint={noDeviceHint(form.driver)}
          onBack={back}
          onCancel={close}
          onConnected={() => onClose(true)}
        />
      </div>
    );
  }

  const scanLines = (
    <>
      {discovery.scanning && model.detected.length === 0 && (
        <div className="source-note" role="presentation">
          <span className="spinner" aria-hidden /> Scanning for devices…
        </div>
      )}
      {!discovery.scanning &&
        discovery.scanned &&
        model.detected.length === 0 &&
        model.scanErrors.length === 0 &&
        discovery.error == null && (
          <div className="source-note" role="presentation">
            No new devices found. Plug one in; this list updates automatically.
          </div>
        )}
      {model.scanErrors.map((e) => (
        <div className="source-note" role="presentation" key={e.driverId}>
          {`Could not scan for devices: ${e.error}`}
        </div>
      ))}
      {discovery.error != null && (
        <div className="source-note" role="presentation">
          {`Could not scan for devices: ${discovery.error}`}
        </div>
      )}
    </>
  );
  const connectedNow = state === 'connected' || state === 'acquiring';
  const forgottenAt = forgotten
    ? model.yours.filter((r) => r.entry.lastUsedMs > forgotten.lastUsedMs).length
    : 0;

  const toast = forgotten && (
    <div className="source-toast" role="status" data-testid="source-forgot-toast" key="toast">
      <span className="src-name">{`Forgot "${rowTitle(forgotten, drivers)}".`}</span>
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        data-menu-item
        data-label="Undo"
        data-testid="source-undo"
        onClick={() => {
          restoreFocus.current = forgotten.id;
          void useSources.getState().undoForget();
        }}
      >
        Undo
      </button>
    </div>
  );

  const rows: ReactNode[] = model.yours.map((row) => (
    <SourceRow
      key={row.key}
      testId={row.key}
      radio
      checked={row.active}
      label={row.title}
      tip={tooltip(row.title, driverOf(row.entry.config.driverId), connectionDetails(row.entry))}
      status={entryStatus(row)}
      badge={TRANSPORT_LABEL[row.transport]}
      detail={row.port}
      highlight={highlight === row.key}
      disabled={transitioning}
      onPick={() =>
        pick(() => useSession.getState().connectTo({ type: 'remembered', id: row.entry.id }))
      }
      onEdit={() => setDialog({ mode: 'edit', entry: row.entry })}
      onForget={() => {
        restoreFocus.current = null;
        void useSources.getState().forget(row.entry.id);
      }}
    />
  ));
  const shownRows = toast
    ? [...rows.slice(0, forgottenAt), toast, ...rows.slice(forgottenAt)]
    : rows;

  return (
    <>
      <div className="source-popover" ref={popover} data-testid="source-menu" hidden={dialogOpen}>
        <div
          className="source-menu"
          role="menu"
          aria-label="Sources"
          tabIndex={-1}
          ref={menu}
          onKeyDown={(e: KeyboardEvent<HTMLElement>) => onKeyDown(e)}
        >
          {(model.yours.length > 0 || forgotten) && (
            <div role="group" aria-label="Your sources">
              <div className="source-heading" role="presentation">
                Your sources
              </div>
              <div className="source-yours" role="none">
                {shownRows}
              </div>
            </div>
          )}
          <div role="group" aria-label="Detected devices">
            <div className="source-heading" role="presentation">
              Detected devices
            </div>
            {model.detected.map((row) => (
              <SourceRow
                key={row.key}
                testId={`source-detected-${row.device.driverId}-${row.device.deviceId}`}
                label={row.title}
                tip={tooltip(row.title, driverOf(row.device.driverId), row.device.details)}
                status={detectedStatus(row)}
                isNew
                badge={TRANSPORT_LABEL[row.transport]}
                detail={row.port}
                disabled={transitioning}
                onPick={() => connectDetected(row)}
                onEdit={() => setDialog({ mode: 'edit-detected', device: row.device })}
              />
            ))}
            {scanLines}
          </div>
          <div role="group" aria-label="Add a source" className="source-fixed">
            {model.simulatorInFixedBlock && (
              <FixedItem
                testId="source-simulator"
                label={driverOf('simulator')?.name ?? 'Signal simulator'}
                disabled={transitioning}
                status="idle"
                badge={TRANSPORT_LABEL[driverOf('simulator')?.transport ?? 'internal']}
                onClick={() =>
                  pick(() =>
                    useSession.getState().connectTo({
                      type: 'config',
                      config: SIMULATOR_CONFIG,
                      title: driverOf('simulator')?.name,
                    }),
                  )
                }
              />
            )}
            {canAdd && (
              <FixedItem
                testId="source-add"
                label="Add source…"
                disabled={transitioning}
                onClick={() => setDialog({ mode: 'add' })}
              />
            )}
          </div>
          {state !== 'disconnected' && (
            <div role="group" aria-label="Connection" className="source-fixed">
              <FixedItem
                testId="source-disconnect"
                label="Disconnect"
                disabled={!connectedNow || transitioning}
                onClick={() => pick(() => useSession.getState().disconnect())}
              />
            </div>
          )}
        </div>
      </div>
      {dialog && <SourceDialog target={dialog} onClose={onDialogClose} returnFocusTo={buttonRef} />}
    </>
  );
}

interface FixedProps {
  testId: string;
  label: string;
  badge?: string;
  status?: EntryStatus;
  disabled?: boolean;
  onClick: () => void;
}

/** A single-line menu item: the fixed simulator entry, Add source…, Disconnect. */
function FixedItem({ testId, label, badge, status, disabled, onClick }: FixedProps) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      className="source-item single"
      data-menu-item
      data-label={label}
      data-testid={testId}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled) onClick();
      }}
    >
      {status ? <StatusGlyph status={status} /> : <span className="src-dot" aria-hidden="true" />}
      <span className="src-name">{label}</span>
      {badge && <span className="badge src-badge">{badge}</span>}
    </button>
  );
}

const TONE: Partial<Record<EntryStatus, string>> = {
  connected: 'ok',
  acquiring: 'ok',
  failed: 'bad',
  connecting: 'busy',
  disconnecting: 'busy',
};

interface RowProps {
  testId: string;
  label: string;
  tip: string;
  status: EntryStatus;
  badge: string;
  /** Port shown on line 2. */
  detail: string | null;
  /** Detected but not remembered: line 2 starts with `New` while nothing else applies. */
  isNew?: boolean;
  /** Remembered rows are radio items; the `checked` one is the active source. */
  radio?: boolean;
  checked?: boolean;
  highlight?: boolean;
  disabled: boolean;
  onPick: () => void;
  onEdit: () => void;
  /** Absent for detected rows: they are not remembered, so there is nothing to forget. */
  onForget?: () => void;
}

/**
 * A two-line source row. Line 1: glyph | name | badge; line 2: status text and port.
 * The actions sit in the badge column of line 2 and are always in the DOM (hidden by CSS until
 * hover or focus), so showing them changes no layout.
 */
function SourceRow({
  testId,
  label,
  tip,
  status,
  badge,
  detail,
  isNew,
  radio,
  checked,
  highlight,
  disabled,
  onPick,
  onEdit,
  onForget,
}: RowProps) {
  const text = STATUS_TEXT[status] ?? (isNew ? 'New' : null);
  return (
    <div className="source-row" role="none" data-menu-row>
      <button
        type="button"
        role={radio ? 'menuitemradio' : 'menuitem'}
        aria-checked={radio ? checked : undefined}
        aria-disabled={disabled || undefined}
        tabIndex={-1}
        className={`source-item${status === 'absent' ? ' dimmed' : ''}`}
        data-menu-item
        data-label={label}
        data-testid={testId}
        data-highlight={highlight || undefined}
        title={tip}
        onClick={() => {
          if (!disabled) onPick();
        }}
      >
        <StatusGlyph status={status} />
        <span className="src-name">{label}</span>
        <span className="badge src-badge">{badge}</span>
        <span className="row-sub">
          {text && <span className={`st ${TONE[status] ?? ''}`}>{text}</span>}
          {text && detail && (
            <span className="sep" aria-hidden="true">
              ·
            </span>
          )}
          {detail && (
            <span className="detail" title={detail}>
              {detail}
            </span>
          )}
        </span>
      </button>
      <span className="source-actions" role="none">
        <button
          type="button"
          role="menuitem"
          tabIndex={-1}
          className="icon"
          data-menu-action="edit"
          data-testid="source-edit"
          aria-label={`Edit ${label}`}
          title="Edit (F2)"
          onClick={onEdit}
        >
          ✎
        </button>
        {onForget && (
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="icon"
            data-menu-action="forget"
            data-testid="source-forget"
            aria-label={`Forget ${label}`}
            title="Forget (Delete)"
            onClick={onForget}
          >
            ×
          </button>
        )}
      </span>
    </div>
  );
}
