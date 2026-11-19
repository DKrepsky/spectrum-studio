import { activeSimulator, status } from '../test/fixtures';
import { emptyConfig } from './sourceConfig';
import { selectedCapabilities } from './selectedCapabilities';

const trace = {
  ...activeSimulator.capabilities,
  dataKind: 'trace' as const,
};
const simulatorActive = { config: emptyConfig('simulator') };
const sa430Active = { config: emptyConfig('sa430') };

describe('selectedCapabilities', () => {
  it('uses the open source capabilities while one is connected', () => {
    const session = {
      status: status({ state: 'connected', source: activeSimulator }),
      capabilitiesByDriver: { sa430: trace },
    };
    expect(selectedCapabilities(session, { active: sa430Active })).toBe(
      activeSimulator.capabilities,
    );
  });

  it('uses what the selected driver reported earlier while disconnected', () => {
    const session = {
      status: status({ state: 'disconnected', source: null }),
      capabilitiesByDriver: { sa430: trace },
    };
    expect(selectedCapabilities(session, { active: sa430Active })).toBe(trace);
  });

  it('is undefined for a source that has not been opened in this run', () => {
    const session = {
      status: status({ state: 'disconnected', source: null }),
      capabilitiesByDriver: { sa430: trace },
    };
    expect(selectedCapabilities(session, { active: simulatorActive })).toBeUndefined();
  });

  it('is undefined with no selected source', () => {
    const session = {
      status: status({ state: 'disconnected', source: null }),
      capabilitiesByDriver: { sa430: trace },
    };
    expect(selectedCapabilities(session, { active: null })).toBeUndefined();
  });
});
