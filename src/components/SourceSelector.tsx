import type { Selection } from './sources/SourceManager';
import { useSession } from '../state/session';
import { emptyConfig, findSaved, sameConfig } from '../state/sourceConfig';

/** Toolbar picker for the source that Connect/Run will use: saved setups and ready-to-use drivers. */
export function SourceSelector({
  onOpenSources,
}: {
  onOpenSources: (initial?: Selection) => void;
}) {
  const drivers = useSession((s) => s.drivers);
  const saved = useSession((s) => s.savedSources);
  const selected = useSession((s) => s.selectedConfig);
  const busy = useSession((s) => s.busy !== null);
  const select = useSession((s) => s.select);

  const savedMatch = findSaved(saved, selected);
  const plain = drivers.find((d) => sameConfig(emptyConfig(d.id), selected));
  const value = savedMatch ? `saved:${savedMatch.id}` : plain ? `driver:${plain.id}` : 'custom';
  const usable = drivers.filter((d) => d.status === 'available');
  const customName = [
    drivers.find((d) => d.id === selected.driverId)?.name ?? selected.driverId,
    selected.deviceId,
    typeof selected.connection.path === 'string' ? selected.connection.path.split('/').pop() : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="source-selector">
      <label className="field">
        <span>Source</span>
        <select
          aria-label="Source"
          data-testid="source-select"
          value={value}
          disabled={busy}
          onChange={(e) => {
            const [type, id = ''] = e.target.value.split(/:(.*)/s);
            if (type === 'saved') {
              const s = saved.find((x) => x.id === id);
              if (s) select(s.config);
            } else if (type === 'driver') {
              const driver = drivers.find((d) => d.id === id);
              if (driver?.connectionParams.some((p) => p.required))
                onOpenSources({ type: 'driver', id });
              else select(emptyConfig(id));
            }
          }}
        >
          {value === 'custom' && <option value="custom">{customName}</option>}
          {saved.length > 0 && (
            <optgroup label="Saved configurations">
              {saved.map((s) => (
                <option key={s.id} value={`saved:${s.id}`}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Sources">
            {usable.map((d) => (
              <option key={d.id} value={`driver:${d.id}`}>
                {d.name}
                {d.connectionParams.some((p) => p.required) ? '…' : ''}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      <button
        onClick={() => onOpenSources()}
        title="Discover, configure and save sources"
        data-testid="sources-button"
      >
        Sources…
      </button>
    </div>
  );
}
