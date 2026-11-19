import { useLayoutEffect, useRef, type FocusEvent } from 'react';

import type { SessionState } from '../../bindings/SessionState';
import type { WindowKind } from '../../bindings/WindowKind';
import { CaptureControl } from '../capture/CaptureControl';
import { formatFrequencyShort } from '../../format/frequency';
import { SourceButton } from '../source/SourceButton';
import { selectStartup, useSession, type Startup } from '../../state/session';
import { selectedCapabilities } from '../../state/selectedCapabilities';
import { useSources } from '../../state/sources';
import { Button } from '../../ui/Button';
import {
  Checkbox,
  Field,
  FrequencyField,
  NumberField,
  Select,
  type SelectOption,
} from '../../ui/Field';
import { ParamField } from '../ParamForm';

const FFT_SIZES = [256, 512, 1024, 2048, 4096, 8192, 16384, 32768];

const WINDOWS: { value: WindowKind; label: string }[] = [
  { value: 'hann', label: 'Hann' },
  { value: 'rectangular', label: 'Rectangular' },
  { value: 'blackmanHarris', label: 'Blackman-Harris' },
  { value: 'flatTop', label: 'Flat top' },
];

/**
 * Why the device rows and the FFT rows are unavailable, or undefined when they can be changed. They
 * need a connected source (DESIGN.md 3.6): the reason is in the tooltip and the accessible
 * description, and the plot hint shows it on screen while no source is connected (5.4). During
 * start-up the reason is "Loading…" (ADR 0017), and when start-up failed it is "Status unavailable"
 * (S12), the same words as the source button and the capture control.
 */
function unavailableReason(state: SessionState, hasSource: boolean, startup: Startup) {
  if (hasSource) return undefined;
  if (startup === 'loading') return 'Loading…';
  if (startup === 'unavailable') return 'Status unavailable';
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
 * The Measurement group (DESIGN.md 3.6). The rows follow the kind of the selected source: source
 * button, Center and Span, the source's measurement parameters, FFT size and Window (IQ sources
 * only), Averaging, the hold row, and the capture control. A row that does not apply is not rendered.
 *
 * While no source is connected, Center, Span and the device rows show an em dash and are disabled
 * with the reason; FFT size and Window keep their processing values and the same reason. Read-only
 * while a change applies, not disabled, so keyboard focus stays (DESIGN.md 9.8).
 */
export function MeasurementPanel() {
  const status = useSession((s) => s.status);
  const capabilitiesByDriver = useSession((s) => s.capabilitiesByDriver);
  const active = useSources((s) => s.active);
  const busy = useSession((s) => s.busy);
  const startup = useSession(selectStartup);
  const { applySettings, setProcessing, resetHolds } = useSession.getState();

  const processing = status?.processing;
  const source = status?.source ?? null;
  const caps = selectedCapabilities({ status, capabilitiesByDriver }, { active });
  const reason = unavailableReason(status?.state ?? 'disconnected', source !== null, startup);
  const measurementParams = caps?.params.filter((p) => p.placement === 'measurement') ?? [];

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

  // Focus follows the kind of row: when the focused row leaves the panel, focus would fall to the
  // body. Move it to Averaging, or else the source button (DESIGN.md 6).
  const rowsRef = useRef<HTMLDivElement>(null);
  const focusedRow = useRef<string | null>(null);
  useLayoutEffect(() => {
    const id = focusedRow.current;
    const rows = rowsRef.current;
    if (!id || !rows || rows.querySelector(`[id="${id}"]`)) return;
    if (document.activeElement !== document.body) return;
    const target =
      rows.querySelector<HTMLElement>('[id="averaging"]') ??
      rows.querySelector<HTMLElement>('[data-testid="source-button"]');
    target?.focus();
  });
  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    focusedRow.current = event.target.id || null;
  };

  return (
    <div ref={rowsRef} className="measurement-rows" onFocus={onFocus}>
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
            disabled={source === null || !caps?.tuning}
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
            disabled={source === null || !caps || caps.spanOptionsHz.length === 0}
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
      {measurementParams.map((spec) => (
        <ParamField
          key={spec.id}
          spec={spec}
          value={source?.settings.params[spec.id] ?? spec.default}
          onChange={(value) =>
            void applySettings({ centerHz: null, spanHz: null, params: { [spec.id]: value } })
          }
          disabled={source === null}
          readOnly={busy === 'applying'}
          id={`measurement-${spec.id}`}
          layout="inline"
          noValue={source === null}
          reason={reason}
        />
      ))}
      {processing && caps?.dataKind === 'iq' ? (
        <>
          <Field label="FFT size" id="fft-size" layout="inline">
            {(c) => (
              <>
                <Select
                  id={c.id}
                  aria-describedby={describedBy(
                    c.describedBy,
                    reason ? `${c.id}-reason` : undefined,
                  )}
                  label="FFT size"
                  value={String(processing.fftSize)}
                  options={FFT_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
                  disabled={reason !== undefined}
                  title={reason}
                  onChange={(value) => void setProcessing({ fftSize: Number(value) })}
                />
                <UnavailableReason id={`${c.id}-reason`} reason={reason} />
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
                    reason ? `${c.id}-reason` : undefined,
                  )}
                  label="Window"
                  value={processing.window}
                  options={WINDOWS}
                  disabled={reason !== undefined}
                  title={reason}
                  onChange={(value) => void setProcessing({ window: value as WindowKind })}
                />
                <UnavailableReason id={`${c.id}-reason`} reason={reason} />
              </>
            )}
          </Field>
        </>
      ) : null}
      {processing ? (
        <>
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
    </div>
  );
}
