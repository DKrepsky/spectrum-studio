import type { WindowKind } from '../../bindings/WindowKind';
import { useSession } from '../../state/session';
import { Button } from '../../ui/Button';
import { Checkbox, Field, NumberField, Select } from '../../ui/Field';

const FFT_SIZES = [256, 512, 1024, 2048, 4096, 8192, 16384, 32768];

const WINDOWS: { value: WindowKind; label: string }[] = [
  { value: 'hann', label: 'Hann' },
  { value: 'rectangular', label: 'Rectangular' },
  { value: 'blackmanHarris', label: 'Blackman-Harris' },
  { value: 'flatTop', label: 'Flat top' },
];

export function MeasurementPanel() {
  const processing = useSession((s) => s.status?.processing);
  const dataKind = useSession((s) => s.status?.source?.capabilities.dataKind);
  const { setProcessing, resetHolds } = useSession.getState();
  if (!processing) return null;
  const traceSource = dataKind === 'trace';
  const fftTitle = traceSource
    ? 'The source supplies measured traces; no FFT is computed'
    : undefined;

  return (
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
  );
}
