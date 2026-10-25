import { open } from '@tauri-apps/plugin-dialog';
import { useEffect, useMemo, useState } from 'react';

import type { ParamValue } from '../../bindings/ParamValue';
import { formatFrequencyShort } from '../../format/frequency';
import { useSession } from '../../state/session';
import { snapshotConfig } from '../../state/sourceConfig';
import { DriverDetails } from './DriverDetails';
import { KIND_LABEL, KIND_ORDER, TRANSPORT_LABEL } from './labels';
import { NameForm } from './NameForm';
import { SavedSourceDetails } from './SavedSourceDetails';

export type Selection =
  | { type: 'driver'; id: string; connection?: Partial<Record<string, ParamValue>> }
  | { type: 'saved'; id: string };

const TRACE_EXTENSIONS = ['csv', 'txt'];

/** Picks the file driver for a path by its extension. */
export function fileDriverFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return TRACE_EXTENSIONS.includes(ext) ? 'trace-csv' : 'iq-file';
}

interface Props {
  onClose: () => void;
  initial?: Selection | undefined;
}

/** Dialog for discovering, configuring, connecting and saving sources. */
export function SourceManager({ onClose, initial }: Props) {
  const drivers = useSession((s) => s.drivers);
  const saved = useSession((s) => s.savedSources);
  const connectedDriver = useSession((s) => s.status?.source?.config.driverId);
  const [selection, setSelection] = useState<Selection>(
    initial ?? { type: 'driver', id: connectedDriver ?? 'simulator' },
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const grouped = useMemo(
    () => KIND_ORDER.map((kind) => [kind, drivers.filter((d) => d.kind === kind)] as const),
    [drivers],
  );

  const selectedDriver =
    selection.type === 'driver' ? drivers.find((d) => d.id === selection.id) : undefined;
  const selectedSaved =
    selection.type === 'saved' ? saved.find((s) => s.id === selection.id) : undefined;
  const isSelected = (type: Selection['type'], id: string) =>
    selection.type === type && selection.id === id;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="modal source-manager"
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-manager-title"
      >
        <header className="modal-header">
          <h2 id="source-manager-title">Sources</h2>
          <CurrentConnection onSaved={(id) => setSelection({ type: 'saved', id })} />
          <button className="icon" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="modal-body">
          <nav className="source-list" aria-label="Sources">
            <div className="source-category">
              <h3>Saved configurations</h3>
              {saved.length === 0 && <p className="hint">Nothing saved yet.</p>}
              {saved.map((s) => {
                const driver = drivers.find((d) => d.id === s.config.driverId);
                return (
                  <button
                    key={s.id}
                    className={`source-item${isSelected('saved', s.id) ? ' selected' : ''}`}
                    onClick={() => setSelection({ type: 'saved', id: s.id })}
                    data-testid={`saved-${s.id}`}
                  >
                    <span className="source-item-name">{s.name}</span>
                    <span className="badges">
                      <span className="badge">
                        {driver ? KIND_LABEL[driver.kind].split(' ')[0] : 'Unknown'}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {grouped.map(([kind, list]) => (
              <div key={kind} className="source-category">
                <h3>
                  {KIND_LABEL[kind]}
                  {kind === 'file' && (
                    <button
                      className="small category-action"
                      data-testid="open-file"
                      onClick={() => {
                        const extensions = [
                          ...new Set(
                            list.flatMap((d) =>
                              d.connectionParams.flatMap((p) =>
                                p.kind.type === 'path' ? p.kind.extensions : [],
                              ),
                            ),
                          ),
                        ];
                        void open({
                          multiple: false,
                          directory: false,
                          filters: [{ name: 'Recordings', extensions }],
                        }).then((path) => {
                          if (typeof path === 'string') {
                            setSelection({
                              type: 'driver',
                              id: fileDriverFor(path),
                              connection: { path },
                            });
                          }
                        });
                      }}
                    >
                      Open file…
                    </button>
                  )}
                </h3>
                {list.length === 0 && <p className="hint">None available yet.</p>}
                {list.map((d) => (
                  <button
                    key={d.id}
                    className={`source-item${isSelected('driver', d.id) ? ' selected' : ''}`}
                    onClick={() => setSelection({ type: 'driver', id: d.id })}
                    data-testid={`driver-${d.id}`}
                  >
                    <span className="source-item-name">{d.name}</span>
                    <span className="badges">
                      <span className="badge transport">{TRANSPORT_LABEL[d.transport]}</span>
                      {d.status === 'planned' && <span className="badge planned">Planned</span>}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <section className="source-details">
            {selectedDriver && (
              <DriverDetails
                key={`${selectedDriver.id}:${selection.type === 'driver' ? String(selection.connection?.path ?? '') : ''}`}
                driver={selectedDriver}
                initialConnection={selection.type === 'driver' ? selection.connection : undefined}
                onConnected={onClose}
                onSaved={(id) => setSelection({ type: 'saved', id })}
              />
            )}
            {selectedSaved && (
              <SavedSourceDetails
                key={selectedSaved.id}
                saved={selectedSaved}
                driver={drivers.find((d) => d.id === selectedSaved.config.driverId)}
                onConnected={onClose}
                onDeleted={() =>
                  setSelection({ type: 'driver', id: selectedSaved.config.driverId })
                }
              />
            )}
            {!selectedDriver && !selectedSaved && (
              <p className="hint">Select a source on the left.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function CurrentConnection({ onSaved }: { onSaved: (id: string) => void }) {
  const status = useSession((s) => s.status);
  const [naming, setNaming] = useState(false);
  const source = status?.source;
  if (!source) return <span className="current-connection muted">Not connected</span>;
  const defaultName = `${source.deviceLabel} @ ${formatFrequencyShort(source.settings.centerHz)}`;
  return (
    <span className="current-connection" data-testid="current-connection">
      <span className={`dot state-${status.state}`} /> {source.driverName} · {source.deviceLabel}
      {naming ? (
        <NameForm
          initial={defaultName}
          submitLabel="Save"
          onCancel={() => setNaming(false)}
          onSubmit={async (name) => {
            const saved = await useSession.getState().saveSource(name, snapshotConfig(source));
            if (saved) {
              setNaming(false);
              onSaved(saved.id);
            }
          }}
        />
      ) : (
        <button className="small" onClick={() => setNaming(true)} data-testid="save-current">
          Save setup…
        </button>
      )}
      <button className="small" onClick={() => void useSession.getState().disconnect()}>
        Disconnect
      </button>
    </span>
  );
}
