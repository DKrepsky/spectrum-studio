import type { ParamValue } from '../bindings/ParamValue';
import type { SourceConfig } from '../bindings/SourceConfig';

export function emptyConfig(driverId: string): SourceConfig {
  return {
    driverId,
    deviceId: null,
    connection: {},
    settings: { centerHz: null, spanHz: null, params: {} },
  };
}

/** Stable JSON (sorted keys) so configs can be compared regardless of key order. */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
}

export function sameConfig(
  a: SourceConfig | null | undefined,
  b: SourceConfig | null | undefined,
): boolean {
  return a != null && b != null && canonical(a) === canonical(b);
}

/**
 * Same device: driver + deviceId when both configs have one, else driver + connection (mirror of
 * the Rust rule). Settings are ignored. A resolved config (with an id) and a stored one without
 * an id are therefore different identities.
 */
export function sameIdentity(
  a: SourceConfig | null | undefined,
  b: SourceConfig | null | undefined,
): boolean {
  if (a == null || b == null || a.driverId !== b.driverId) return false;
  if (a.deviceId != null && b.deviceId != null) return a.deviceId === b.deviceId;
  if (a.deviceId != null || b.deviceId != null) return false;
  return canonical(a.connection) === canonical(b.connection);
}

/** Drops undefined entries from a partially edited parameter map. */
export function toParamMap(
  values: Partial<Record<string, ParamValue>>,
): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  for (const [k, v] of Object.entries(values)) if (v !== undefined) out[k] = v;
  return out;
}
