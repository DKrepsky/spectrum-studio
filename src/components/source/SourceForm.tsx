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
import { Button } from '../../ui/Button';
import { InlineMessage } from '../../ui/InlineMessage';
import { ParamForm } from '../ParamForm';

type Values = Partial<Record<string, ParamValue>>;

interface Props {
  driver: DriverInfo;
  deviceId: string | null;
  /** Display name for the entry being connected (a detected device's label). */
  title?: string | undefined;
  /** Prefilled connection values, e.g. a remembered source being edited. */
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
        <Button
          size="small"
          onClick={onBack}
          unavailable={connecting}
          data-testid="source-form-back"
        >
          ← Back
        </Button>
        <strong className="source-form-title">{driver.name}</strong>
      </div>
      {noDeviceHint && (
        <InlineMessage variant="hint">
          {`No ${driver.name} found. Plug it in and it will appear here, or enter its details:`}
        </InlineMessage>
      )}
      {section(split.primary, `conn-${driver.id}`)}
      {split.more.length > 0 && (
        <>
          <Button size="small" aria-expanded={showMore} onClick={() => setShowMore((v) => !v)}>
            {showMore ? 'Show less' : 'Show more'}
          </Button>
          {showMore && section(split.more, `conn-${driver.id}`)}
        </>
      )}
      <div className="source-form-actions">
        <Button
          type="submit"
          variant="primary"
          busy={connecting}
          // Native disable only for the real not-ready state (a required value is missing).
          disabled={!valid}
          unavailable={busy !== null && !connecting}
          // A lead slot while connecting: the spinner shows beside the label, which stays.
          icon={connecting ? <span /> : undefined}
          data-testid="source-form-connect"
        >
          {connecting ? 'Connecting…' : 'Connect'}
        </Button>
        <Button unavailable={connecting} onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {/* The region is always mounted, so the error is announced when it appears (DESIGN.md 9.6). */}
      <div role="status" aria-live="polite" className="source-form-status">
        {error && (
          <InlineMessage variant="error" data-testid="source-form-error">
            {`Connection failed: ${error}`}
          </InlineMessage>
        )}
      </div>
    </form>
  );
}
