/** Add / Edit source dialog: one component, three targets (see design 4). Never connects. */
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type SyntheticEvent,
} from 'react';
import { createPortal } from 'react-dom';

import type { DeviceDescriptor } from '../../bindings/DeviceDescriptor';
import type { DriverInfo } from '../../bindings/DriverInfo';
import type { ParamValue } from '../../bindings/ParamValue';
import type { SavedSource } from '../../bindings/SavedSource';
import type { SourceTestResult } from '../../bindings/SourceTestResult';
import { errorMessage } from '../../ipc/commands';
import { useSession } from '../../state/session';
import { toParamMap } from '../../state/sourceConfig';
import { defaultName, dialogDrivers, isActiveBusy, rowTitle } from '../../state/sourceEntries';
import { useSources } from '../../state/sources';
import { ParamForm } from '../ParamForm';
import { useFocusTrap } from './useFocusTrap';
import '../../styles/sourceDialog.css';

export type DialogTarget =
  | { mode: 'add' }
  | { mode: 'edit'; entry: SavedSource }
  | { mode: 'edit-detected'; device: DeviceDescriptor };

export interface SourceDialogProps {
  target: DialogTarget;
  /** The menu re-opens and highlights `saved`. */
  onClose: (result: { saved: SavedSource | null; forgotten: boolean }) => void;
  /** The source button, focused again on close. */
  returnFocusTo: RefObject<HTMLElement | null>;
}

type Values = Partial<Record<string, ParamValue>>;

type TestState = { st: 'idle' } | { st: 'run' } | { st: 'done'; result: SourceTestResult };

const NAME_MAX = 60;
const IDLE_TEXT =
  'Not tested. Test connection opens the port briefly and asks the device for its identity; your current source is not affected.';

const isEmpty = (v: ParamValue | undefined) => v === undefined || v === '';

/** Parameter that receives a detected device's `location` (its port). */
function locationParam(driver: DriverInfo | undefined): string | null {
  const specs = driver?.connectionParams ?? [];
  return (specs.find((p) => p.id === 'port') ?? specs[0])?.id ?? null;
}

export function SourceDialog({ target, onClose, returnFocusTo }: SourceDialogProps) {
  const drivers = useSources((s) => s.drivers);
  const list = useSources((s) => s.list);
  const activeId = useSources((s) => s.activeId);
  const sessionState = useSession((s) => s.status?.state);
  const busy = useSession((s) => s.busy);

  const entry = target.mode === 'edit' ? target.entry : null;
  const detected = target.mode === 'edit-detected' ? target.device : null;
  const adding = target.mode === 'add';

  const addable = useMemo(() => dialogDrivers(drivers), [drivers]);
  const [driverId, setDriverId] = useState<string>(
    () => entry?.config.driverId ?? detected?.driverId ?? addable[0]?.id ?? '',
  );
  const driver = drivers.find((d) => d.id === driverId);
  const specs = useMemo(() => driver?.connectionParams ?? [], [driver]);

  const [name, setName] = useState(() => {
    if (entry) return rowTitle(entry, drivers);
    if (detected) return defaultName(detected);
    return '';
  });
  const [nameTouched, setNameTouched] = useState(false);
  const [values, setValues] = useState<Values>(() => {
    if (entry) return { ...entry.config.connection };
    if (detected?.location) {
      const key = locationParam(drivers.find((d) => d.id === detected.driverId));
      return key ? { [key]: detected.location } : {};
    }
    return {};
  });
  const [test, setTest] = useState<TestState>({ st: 'idle' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const titleId = useId();
  const dialogRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const testToken = useRef(0);
  const savingRef = useRef(false);

  const locked = entry != null && isActiveBusy(sessionState, busy, activeId, entry.id);
  const fileLike = driver?.transport === 'file';
  const noParams = driver?.transport === 'internal';
  const editableParams = !fileLike && !noParams && specs.length > 0;
  const paramsDisabled = locked || saving;
  const canTest = editableParams && !locked;

  const effective = useCallback(
    (): Record<string, ParamValue> =>
      toParamMap(Object.fromEntries(specs.map((p) => [p.id, values[p.id] ?? p.default]))),
    [specs, values],
  );
  const paramsValid = !editableParams || specs.every((p) => !isEmpty(effective()[p.id]));

  // Name validation: trimmed, 1..60, unique case-insensitively among the other remembered sources.
  const trimmed = name.trim();
  const nameError =
    trimmed === ''
      ? 'Enter a name.'
      : Array.from(trimmed).length > NAME_MAX
        ? `At most ${NAME_MAX} characters.`
        : list.some(
              (e) =>
                e.id !== entry?.id &&
                rowTitle(e, drivers).trim().toLowerCase() === trimmed.toLowerCase(),
            )
          ? 'A source with this name already exists.'
          : null;

  // Identity re-resolution (design 4.2) from the last test.
  const result = test.st === 'done' ? test.result : null;
  const testedSerial = result?.ok && result.deviceId ? result.deviceId : null;
  const storedSerial = entry ? entry.config.deviceId : (detected?.deviceId ?? null);
  const owner =
    testedSerial != null
      ? list.find(
          (e) =>
            e.id !== entry?.id &&
            e.config.driverId === driverId &&
            e.config.deviceId === testedSerial,
        )
      : undefined;
  const matches = testedSerial != null && storedSerial != null && testedSerial === storedSerial;
  const mismatch =
    testedSerial != null && storedSerial != null && testedSerial !== storedSerial && !owner;

  const canSave = nameError == null && paramsValid && owner == null && !saving;

  useEffect(() => {
    nameRef.current?.focus();
    if (!adding) nameRef.current?.select();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, when the dialog opens
  }, []);
  useEffect(
    () => () => {
      testToken.current += 1; // closing discards a running probe
    },
    [],
  );

  const cancel = useCallback(() => {
    if (!savingRef.current) onClose({ saved: null, forgotten: false });
  }, [onClose]);
  useFocusTrap(dialogRef, { onEscape: cancel, returnFocusTo });

  const resetTest = () => {
    testToken.current += 1;
    setTest({ st: 'idle' });
  };

  const changeDriver = (id: string) => {
    setDriverId(id);
    setValues({});
    resetTest();
    setSaveError(null);
  };

  const changeValue = (id: string, value: ParamValue) => {
    setValues((v) => ({ ...v, [id]: value }));
    resetTest();
    setSaveError(null);
  };

  const runTest = async () => {
    if (!driver || !paramsValid || test.st === 'run') return;
    const token = ++testToken.current;
    setTest({ st: 'run' });
    let outcome: SourceTestResult;
    try {
      outcome = await useSources.getState().testSource(driver.id, effective());
    } catch (e) {
      outcome = { ok: false, message: errorMessage(e), deviceId: null, label: null, inUse: false };
    }
    if (token !== testToken.current) return; // edited or closed meanwhile
    setTest({ st: 'done', result: outcome });
    // A suggestion only: never overwrite what the user typed.
    if (adding && outcome.ok && name.trim() === '') {
      const suggestion =
        outcome.label?.trim() || (outcome.deviceId ? `${driver.name} ${outcome.deviceId}` : '');
      if (suggestion) setName(suggestion);
    }
  };

  const save = async (e: SyntheticEvent) => {
    e.preventDefault();
    setNameTouched(true);
    if (!canSave || !driver) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const store = useSources.getState();
      let saved: SavedSource;
      if (entry) {
        const keepConnection = locked || !editableParams;
        saved = await store.updateSource(entry.id, {
          name: trimmed,
          deviceId: !keepConnection && testedSerial != null && !matches ? testedSerial : null,
          connection: keepConnection ? { ...entry.config.connection } : effective(),
        });
      } else {
        saved = await store.addSource(trimmed, {
          driverId: driver.id,
          deviceId: testedSerial ?? detected?.deviceId ?? null,
          connection: effective(),
          settings: { centerHz: null, spanHz: null, params: {} },
        });
      }
      onClose({ saved, forgotten: false });
    } catch (err) {
      savingRef.current = false;
      setSaving(false);
      setSaveError(errorMessage(err));
      nameRef.current?.focus();
    }
  };

  const forget = async () => {
    if (!entry || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    await useSources.getState().forget(entry.id);
    onClose({ saved: null, forgotten: true });
  };

  const showNameError = nameTouched && nameError != null;
  const nameErrorId = `${titleId}-name-err`;
  const driverHelpId = `${titleId}-driver-help`;
  const driverOptions = adding ? addable : driver ? [driver] : [];
  const driverLabel = (d: DriverInfo) =>
    !adding && d.transport === 'internal' ? `${d.name} (built-in)` : d.name;
  const filePath = String(entry?.config.connection['path'] ?? '');

  const testResult = () => {
    if (test.st === 'idle')
      return (
        <div className="test-result idle" role="status" data-testid="add-source-test-result">
          {IDLE_TEXT}
        </div>
      );
    if (test.st === 'run')
      return (
        <div className="test-result run" role="status" data-testid="add-source-test-result">
          <span className="spinner" aria-hidden="true" /> Testing connection…
        </div>
      );
    if (!test.result.ok)
      return (
        <div className="test-result fail" role="alert" data-testid="add-source-test-result">
          ✕ Test failed: {test.result.message}
        </div>
      );
    return (
      <div className="test-result ok" role="status" data-testid="add-source-test-result">
        ✓ {test.result.message}
        {testedSerial && (
          <span className="sub">
            Serial number {testedSerial}
            {matches ? ' (matches this source)' : ''}
          </span>
        )}
      </div>
    );
  };

  const dialog = (
    <div className="dialog-backdrop">
      <form
        ref={dialogRef}
        className="source-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="add-source-dialog"
        noValidate
        onSubmit={(e) => void save(e)}
      >
        <h2 id={titleId}>{adding ? 'Add source' : 'Edit source'}</h2>

        <div className="form-row">
          <label htmlFor={`${titleId}-name`}>Name</label>
          <input
            ref={nameRef}
            id={`${titleId}-name`}
            type="text"
            value={name}
            placeholder="e.g. Bench SA430"
            spellCheck={false}
            autoComplete="off"
            aria-invalid={showNameError}
            aria-describedby={showNameError ? nameErrorId : undefined}
            data-testid="add-source-name"
            onChange={(e) => {
              setName(e.target.value);
              setNameTouched(true);
              setSaveError(null);
            }}
          />
          {showNameError && (
            <span className="err" id={nameErrorId}>
              {nameError}
            </span>
          )}
        </div>

        <div className="form-row">
          <label htmlFor={`${titleId}-driver`}>Driver</label>
          <select
            id={`${titleId}-driver`}
            className={adding ? undefined : 'locked'}
            value={driverId}
            disabled={!adding || saving}
            aria-describedby={driverHelpId}
            data-testid="add-source-driver"
            onChange={(e) => changeDriver(e.target.value)}
          >
            {driverOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {driverLabel(d)}
              </option>
            ))}
            {driver == null && <option value={driverId}>{driverId}</option>}
          </select>
          <span className="help" id={driverHelpId}>
            {adding
              ? 'Only sources that need manual setup are listed. USB devices that are detected automatically do not need this.'
              : 'The driver cannot be changed. To use another, forget this source and add a new one.'}
          </span>
        </div>

        {editableParams && (
          <div className={`dialog-params${locked ? ' locked' : ''}`}>
            <ParamForm
              idPrefix={`${titleId}-p`}
              specs={specs}
              values={values}
              disabled={paramsDisabled}
              onChange={changeValue}
            />
            {(locked || specs.some((p) => p.help)) && (
              <span className="help">
                {locked
                  ? 'In use by the active connection. Disconnect to change the port.'
                  : specs
                      .map((p) => p.help)
                      .filter(Boolean)
                      .join(' ')}
              </span>
            )}
          </div>
        )}
        {fileLike && (
          <div className="form-row">
            <label htmlFor={`${titleId}-file`}>File</label>
            <input
              id={`${titleId}-file`}
              className="ro"
              type="text"
              readOnly
              tabIndex={-1}
              value={filePath}
              title={filePath}
            />
            <span className="help">
              The file cannot be changed. To use another file, choose Open file….
            </span>
          </div>
        )}
        {noParams && (
          <span className="help">The simulator has no settings; only its name can be changed.</span>
        )}

        {canTest && (
          <div className="test-row">
            <button
              type="button"
              disabled={test.st === 'run' || !paramsValid || saving}
              data-testid="add-source-test"
              onClick={() => void runTest()}
            >
              Test connection
            </button>
            {testResult()}
          </div>
        )}

        {detected && (
          <div className="dlg-note info">
            New device, not remembered yet. Save remembers it; it does not connect.
          </div>
        )}
        {locked && (
          <div className="dlg-note info">
            This source is connected. The name changes now; connection settings are locked until you
            disconnect.
          </div>
        )}
        {owner && (
          <div className="dlg-note warn" role="alert">
            ⚠ This device is already in Your sources as &quot;{rowTitle(owner, drivers)}&quot;.
          </div>
        )}
        {mismatch && (
          <div className="dlg-note warn" role="alert">
            ⚠ Different device: serial {testedSerial}, this source is {storedSerial}. Saving binds
            this source to serial {testedSerial}; its name and settings are kept.
          </div>
        )}
        {canTest && result && !result.ok && (
          <div className="dlg-note">You can still save an untested source.</div>
        )}
        {saveError && (
          <p className="dlg-error" role="alert" data-testid="add-source-error">
            {saveError}
          </p>
        )}

        <div className="button-row">
          {entry && (
            <button
              type="button"
              className="forget"
              disabled={saving}
              data-testid="edit-source-forget"
              onClick={() => void forget()}
            >
              Forget
            </button>
          )}
          <span className="spacer" />
          <button type="button" disabled={saving} data-testid="add-source-cancel" onClick={cancel}>
            Cancel
          </button>
          <button
            type="submit"
            className="primary"
            disabled={!canSave}
            data-testid="add-source-save"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
  return createPortal(dialog, document.body);
}
