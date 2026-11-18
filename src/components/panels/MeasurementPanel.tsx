import type { WindowKind } from '../../bindings/WindowKind';
import { formatFrequencyShort } from '../../format/frequency';
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

/**
 * The Measurement group (DESIGN.md 3.6). Center and Span come first: they tune the source and are
 * shown, disabled, while no source is connected, and read-only while a change applies. The FFT
 * rows need the processing settings.
 */
export function MeasurementPanel() {
  const processing = useSession((s) => s.status?.processing);
  const source = useSession((s) => s.status?.source ?? null);
  const busy = useSession((s) => s.busy);
  const dataKind = useSession((s) => s.status?.source?.capabilities.dataKind);
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
  const fftTitle = traceSource
    ? 'The source supplies measured traces; no FFT is computed'
    : undefined;

  return (
    <>
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
              <Select
                id={c.id}
                aria-describedby={c.describedBy}
                label="FFT size"
                value={String(processing.fftSize)}
                options={FFT_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
                disabled={traceSource}
                title={fftTitle}
                onChange={(value) => void setProcessing({ fftSize: Number(value) })}
              />
            )}
          </Field>
          <Field label="Window" id="window" layout="inline">
            {(c) => (
              <Select
                id={c.id}
                aria-describedby={c.describedBy}
                label="Window"
                value={processing.window}
                options={WINDOWS}
                disabled={traceSource}
                title={fftTitle}
                onChange={(value) => void setProcessing({ window: value as WindowKind })}
              />
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
    </>
  );
}
