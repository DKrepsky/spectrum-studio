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
import { Button } from '../../ui/Button';
import { Dialog, DialogFooter } from '../../ui/Dialog';
import { Field, Select, TextField, type SelectOption } from '../../ui/Field';
import { InlineMessage } from '../../ui/InlineMessage';
import { Spinner } from '../../ui/Spinner';
import './SourceDialog.css';

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

  const formId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const testToken = useRef(0);
  const savingRef = useRef(false);

  const locked = entry != null && isActiveBusy(sessionState, busy, activeId, entry.id);
  const noParams = driver?.transport === 'internal';
  const editableParams = !noParams && specs.length > 0;
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

  // The Dialog focuses the name field on open (`initialFocus`); Edit also selects its text.
  useEffect(() => {
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
    if (!canSave || !driver || savingRef.current) return;
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

  const shownNameError = nameTouched && nameError != null ? nameError : undefined;
  const driverOptions = adding ? addable : driver ? [driver] : [];
  const driverLabel = (d: DriverInfo) =>
    !adding && d.transport === 'internal' ? `${d.name} (built-in)` : d.name;
  const driverChoices: SelectOption[] = driverOptions.map((d) => ({
    value: d.id,
    label: driverLabel(d),
  }));
  if (driver == null) driverChoices.push({ value: driverId, label: driverId });

  // The test result box is always mounted; it is the polite live region of the test (DESIGN.md 9.6).
  const testResult = () => {
    if (test.st === 'idle')
      return (
        <div
          className="source-test-result source-test-result--idle"
          role="status"
          data-testid="add-source-test-result"
        >
          {IDLE_TEXT}
        </div>
      );
    if (test.st === 'run')
      return (
        <div
          className="source-test-result source-test-result--run"
          role="status"
          data-testid="add-source-test-result"
        >
          <Spinner label="Testing connection…" />
        </div>
      );
    if (!test.result.ok)
      return (
        <div
          className="source-test-result source-test-result--fail"
          role="status"
          data-testid="add-source-test-result"
        >
          ✕ Test failed: {test.result.message}
        </div>
      );
    return (
      <div
        className="source-test-result source-test-result--ok"
        role="status"
        data-testid="add-source-test-result"
      >
        ✓ {test.result.message}
        {testedSerial && (
          <span className="source-test-result__sub">
            Serial number {testedSerial}
            {matches ? ' (matches this source)' : ''}
          </span>
        )}
      </div>
    );
  };

  return (
    <Dialog
      title={adding ? 'Add source' : 'Edit source'}
      onClose={cancel}
      returnFocusTo={returnFocusTo}
      initialFocus={nameRef}
      onSubmit={(e) => void save(e)}
      testId="add-source-dialog"
      titleTestId="dialog-title"
    >
      <Field
        label="Name"
        className="source-field"
        error={shownNameError}
        errorTestId="dialog-error"
      >
        {(c) => (
          <TextField
            ref={nameRef}
            id={c.id}
            aria-describedby={c.describedBy}
            invalid={c.invalid}
            value={name}
            placeholder="e.g. Bench SA430"
            spellCheck={false}
            autoComplete="off"
            data-testid="add-source-name"
            onChange={(value) => {
              setName(value);
              setNameTouched(true);
              setSaveError(null);
            }}
          />
        )}
      </Field>

      <Field
        label="Driver"
        className={adding ? 'source-field' : 'source-field source-locked'}
        hint={
          adding
            ? 'Only sources that need manual setup are listed. USB devices that are detected automatically do not need this.'
            : 'The driver cannot be changed. To use another, forget this source and add a new one.'
        }
      >
        {(c) => (
          <Select
            id={c.id}
            aria-describedby={c.describedBy}
            label="Driver"
            value={driverId}
            options={driverChoices}
            disabled={!adding || saving}
            data-testid="add-source-driver"
            onChange={changeDriver}
          />
        )}
      </Field>

      {editableParams && (
        <div className={locked ? 'dialog-params source-locked' : 'dialog-params'}>
          <ParamForm
            idPrefix={`${formId}-p`}
            specs={specs}
            values={values}
            disabled={paramsDisabled}
            onChange={changeValue}
            framed={false}
          />
          {(locked || specs.some((p) => p.help)) && (
            <InlineMessage variant="hint">
              {locked
                ? 'In use by the active connection. Disconnect to change the port.'
                : specs
                    .map((p) => p.help)
                    .filter(Boolean)
                    .join(' ')}
            </InlineMessage>
          )}
        </div>
      )}
      {noParams && (
        <InlineMessage variant="hint">
          The simulator has no settings; only its name can be changed.
        </InlineMessage>
      )}

      {canTest && (
        <div className="source-test">
          <Button
            busy={test.st === 'run'}
            disabled={!paramsValid || saving}
            data-testid="add-source-test"
            onClick={() => void runTest()}
          >
            Test connection
          </Button>
          {testResult()}
        </div>
      )}

      {/* One always-mounted polite container for the notes and the save error (DESIGN.md 9.6). The
          messages inside carry no role of their own. */}
      <div role="status" className="dialog-notes" data-testid="dialog-notes">
        {detected && (
          <InlineMessage variant="info" data-testid="dialog-note-info">
            New device, not remembered yet. Save remembers it; it does not connect.
          </InlineMessage>
        )}
        {locked && (
          <InlineMessage variant="info" data-testid="dialog-note-info">
            This source is connected. The name changes now; connection settings are locked until you
            disconnect.
          </InlineMessage>
        )}
        {owner && (
          <InlineMessage variant="warn" data-testid="dialog-note-warn">
            This device is already in Your sources as &quot;{rowTitle(owner, drivers)}&quot;.
          </InlineMessage>
        )}
        {mismatch && (
          <InlineMessage variant="warn" data-testid="dialog-note-warn">
            Different device: serial {testedSerial}, this source is {storedSerial}. Saving binds
            this source to serial {testedSerial}; its name and settings are kept.
          </InlineMessage>
        )}
        {canTest && result && !result.ok && (
          <InlineMessage variant="note" data-testid="dialog-note-note">
            You can still save an untested source.
          </InlineMessage>
        )}
        {saveError && (
          <InlineMessage variant="error" data-testid="dialog-error">
            {saveError}
          </InlineMessage>
        )}
      </div>

      <DialogFooter
        start={
          entry ? (
            <Button
              variant="destructive"
              disabled={saving}
              data-testid="edit-source-forget"
              onClick={() => void forget()}
            >
              Forget
            </Button>
          ) : null
        }
      >
        <Button disabled={saving} data-testid="add-source-cancel" onClick={cancel}>
          Cancel
        </Button>
        {/* Busy keeps focus (native disabled would drop it in WebKit); an invalid form is inert but focusable. */}
        <Button
          type="submit"
          variant="primary"
          busy={saving}
          unavailable={!canSave && !saving}
          data-testid="add-source-save"
        >
          Save
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
