import {
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
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { InlineMessage } from '../../ui/InlineMessage';
import { ListRow, Popover, PopoverGroup, listItems } from '../../ui/Popover';
import { Spinner } from '../../ui/Spinner';
import { StatusDot } from '../../ui/StatusDot';
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
import { STATUS_TEXT, activeStatus, type EntryStatus } from './status';

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
  /** Closes the popover; `refocus` returns focus to the source button (Escape). */
  onClose: (refocus: boolean) => void;
}

const HIGHLIGHT_MS = 3000;

const TONE: Partial<Record<EntryStatus, string>> = {
  connected: 'ok',
  acquiring: 'ok',
  failed: 'bad',
  connecting: 'busy',
  disconnecting: 'busy',
};

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

/**
 * The popover behind the source button (DESIGN.md 4.11, 5.1): remembered sources, detected devices,
 * the fixed actions and the inline connect form. Its content is lists of buttons; the popover
 * itself is a non-modal dialog. The Add/Edit dialog replaces it while it is open.
 */
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
  const content = useRef<HTMLDivElement>(null);

  const transitioning = state === 'connecting' || state === 'disconnecting' || busy !== null;
  const activeId = active?.id ?? null;
  const model = useMemo(
    () => menuModel(list, discovery, drivers, activeId),
    [list, discovery, drivers, activeId],
  );
  const canAdd = useMemo(() => dialogDrivers(drivers).length > 0, [drivers]);
  const driverOf = (id: string) => drivers.find((d) => d.id === id);

  // Scan only while the list is shown (not while the Add/Edit dialog covers it).
  const dialogOpen = dialog !== null;
  useEffect(() => (dialogOpen ? undefined : useSources.getState().startScanning()), [dialogOpen]);

  // The saved row stays highlighted for 3 s after the dialog closes.
  useEffect(() => {
    if (highlight === null) return;
    const timer = setTimeout(() => setHighlight(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlight]);

  // Focus must stay in the list when its focused element disappears (Forget moves it to Undo;
  // Undo or the toast expiring then removes that button): go to the restored row, else the
  // first remaining item, else the list itself. Focus that is already inside the list stays.
  const restoreFocus = useRef<string | null>(null);
  // Set when the dialog forgot the source: the list comes back with focus on Undo.
  const undoFocus = useRef(false);
  useLayoutEffect(() => {
    if (view.kind !== 'list' || dialogOpen) return;
    const root = content.current;
    if (!root) return;
    const pending = restoreFocus.current;
    if (pending) {
      const row = root.querySelector<HTMLElement>(`[data-testid="${pending}"]`);
      if (row) {
        restoreFocus.current = null;
        row.focus();
        return;
      }
    }
    if (undoFocus.current) {
      undoFocus.current = false;
      root.querySelector<HTMLElement>('[data-testid="source-undo"]')?.focus();
      return;
    }
    if (root.contains(document.activeElement)) return;
    if (forgotten) {
      root.querySelector<HTMLElement>('[data-testid="source-undo"]')?.focus();
    } else {
      (listItems(root)[0] ?? root).focus();
    }
  }, [forgotten, list, view.kind, dialogOpen]);

  const pick = (fn: () => Promise<unknown>) => {
    if (transitioning) return;
    onClose(true);
    void fn();
  };

  const onDialogClose = (result: { saved: SavedSource | null; forgotten: boolean }) => {
    setDialog(null);
    if (result.saved) {
      restoreFocus.current = rowKey(result.saved);
      setHighlight(rowKey(result.saved));
    } else if (result.forgotten) {
      undoFocus.current = true;
    } else {
      onClose(true); // cancelled: the popover closes and focus returns to the source button
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

  /**
   * Row keys (DESIGN.md 5.10), on the list: F2 edits and Delete forgets the focused row; Left and
   * Right move between the row's select button and its actions. Everything else is the popover's.
   */
  const onRowKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.defaultPrevented) return;
    const target = e.target as HTMLElement;
    const item = target.closest<HTMLElement>('li');
    if (!item) return;
    if (e.key === 'F2' || e.key === 'Delete') {
      const action = item.querySelector<HTMLButtonElement>(
        `[data-row-action="${e.key === 'F2' ? 'edit' : 'forget'}"]`,
      );
      if (action) {
        e.preventDefault();
        action.click();
      }
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const actions = [...item.querySelectorAll<HTMLElement>('[data-row-action]')];
      if (actions.length === 0) return;
      const select = item.querySelector<HTMLElement>('[data-list-item]');
      const at = actions.indexOf(target);
      let next: HTMLElement | null | undefined;
      if (e.key === 'ArrowRight') next = at < 0 ? actions[0] : actions[at + 1];
      else next = at < 0 ? null : at === 0 ? select : actions[at - 1];
      if (next) {
        e.preventDefault();
        next.focus();
      }
    }
  };

  if (dialog) {
    return <SourceDialog target={dialog} onClose={onDialogClose} returnFocusTo={buttonRef} />;
  }

  const connectedNow = state === 'connected' || state === 'acquiring';

  if (view.kind === 'form') {
    const form = view;
    return (
      <Popover
        key="form"
        label="Sources"
        anchorRef={buttonRef}
        onClose={onClose}
        testId="source-menu"
      >
        <div ref={content} className="source-menu" tabIndex={-1} onKeyDown={onRowKeys}>
          <SourceForm
            key={form.driver.id}
            driver={form.driver}
            deviceId={form.deviceId}
            title={form.title}
            initial={form.initial}
            noDeviceHint={noDeviceHint(form.driver)}
            onBack={back}
            onCancel={() => onClose(true)}
            onConnected={() => onClose(true)}
          />
        </div>
      </Popover>
    );
  }

  const scanLines = (
    <div className="popover-note">
      {discovery.scanning && model.detected.length === 0 && (
        <InlineMessage variant="note">
          <Spinner label="Scanning for devices…" />
        </InlineMessage>
      )}
      {!discovery.scanning &&
        discovery.scanned &&
        model.detected.length === 0 &&
        model.scanErrors.length === 0 &&
        discovery.error == null && (
          <InlineMessage variant="note">
            No new devices found. Plug one in; this list updates automatically.
          </InlineMessage>
        )}
      {model.scanErrors.map((e) => (
        <InlineMessage variant="note" key={e.driverId}>
          {`Could not scan for devices: ${e.error}`}
        </InlineMessage>
      ))}
      {discovery.error != null && (
        <InlineMessage variant="note">{`Could not scan for devices: ${discovery.error}`}</InlineMessage>
      )}
    </div>
  );

  const forgottenAt = forgotten
    ? model.yours.filter((r) => r.entry.lastUsedMs > forgotten.lastUsedMs).length
    : 0;

  // DESIGN 9.6 rule 1: the polite live region is always mounted (in the list slot where the toast
  // appears, so it exists before anything is announced) and the toast is inserted into it.
  const toastSlot = (
    <li key="toast-slot">
      <div role="status" aria-live="polite" data-testid="source-forgot-live">
        {forgotten && (
          <div className="source-toast" data-testid="source-forgot-toast">
            <span className="source-toast-text">{`Forgot "${rowTitle(forgotten, drivers)}".`}</span>
            <Button
              size="small"
              data-testid="source-undo"
              onClick={() => {
                restoreFocus.current = rowKey(forgotten);
                void useSources.getState().undoForget();
              }}
            >
              Undo
            </Button>
          </div>
        )}
      </div>
    </li>
  );

  const rows: ReactNode[] = model.yours.map((row) => (
    <SourceRow
      key={row.key}
      testId={row.key}
      label={row.title}
      tip={tooltip(row.title, driverOf(row.entry.config.driverId), connectionDetails(row.entry))}
      status={entryStatus(row)}
      badge={TRANSPORT_LABEL[row.transport]}
      detail={row.port}
      current={row.active}
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
  const shownRows = [...rows.slice(0, forgottenAt), toastSlot, ...rows.slice(forgottenAt)];

  return (
    <Popover
      key="list"
      label="Sources"
      anchorRef={buttonRef}
      onClose={onClose}
      testId="source-menu"
    >
      <div ref={content} className="source-menu" tabIndex={-1} onKeyDown={onRowKeys}>
        {(model.yours.length > 0 || forgotten) && (
          <PopoverGroup label="Your sources">
            <ul className="popover-list">{shownRows}</ul>
          </PopoverGroup>
        )}
        <PopoverGroup label="Detected devices">
          <ul className="popover-list">
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
          </ul>
          {scanLines}
        </PopoverGroup>
        <div role="group" aria-label="Add a source" className="source-fixed">
          <ul className="popover-list">
            {model.simulatorInFixedBlock && (
              <FixedRow
                testId="source-simulator"
                label={driverOf('simulator')?.name ?? 'Signal simulator'}
                disabled={transitioning}
                status="idle"
                badge={TRANSPORT_LABEL[driverOf('simulator')?.transport ?? 'internal']}
                onSelect={() =>
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
              <FixedRow
                testId="source-add"
                label="Add source…"
                disabled={transitioning}
                onSelect={() => setDialog({ mode: 'add' })}
              />
            )}
          </ul>
        </div>
        {state !== 'disconnected' && (
          <div role="group" aria-label="Connection" className="source-fixed">
            <ul className="popover-list">
              <FixedRow
                testId="source-disconnect"
                label="Disconnect"
                disabled={!connectedNow || transitioning}
                onSelect={() => pick(() => useSession.getState().disconnect())}
              />
            </ul>
          </div>
        )}
      </div>
    </Popover>
  );
}

interface RowBodyProps {
  testId: string;
  label: string;
  status: EntryStatus;
  badge: string;
  /** Port shown on line 2. */
  detail: string | null;
  /** Detected but not remembered: line 2 starts with `New` while nothing else applies. */
  isNew?: boolean;
}

/** The content of a two-line row: glyph | name | badge on line 1; status word and port on line 2. */
function RowBody({ testId, label, status, badge, detail, isNew }: RowBodyProps) {
  const text = STATUS_TEXT[status] ?? (isNew ? 'New' : null);
  const part = (name: string) => `source-${name}-${testId.replace(/^source-/, '')}`;
  return (
    <span className="source-row">
      <StatusDot status={status} className="source-row-dot" data-testid={part('status')} />
      <span className="source-row-name" data-testid={part('name')}>
        {label}
      </span>
      <Badge variant="chip" className="source-row-badge" data-testid={part('badge')}>
        {badge}
      </Badge>
      <span className="source-row-sub" data-testid={part('sub')}>
        {text && <span className={`source-row-status ${TONE[status] ?? ''}`}>{text}</span>}
        {text && detail && (
          <span className="source-row-sep" aria-hidden="true">
            ·
          </span>
        )}
        {detail && (
          <span className="source-row-detail" title={detail}>
            {detail}
          </span>
        )}
      </span>
    </span>
  );
}

interface SourceRowProps {
  testId: string;
  label: string;
  tip: string;
  status: EntryStatus;
  badge: string;
  detail: string | null;
  /** Detected but not remembered. */
  isNew?: boolean;
  /** The active source (`aria-current`). */
  current?: boolean;
  highlight?: boolean;
  disabled: boolean;
  onPick: () => void;
  onEdit: () => void;
  /** Absent for detected rows: they are not remembered, so there is nothing to forget. */
  onForget?: () => void;
}

/** A remembered or detected source: a list item with its select button and Edit (and Forget) actions. */
function SourceRow({
  testId,
  label,
  tip,
  status,
  badge,
  detail,
  isNew,
  current,
  highlight,
  disabled,
  onPick,
  onEdit,
  onForget,
}: SourceRowProps) {
  const text = STATUS_TEXT[status] ?? (isNew ? 'New' : null);
  return (
    <li>
      <ListRow
        testId={testId}
        label={text ? `${label}, ${text}` : label}
        title={tip}
        current={current}
        dimmed={status === 'absent'}
        highlight={highlight}
        unavailable={disabled}
        onSelect={onPick}
        actions={
          <>
            <IconButton
              label={`Edit ${label}`}
              title="Edit (F2)"
              variant="filled"
              data-row-action="edit"
              data-testid="source-edit"
              onClick={onEdit}
            >
              ✎
            </IconButton>
            {onForget && (
              <IconButton
                label={`Forget ${label}`}
                title="Forget (Delete)"
                variant="filled"
                data-row-action="forget"
                data-testid="source-forget"
                onClick={onForget}
              >
                ×
              </IconButton>
            )}
          </>
        }
      >
        <RowBody
          testId={testId}
          label={label}
          status={status}
          badge={badge}
          detail={detail}
          isNew={isNew}
        />
      </ListRow>
    </li>
  );
}

interface FixedRowProps {
  testId: string;
  label: string;
  badge?: string;
  /** The simulator has a status dot; Add and Disconnect have none (the glyph column stays empty). */
  status?: EntryStatus;
  disabled: boolean;
  onSelect: () => void;
}

/** A one-line item of the fixed block: the simulator, Add source…, Disconnect. */
function FixedRow({ testId, label, badge, status, disabled, onSelect }: FixedRowProps) {
  return (
    <li>
      <ListRow
        size="single"
        testId={testId}
        label={label}
        unavailable={disabled}
        onSelect={onSelect}
      >
        <span className="source-row source-row-single">
          {status ? (
            <StatusDot
              status={status}
              className="source-row-dot"
              data-testid={`source-status-${testId.replace(/^source-/, '')}`}
            />
          ) : (
            <span className="source-row-glyph" aria-hidden="true" />
          )}
          <span className="source-row-name">{label}</span>
          {badge ? (
            <Badge
              variant="chip"
              className="source-row-badge"
              data-testid={`source-badge-${testId.replace(/^source-/, '')}`}
            >
              {badge}
            </Badge>
          ) : (
            <span className="source-row-badge" aria-hidden="true" />
          )}
        </span>
      </ListRow>
    </li>
  );
}
