import { formatFrequencyShort } from '../format/frequency';
import { useSession } from '../state/session';
import { FrequencyField, Select, type SelectOption } from '../ui/Field';
import { CaptureControl } from './capture/CaptureControl';
import { SourceButton } from './source/SourceButton';

/**
 * The toolbar (DESIGN.md 3.3): brand, source group (source button, capture control), field group
 * (Center, Span). Layout is this app's; every control comes from `src/ui/`.
 */
export function Toolbar() {
  const status = useSession((s) => s.status);
  const busy = useSession((s) => s.busy);
  const { applySettings } = useSession.getState();

  const source = status?.source ?? null;
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

  return (
    <header className="toolbar" aria-label="Main toolbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden>
          ▲
        </span>
        Spectrum Studio
      </div>

      <div className="toolbar-group toolbar-source">
        <SourceButton />
        <CaptureControl />
      </div>

      <div className="toolbar-group">
        <div className="toolbar-field">
          <span>Center</span>
          <FrequencyField
            size="toolbar"
            label="Center frequency"
            data-testid="center-frequency"
            value={source?.settings.centerHz ?? 0}
            min={caps?.tuning?.minHz}
            max={caps?.tuning?.maxHz}
            step={source ? source.settings.spanHz / 10 : 1000}
            disabled={!caps?.tuning || busy === 'applying'}
            title={caps && !caps.tuning ? 'This source cannot be tuned' : undefined}
            onCommit={(centerHz) => void applySettings({ centerHz, spanHz: null, params: {} })}
          />
        </div>
        <div className="toolbar-field">
          <span>Span</span>
          <Select
            size="toolbar"
            className="toolbar-span"
            label="Span"
            data-testid="span-select"
            value={source ? String(source.settings.spanHz) : ''}
            options={spanOptions}
            disabled={!caps || caps.spanOptionsHz.length === 0 || busy === 'applying'}
            title={
              caps && caps.spanOptionsHz.length === 0 ? 'This source has a fixed span' : undefined
            }
            onChange={(value) =>
              void applySettings({ centerHz: null, spanHz: Number(value), params: {} })
            }
          />
        </div>
      </div>
    </header>
  );
}
