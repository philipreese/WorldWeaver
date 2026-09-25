import * as legacy from './legacy/world.js';
import * as current from './world-v2.js';

export const DEFAULT_ENGINE_VERSION = '2.0.0';
export const SUPPORTED_ENGINE_VERSIONS = Object.freeze(['1.0.0', DEFAULT_ENGINE_VERSION]);

// Protected invariant: a saved world always runs the engine that made it.
// An unknown version is an error, never permission to reinterpret old history.
function engine(version) {
  if (version === '1.0.0') return legacy;
  if (version === DEFAULT_ENGINE_VERSION) return current;
  throw new Error(`Unsupported simulation version “${version}”. This world has not been changed.`);
}

export function createWorld(options = {}) {
  const { engineVersion = DEFAULT_ENGINE_VERSION, ...settings } = options;
  return engine(engineVersion).createWorld(settings);
}
export function advance(world, days = 1) { return engine(world?.version).advance(world, days); }
export function intervene(world, command) { return engine(world?.version).intervene(world, command); }
export function getInterventions(world) { return engine(world?.version).getInterventions(world); }
export function getEntity(world, id) { return engine(world?.version).getEntity(world, id); }
export function entityLabel(world, id) { return engine(world?.version).entityLabel(world, id); }
