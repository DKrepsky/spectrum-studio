import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type SyntheticEvent,
  type KeyboardEvent,
} from 'react';

import type { DriverInfo } from '../../bindings/DriverInfo';
import type { ParamValue } from '../../bindings/ParamValue';
import { useSession } from '../../state/session';
import { toParamMap } from '../../state/sourceConfig';
import { splitConnectionParams } from '../../state/sourceEntries';
import { ParamForm } from '../ParamForm';

type Values = Partial<Record<string, ParamValue>>;

interface Props {
  driver: DriverInfo;
  deviceId: string | null;
  /** Display name for the entry being connected (a detected device's label). */
  title?: string | undefined;
  /** Prefilled connection values, e.g. a file chosen with "Open file…". */
  initial: Values;
  /** Show "No <driver> found…" (discovery-capable driver with nothing detected). */
  noDeviceHint: boolean;
  onBack: () => void;
  onCancel: () => void;
  /** Called after a successful connect. */
  onConnected: () => void;
}

const hasValue = (v: ParamValue | undefined) => v !== undefined && v !== '';

/** Inline connection form of the source menu; fields come from the driver's `connectionParams`. */
export function SourceForm({
  driver,
  deviceId,
  title,
  initial,
  noDeviceHint,
  onBack,
  onCancel,
  onConnected,
}: Props) {
  const busy = useSession((s) => s.busy);
  const [values, setValues] = useState<Values>(initial);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // Split once: fields must not jump between sections while the user types.
  const split = useMemo(
    () => splitConnectionParams(driver.connectionParams, initial),
    [driver.connectionParams, initial],
  );
  const connecting = busy === 'connecting';
  const valid = driver.connectionParams.every((p) => !p.required || hasValue(values[p.id]));

  useEffect(() => {
    // First required-but-empty field, else the first field, else Connect, so Escape always
    // reaches the form's key handler instead of the page body.
    const form = formRef.current;
    const fields = 'input:not(:disabled), select:not(:disabled)';
    const emptyRequired = driver.connectionParams.find(
      (p) => p.required && !hasValue(initial[p.id]),
    );
    const target =
      (emptyRequired &&
        form?.querySelector<HTMLElement>(`#conn-${driver.id}-${emptyRequired.id}`)) ||
      form?.querySelector<HTMLElement>(fields) ||
      form?.querySelector<HTMLElement>('[data-testid="source-form-connect"]');
    target?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, when the form opens
  }, []);

  const submit = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (!valid || busy !== null) return;
    setError(null);
    const ok = await useSession.getState().connectTo({
      type: 'config',
      title,
      config: {
        driverId: driver.id,
        deviceId,
        connection: toParamMap(values),
        settings: { centerHz: null, spanHz: null, params: {} },
      },
    });
    if (ok) onConnected();
    else setError(useSession.getState().commandError ?? 'Unknown error.');
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    if (!connecting) onBack();
  };

  const section = (specs: typeof split.primary, prefix: string) =>
    specs.length > 0 && (
      <ParamForm
        idPrefix={prefix}
        specs={specs}
        values={values}
        disabled={connecting}
        onChange={(id, value) => setValues((v) => ({ ...v, [id]: value }))}
      />
    );

  return (
    <form
      ref={formRef}
      className="source-form"
      data-testid="source-form"
      aria-label={`Connect ${driver.name}`}
      onSubmit={(e) => void submit(e)}
      onKeyDown={onKeyDown}
    >
      <div className="source-form-header">
        <button type="button" onClick={onBack} disabled={connecting} data-testid="source-form-back">
          ← Back
        </button>
        <strong className="src-name">{driver.name}</strong>
      </div>
      {noDeviceHint && (
        <p className="hint">{`No ${driver.name} found. Plug it in and it will appear here, or enter its details:`}</p>
      )}
      {section(split.primary, `conn-${driver.id}`)}
      {split.more.length > 0 && (
        <>
          <button
            type="button"
            className="small"
            aria-expanded={showMore}
            onClick={() => setShowMore((v) => !v)}
          >
            {showMore ? 'Show less' : 'Show more'}
          </button>
          {showMore && section(split.more, `conn-${driver.id}`)}
        </>
      )}
      <div className="button-row">
        <button
          type="submit"
          className="primary"
          disabled={!valid || busy !== null}
          data-testid="source-form-connect"
        >
          {connecting ? (
            <>
              <span className="spinner" aria-hidden /> Connecting…
            </>
          ) : (
            'Connect'
          )}
        </button>
        <button type="button" onClick={onCancel} disabled={connecting}>
          Cancel
        </button>
      </div>
      {error && (
        <p className="error" role="alert" data-testid="source-form-error">
          {`Connection failed: ${error}`}
        </p>
      )}
    </form>
  );
}
