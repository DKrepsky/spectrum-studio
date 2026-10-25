import type { ActiveSource } from '../bindings/ActiveSource';
import type { ParamValue } from '../bindings/ParamValue';
import type { SavedSource } from '../bindings/SavedSource';
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

/** The connected source's configuration including its current settings, for saving a setup. */
export function snapshotConfig(active: ActiveSource): SourceConfig {
  return {
    ...active.config,
    settings: {
      centerHz: active.settings.centerHz,
      spanHz: active.settings.spanHz,
      params: { ...active.settings.params },
    },
  };
}

export function findSaved(
  saved: readonly SavedSource[],
  config: SourceConfig,
): SavedSource | undefined {
  return saved.find((s) => sameConfig(s.config, config));
}

/** Drops undefined entries from a partially edited parameter map. */
export function toParamMap(
  values: Partial<Record<string, ParamValue>>,
): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  for (const [k, v] of Object.entries(values)) if (v !== undefined) out[k] = v;
  return out;
}
