import type { Capabilities } from '../bindings/Capabilities';
import type { SessionStore } from './session';

/**
 * The capabilities of the source the user has selected (DESIGN.md 3.6): the open source's own while
 * one is connected, else what its driver reported earlier in this run, else `undefined` (the source
 * has not been opened since launch, so its kind is not known).
 */
export function selectedCapabilities(
  session: Pick<SessionStore, 'status' | 'capabilitiesByDriver'>,
  sources: { active: { config: { driverId: string } } | null },
): Capabilities | undefined {
  const open = session.status?.source;
  if (open) return open.capabilities;
  const driverId = sources.active?.config.driverId;
  if (driverId === undefined) return undefined;
  const remembered: Capabilities | undefined = session.capabilitiesByDriver[driverId];
  return remembered;
}
