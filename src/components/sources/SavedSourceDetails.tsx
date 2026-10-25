import { useState } from 'react';

import type { DriverInfo } from '../../bindings/DriverInfo';
import type { SavedSource } from '../../bindings/SavedSource';
import { formatFrequencyShort } from '../../format/frequency';
import { useSession } from '../../state/session';
import { KIND_LABEL } from './labels';
import { NameForm } from './NameForm';

interface Props {
  saved: SavedSource;
  driver: DriverInfo | undefined;
  onConnected: () => void;
  onDeleted: () => void;
}

function describeValue(value: unknown): string {
  return typeof value === 'number' && Math.abs(value) >= 1000
    ? formatFrequencyShort(value)
    : String(value);
}

export function SavedSourceDetails({ saved, driver, onConnected, onDeleted }: Props) {
  const busy = useSession((s) => s.busy !== null);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { config } = saved;
  const usable = driver?.status === 'available';
  const connection = Object.entries(config.connection);
  const params = Object.entries(config.settings.params);

  return (
    <div className="driver-details" data-testid="saved-details">
      {renaming ? (
        <NameForm
          initial={saved.name}
          submitLabel="Rename"
          onCancel={() => setRenaming(false)}
          onSubmit={async (name) => {
            if (await useSession.getState().saveSource(name, config, saved.id)) setRenaming(false);
          }}
        />
      ) : (
        <h3>{saved.name}</h3>
      )}
      <p className="driver-meta">
        {driver
          ? `${driver.name} · ${KIND_LABEL[driver.kind]}`
          : `Unknown source type "${config.driverId}"`}{' '}
        · saved {new Date(saved.updatedMs).toLocaleString()}
      </p>
      {!usable && (
        <div className="notice notice-planned" role="note">
          {driver
            ? 'This source type is not implemented in this version, so the configuration cannot be connected.'
            : 'This source type is not available in this version of Spectrum Studio.'}
        </div>
      )}
      <dl className="config-summary">
        {config.deviceId && (
          <>
            <dt>Device</dt>
            <dd>{config.deviceId}</dd>
          </>
        )}
        {config.settings.centerHz !== null && (
          <>
            <dt>Center</dt>
            <dd>{formatFrequencyShort(config.settings.centerHz)}</dd>
          </>
        )}
        {config.settings.spanHz !== null && (
          <>
            <dt>Span</dt>
            <dd>{formatFrequencyShort(config.settings.spanHz)}</dd>
          </>
        )}
        {connection.map(([k, v]) => (
          <div key={`c-${k}`} className="config-pair">
            <dt>{driver?.connectionParams.find((p) => p.id === k)?.label ?? k}</dt>
            <dd>{String(v)}</dd>
          </div>
        ))}
        {params.length > 0 && (
          <>
            <dt>Settings</dt>
            <dd>
              <details>
                <summary>{params.length} device settings</summary>
                <ul className="param-list">
                  {params.map(([k, v]) => (
                    <li key={k}>
                      {k}: {describeValue(v)}
                    </li>
                  ))}
                </ul>
              </details>
            </dd>
          </>
        )}
      </dl>
      <div className="button-row end">
        {confirmDelete ? (
          <>
            <span className="hint">Delete “{saved.name}”?</span>
            <button
              className="danger"
              onClick={() => void useSession.getState().deleteSavedSource(saved.id).then(onDeleted)}
            >
              Delete
            </button>
            <button onClick={() => setConfirmDelete(false)}>Cancel</button>
          </>
        ) : (
          <>
            <button onClick={() => setConfirmDelete(true)} data-testid="delete-saved">
              Delete…
            </button>
            <button onClick={() => setRenaming(true)}>Rename…</button>
            <button
              className="primary"
              disabled={!usable || busy}
              data-testid="saved-connect"
              onClick={() => {
                const session = useSession.getState();
                session.select(config);
                void session.connect(config).then((ok) => ok && onConnected());
              }}
            >
              Connect
            </button>
          </>
        )}
      </div>
    </div>
  );
}
