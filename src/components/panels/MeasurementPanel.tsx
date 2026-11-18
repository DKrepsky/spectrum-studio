import type { SessionState } from '../../bindings/SessionState';
import type { WindowKind } from '../../bindings/WindowKind';
import { CaptureControl } from '../capture/CaptureControl';
import { formatFrequencyShort } from '../../format/frequency';
import { SourceButton } from '../source/SourceButton';
import { useSession } from '../../state/session';
import { Button } from '../../ui/Button';
import {
  Checkbox,
  Field,
  FrequencyField,
  NumberField,
  Select,
  type SelectOption,
} from '../../ui/Field';

const FFT_SIZES = [256, 512, 1024, 2048, 4096, 8192, 16384, 32768];

const WINDOWS: { value: WindowKind; label: string }[] = [
  { value: 'hann', label: 'Hann' },
  { value: 'rectangular', label: 'Rectangular' },
  { value: 'blackmanHarris', label: 'Blackman-Harris' },
  { value: 'flatTop', label: 'Flat top' },
];

const TRACE_REASON = 'The source supplies measured traces; no FFT is computed';

/**
 * Why FFT size and Window are unavailable, or undefined when they can be changed. They need a
 * connected IQ source (DESIGN.md 3.6, 4.5): the reason is in the tooltip and the accessible
 * description, and the plot hint shows it on screen while no source is connected (5.4).
 */
function processingReason(state: SessionState, hasSource: boolean, traceSource: boolean) {
  if (traceSource) return TRACE_REASON;
  if (hasSource) return undefined;
  if (state === 'connecting') return 'Connecting…';
  if (state === 'disconnecting') return 'Disconnecting…';
  return 'Connect a source first';
}

/** The description ids of a control: its own hint or error, and the reason when it is unavailable. */
function describedBy(own: string | undefined, reasonId: string | undefined) {
  return [own, reasonId].filter(Boolean).join(' ') || undefined;
}

/** The unavailable reason as text for the accessible description (the tooltip alone is not enough, 5.4). */
function UnavailableReason({ id, reason }: { id: string; reason: string | undefined }) {
  return reason ? (
    <span id={id} className="visually-hidden">
      {reason}
    </span>
  ) : null;
}

/**
 * The Measurement group (DESIGN.md 3.6): the source button first, then Center and Span, the FFT rows
 * and the hold row, and the capture control last. Center and Span are shown, disabled, while no
 * source is connected, and read-only while a change applies. FFT size and Window are disabled with
 * their reason while no source is connected, or for a trace source. The FFT rows need the processing
 * settings.
 */
export function MeasurementPanel() {
  const processing = useSession((s) => s.status?.processing);
  const source = useSession((s) => s.status?.source ?? null);
  const busy = useSession((s) => s.busy);
  const dataKind = useSession((s) => s.status?.source?.capabilities.dataKind);
  const state = useSession((s) => s.status?.state ?? 'disconnected');
  const { applySettings, setProcessing, resetHolds } = useSession.getState();

  const caps = source?.capabilities;
  const spanOptions: SelectOption[] = [];
  if (!source) spanOptions.push({ value: '', label: '—' });
  if (source && !caps?.spanOptionsHz.includes(source.settings.spanHz)) {
    spanOptions.push({
      value: String(source.settings.spanHz),
      label: formatFrequencyShort(source.settings.spanHz),
    });
  }
  for (const hz of caps?.spanOptionsHz ?? []) {
    spanOptions.push({ value: String(hz), label: formatFrequencyShort(hz) });
  }

  const traceSource = dataKind === 'trace';
  const fftReason = processingReason(state, source !== null, traceSource);

  return (
    <>
      <SourceButton />
      <Field label="Center" id="center" layout="inline">
        {(c) => (
          <FrequencyField
            id={c.id}
            aria-describedby={c.describedBy}
            data-testid="center-frequency"
            label="Center frequency"
            value={source?.settings.centerHz ?? null}
            min={caps?.tuning?.minHz}
            max={caps?.tuning?.maxHz}
            step={source ? source.settings.spanHz / 10 : 1000}
            disabled={!caps?.tuning}
            // Read-only while applying, not disabled: a disabled control drops keyboard focus (9.8).
            readOnly={busy === 'applying'}
            title={caps && !caps.tuning ? 'This source cannot be tuned' : undefined}
            onCommit={(centerHz) => void applySettings({ centerHz, spanHz: null, params: {} })}
          />
        )}
      </Field>
      <Field label="Span" id="span" layout="inline">
        {(c) => (
          <Select
            id={c.id}
            aria-describedby={c.describedBy}
            label="Span"
            data-testid="span-select"
            value={source ? String(source.settings.spanHz) : ''}
            options={spanOptions}
            disabled={!caps || caps.spanOptionsHz.length === 0}
            // Read-only while applying, not disabled: a disabled select drops keyboard focus (9.8).
            readOnly={busy === 'applying'}
            title={
              caps && caps.spanOptionsHz.length === 0 ? 'This source has a fixed span' : undefined
            }
            onChange={(value) =>
              void applySettings({ centerHz: null, spanHz: Number(value), params: {} })
            }
          />
        )}
      </Field>
      {processing ? (
        <>
          <Field label="FFT size" id="fft-size" layout="inline">
            {(c) => (
              <>
                <Select
                  id={c.id}
                  aria-describedby={describedBy(
                    c.describedBy,
                    fftReason ? `${c.id}-reason` : undefined,
                  )}
                  label="FFT size"
                  value={String(processing.fftSize)}
                  options={FFT_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
                  disabled={fftReason !== undefined}
                  title={fftReason}
                  onChange={(value) => void setProcessing({ fftSize: Number(value) })}
                />
                <UnavailableReason id={`${c.id}-reason`} reason={fftReason} />
              </>
            )}
          </Field>
          <Field label="Window" id="window" layout="inline">
            {(c) => (
              <>
                <Select
                  id={c.id}
                  aria-describedby={describedBy(
                    c.describedBy,
                    fftReason ? `${c.id}-reason` : undefined,
                  )}
                  label="Window"
                  value={processing.window}
                  options={WINDOWS}
                  disabled={fftReason !== undefined}
                  title={fftReason}
                  onChange={(value) => void setProcessing({ window: value as WindowKind })}
                />
                <UnavailableReason id={`${c.id}-reason`} reason={fftReason} />
              </>
            )}
          </Field>
          <Field label="Averaging" id="averaging" layout="inline">
            {(c) => (
              <NumberField
                id={c.id}
                aria-describedby={c.describedBy}
                label="Averaging"
                unit="traces"
                value={processing.averaging}
                min={1}
                max={1000}
                integer
                onCommit={(averaging) => void setProcessing({ averaging })}
              />
            )}
          </Field>
          <div className="panel-row">
            <Checkbox
              label="Max hold"
              checked={processing.maxHold}
              onChange={(maxHold) => void setProcessing({ maxHold })}
              adornment={<span className="swatch max-hold" />}
            />
            <Checkbox
              label="Min hold"
              checked={processing.minHold}
              onChange={(minHold) => void setProcessing({ minHold })}
              adornment={<span className="swatch min-hold" />}
            />
            <Button
              size="small"
              unavailable={!processing.maxHold && !processing.minHold}
              onClick={() => void resetHolds()}
            >
              Reset
            </Button>
          </div>
        </>
      ) : null}
      <CaptureControl />
    </>
  );
}
