import { formatFrequencyShort } from '../format/frequency';
import { useSession } from '../state/session';
import { CaptureControl } from './capture/CaptureControl';
import { FrequencyInput } from './FrequencyInput';
import { SourceButton } from './source/SourceButton';

export function Toolbar() {
  const status = useSession((s) => s.status);
  const busy = useSession((s) => s.busy);
  const { applySettings } = useSession.getState();

  const source = status?.source ?? null;
  const caps = source?.capabilities;

  return (
    <header className="toolbar" role="toolbar" aria-label="Main toolbar">
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
        <label className="field">
          <span>Center</span>
          <FrequencyInput
            label="Center frequency"
            value={source?.settings.centerHz ?? 0}
            min={caps?.tuning?.minHz}
            max={caps?.tuning?.maxHz}
            step={source ? source.settings.spanHz / 10 : 1000}
            disabled={!caps?.tuning || busy === 'applying'}
            title={caps && !caps.tuning ? 'This source cannot be tuned' : undefined}
            onCommit={(centerHz) => void applySettings({ centerHz, spanHz: null, params: {} })}
          />
        </label>
        <label className="field">
          <span>Span</span>
          <select
            aria-label="Span"
            value={source?.settings.spanHz ?? ''}
            disabled={!caps || caps.spanOptionsHz.length === 0 || busy === 'applying'}
            title={
              caps && caps.spanOptionsHz.length === 0 ? 'This source has a fixed span' : undefined
            }
            onChange={(e) =>
              void applySettings({ centerHz: null, spanHz: Number(e.target.value), params: {} })
            }
          >
            {source && !caps?.spanOptionsHz.includes(source.settings.spanHz) && (
              <option value={source.settings.spanHz}>
                {formatFrequencyShort(source.settings.spanHz)}
              </option>
            )}
            {!source && <option value="">—</option>}
            {caps?.spanOptionsHz.map((hz) => (
              <option key={hz} value={hz}>
                {formatFrequencyShort(hz)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  );
}
