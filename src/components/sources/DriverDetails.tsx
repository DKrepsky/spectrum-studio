import { useCallback, useEffect, useState } from 'react';

import type { DeviceDescriptor } from '../../bindings/DeviceDescriptor';
import type { DriverInfo } from '../../bindings/DriverInfo';
import type { ParamValue } from '../../bindings/ParamValue';
import type { SourceConfig } from '../../bindings/SourceConfig';
import { api, errorMessage } from '../../ipc/commands';
import { useSession } from '../../state/session';
import { toParamMap } from '../../state/sourceConfig';
import { ParamForm } from '../ParamForm';
import { KIND_LABEL, TRANSPORT_LABEL } from './labels';
import { NameForm } from './NameForm';

interface Props {
  driver: DriverInfo;
  onConnected: () => void;
  onSaved: (id: string) => void;
  /** Pre-filled connection parameters (e.g. a file chosen with "Open file…"). */
  initialConnection?: Partial<Record<string, ParamValue>> | undefined;
}

export function DriverDetails({ driver, onConnected, onSaved, initialConnection }: Props) {
  const busy = useSession((s) => s.busy !== null);
  const available = driver.status === 'available';
  const autoScan = available && driver.supportsDiscovery;
  const [devices, setDevices] = useState<DeviceDescriptor[] | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(autoScan);
  const [scanError, setScanError] = useState<string | null>(null);
  const [connection, setConnection] = useState<Partial<Record<string, ParamValue>>>(
    initialConnection ?? {},
  );
  const [naming, setNaming] = useState(false);

  const discover = useCallback(
    (isCancelled: () => boolean = () => false) =>
      api
        .discoverDevices(driver.id)
        .then(
          (found) => {
            if (isCancelled()) return;
            setDevices(found);
            setScanError(null);
            setDeviceId((current) => current ?? found[0]?.deviceId ?? null);
          },
          (error: unknown) => {
            if (!isCancelled()) setScanError(errorMessage(error));
          },
        )
        .finally(() => {
          if (!isCancelled()) setScanning(false);
        }),
    [driver.id],
  );

  // Scan once when the driver is shown.
  useEffect(() => {
    if (!autoScan) return;
    let cancelled = false;
    void discover(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [autoScan, discover]);

  const missingRequired = driver.connectionParams.filter(
    (p) => p.required && (connection[p.id] === undefined || connection[p.id] === ''),
  );

  const config = (): SourceConfig => ({
    driverId: driver.id,
    deviceId,
    connection: toParamMap(connection),
    settings: { centerHz: null, spanHz: null, params: {} },
  });

  const connect = async () => {
    const session = useSession.getState();
    session.select(config());
    if (await session.connect(config())) onConnected();
  };

  return (
    <div className="driver-details" data-testid="driver-details">
      <h3>{driver.name}</h3>
      <p className="driver-meta">
        {KIND_LABEL[driver.kind]} · {TRANSPORT_LABEL[driver.transport]}
      </p>
      <p>{driver.description}</p>

      {!available ? (
        <div className="notice notice-planned" role="note" data-testid="planned-notice">
          Not implemented yet. This integration is planned and cannot be connected in this version.
        </div>
      ) : (
        <>
          {driver.supportsDiscovery && (
            <div className="discovery">
              <div className="discovery-header">
                <h4>Devices</h4>
                <button
                  className="small"
                  onClick={() => {
                    setScanning(true);
                    void discover();
                  }}
                  disabled={scanning}
                >
                  {scanning ? 'Scanning…' : 'Scan'}
                </button>
              </div>
              {scanError && <p className="error">{scanError}</p>}
              {devices?.length === 0 && <p className="hint">No devices found.</p>}
              {devices?.map((d) => (
                <label
                  key={d.deviceId}
                  className={`device${d.deviceId === deviceId ? ' selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="device"
                    checked={d.deviceId === deviceId}
                    onChange={() => setDeviceId(d.deviceId)}
                  />
                  <span>
                    <strong>{d.label}</strong>
                    <span className="device-details">
                      {d.details.map(([k, v]) => (
                        <span key={k}>
                          {k}: {v}
                        </span>
                      ))}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {driver.connectionParams.length > 0 && (
            <div className="connection-params">
              <h4>Connection</h4>
              <ParamForm
                idPrefix={`conn-${driver.id}`}
                specs={driver.connectionParams}
                values={connection}
                onChange={(id, value) => setConnection((c) => ({ ...c, [id]: value }))}
              />
            </div>
          )}

          <div className="button-row end">
            {naming ? (
              <NameForm
                initial={driver.name}
                submitLabel="Save"
                onCancel={() => setNaming(false)}
                onSubmit={async (name) => {
                  const saved = await useSession.getState().saveSource(name, config());
                  if (saved) onSaved(saved.id);
                }}
              />
            ) : (
              <button onClick={() => setNaming(true)} disabled={missingRequired.length > 0}>
                Save configuration…
              </button>
            )}
            <button
              className="primary"
              disabled={busy || missingRequired.length > 0}
              title={
                missingRequired.length
                  ? `Required: ${missingRequired.map((p) => p.label).join(', ')}`
                  : undefined
              }
              onClick={() => void connect()}
              data-testid="manager-connect"
            >
              Connect
            </button>
          </div>
        </>
      )}
    </div>
  );
}
