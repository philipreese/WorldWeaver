import { createWorld, advance, intervene, getEntity, DEFAULT_ENGINE_VERSION, SUPPORTED_ENGINE_VERSIONS } from '../sim/world.js';
import { STYLE_COLOR_IDS, PERSON_ACCESSORY_IDS, HOME_DECORATION_IDS, GUIDE_STEP_IDS, PERSONALIZATION_LIMITS } from '../customization.js';
import { defaultNeighborhood, validateNeighborhood, reduceNeighborhood } from '../neighborhood.js';

export const HISTORY_LIMITS = Object.freeze({ ticks: 6000, commands: 1200, branches: 8, followed: 24, exportBytes: 4 * 1024 * 1024 });
export const SAVE_KEYS = Object.freeze({ current: 'worldweaver.save.current', previous: 'worldweaver.save.previous', staging: 'worldweaver.save.staging' });
const FORMAT = 'worldweaver';
const SAVE_VERSION = 1;
// Protected invariant: import, continuation, replay and recovery keep the saved
// engine version. No upgrade rewrites an existing future. The engine version is
// part of branch trust, and each head/checkpoint must agree with the archive.
// Exact replay fingerprints still reject damaged or reinterpreted transcripts.
const CHECKPOINT_EVERY = 20;
const trustedBranches = new WeakMap();
const slotCache = new WeakMap();
const dangerousKeys = new Set(['__proto__', 'prototype', 'constructor']);

function fail(message) { throw new Error(message); }
function limit(message) { fail(`${message} Export this world before starting a new one; retained history is never silently discarded.`); }
function integer(value, minimum, maximum, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail(`${label} must be an integer from ${minimum} to ${maximum}.`);
  return value;
}
function record(value, keys, label, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(`${label} must be an object.`);
  for (const key of Object.keys(value)) if ((!keys.includes(key) && !optional.includes(key)) || dangerousKeys.has(key)) fail(`${label} contains unsupported field “${key}”.`);
  for (const key of keys) if (!Object.hasOwn(value, key)) fail(`${label} is missing “${key}”.`);
}
function shortText(value, maximum, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum || /[\u0000-\u001f\u007f]/u.test(value)) fail(`${label} must be readable text of at most ${maximum} characters.`);
  return value;
}
function choice(value, values, label) {
  if (!values.includes(value)) fail(`${label} is not supported.`);
  return value;
}
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  if (typeof value === 'number' && !Number.isFinite(value)) fail('A world contains a non-finite number. Export was stopped.');
  return JSON.stringify(value);
}
// This fingerprint detects damaged files and simulator drift. It is not an
// authenticity claim: imported state is ALWAYS reconstructed by valid commands.
function digest(world) {
  const source = canonical(world);
  let a = 0x811c9dc5, b = 0x9e3779b9, c = 0x85ebca6b, d = 0xc2b2ae35;
  for (let index = 0; index < source.length; index++) {
    const unit = source.charCodeAt(index);
    a = Math.imul(a ^ unit, 16777619);
    b = Math.imul(b ^ unit, 2246822519);
    c = Math.imul(c ^ unit, 3266489917);
    d = Math.imul(d ^ unit, 668265263);
  }
  return [a, b, c, d].map(value => (value >>> 0).toString(16).padStart(8, '0')).join('');
}
function initialConfig(config = {}) {
  const allowed = ['seed', 'tier', 'climate', 'temperament', 'density'];
  if (!config || typeof config !== 'object' || Array.isArray(config)) fail('World settings must be an object.');
  for (const key of Object.keys(config)) if (!allowed.includes(key)) fail(`Unsupported world setting “${key}”.`);
  return freeze({
    seed: integer(config.seed ?? 8417, 0, 0xffffffff, 'Seed'),
    tier: choice(config.tier ?? 1, [1, 2], 'Tier'),
    climate: choice(config.climate ?? 'temperate', ['temperate', 'dry', 'wet'], 'Climate'),
    temperament: choice(config.temperament ?? 'careful', ['careful', 'curious', 'communal'], 'Temperament'),
    density: choice(config.density ?? 'balanced', ['sparse', 'balanced', 'dense'], 'Density'),
  });
}
function validateCommand(command) {
  if (!command || typeof command !== 'object') fail('A history command must be an object.');
  if (command.type === 'advance') {
    record(command, ['type', 'days'], 'Advance command');
    return freeze({ type: 'advance', days: integer(command.days, 1, HISTORY_LIMITS.ticks, 'Advance days') });
  }
  if (command.type === 'intervene') {
    record(command, ['type', 'intervention'], 'Intervention command');
    record(command.intervention, ['kind', 'targetId'], 'Intervention');
    return freeze({ type: 'intervene', intervention: {
      kind: choice(command.intervention.kind, ['open-route', 'reveal-relic', 'restore-habitat', 'offer-refuge'], 'Intervention kind'),
      targetId: shortText(command.intervention.targetId, 100, 'Intervention target'),
    } });
  }
  fail('Unknown history command.');
}
function execute(world, command) {
  return command.type === 'advance' ? advance(world, command.days) : intervene(world, command.intervention);
}
function activeBranch(history, id = history.activeBranchId) {
  simulationVersion(history.simulationVersion);
  const expectedTrust = trustKey(history.initialConfig, history.simulationVersion);
  for (const candidate of history.branches) {
    matchingEngine(candidate, history.simulationVersion);
    // Do not turn an externally modified head into trusted state by advancing it.
    if (trustedBranches.get(candidate) !== expectedTrust) fail('History was changed outside the simulation. Recorded state has not been changed.');
  }
  const branch = history.branches.find(item => item.id === id);
  if (!branch) fail(`Unknown history branch “${id}”.`);
  return branch;
}
function simulationVersion(version) {
  if (!SUPPORTED_ENGINE_VERSIONS.includes(version)) fail('This save uses an unsupported simulation version (supported: 1.0.0 and 2.0.0 / save 1).');
  return version;
}
function trustKey(config, version) { return canonical({ simulationVersion: version, config }); }
function matchingEngine(branch, version) {
  if (branch.head?.version !== version || branch.checkpoints.some(checkpoint => checkpoint.world?.version !== version)) fail('History contains mixed simulation versions. The saved engine and every branch must agree.');
}
function trust(branch, config, version) {
  simulationVersion(version);
  matchingEngine(branch, version);
  freeze(branch);
  trustedBranches.set(branch, trustKey(config, version));
  return branch;
}
function totalCommands(history) { return history.branches.reduce((sum, branch) => sum + branch.commands.length, 0); }
function complete(history) { return freeze(history); }

export function createHistory(config = {}, version = DEFAULT_ENGINE_VERSION) {
  simulationVersion(version);
  const settings = initialConfig(config);
  const world = freeze(createWorld({ ...settings, engineVersion: version }));
  const branch = trust({ id: 'b1', name: 'First history', parentId: null, forkTick: 0, forkCommandIndex: 0, commands: [], checkpoints: [{ commandIndex: 0, world }], head: world }, settings, version);
  return complete({ format: FORMAT, saveVersion: SAVE_VERSION, simulationVersion: version, initialConfig: settings, activeBranchId: 'b1', nextBranchId: 2, branches: [branch], followed: ['s-hearth', 'c-nera'], attention: 'balanced', session: { lastSeenTick: 0 } });
}

export function currentWorld(history) { return activeBranch(history).head; }

export function applyCommand(history, input) {
  const command = validateCommand(input);
  const source = activeBranch(history);
  if (totalCommands(history) >= HISTORY_LIMITS.commands) limit('This world has reached its retained command limit.');
  if (command.type === 'advance' && source.head.tick + command.days > HISTORY_LIMITS.ticks) limit(`This branch has a ${HISTORY_LIMITS.ticks}-day horizon.`);
  // Protected invariant: a failed action cannot alter the source future, any
  // checkpoint, or another branch. The simulator receives frozen input.
  const head = freeze(execute(source.head, command));
  const commands = [...source.commands, freeze({ atTick: source.head.tick, command })];
  const checkpoints = commands.length % CHECKPOINT_EVERY === 0 ? [...source.checkpoints, { commandIndex: commands.length, world: head }] : source.checkpoints;
  const updated = trust({ ...source, commands, checkpoints, head }, history.initialConfig, history.simulationVersion);
  return complete({ ...history, branches: history.branches.map(branch => branch === source ? updated : branch) });
}

export function worldAt(history, tick, branchId = history.activeBranchId) {
  const branch = activeBranch(history, branchId);
  integer(tick, 0, branch.head.tick, 'Timeline day');
  if (tick === branch.head.tick) return branch.head;
  let checkpoint = branch.checkpoints[0];
  for (const candidate of branch.checkpoints) if (candidate.world.tick <= tick && candidate.commandIndex >= checkpoint.commandIndex) checkpoint = candidate;
  let world = checkpoint.world;
  for (let index = checkpoint.commandIndex; index < branch.commands.length; index++) {
    const entry = branch.commands[index];
    if (entry.atTick > tick) break;
    if (entry.command.type === 'advance') {
      const remaining = tick - world.tick;
      if (remaining <= 0) break;
      if (entry.command.days > remaining) return freeze(advance(world, remaining));
    }
    world = execute(world, entry.command);
  }
  // Interventions already issued on the selected day are part of that day's
  // recorded state. Replaying a partial advance never runs future decisions.
  return freeze(world);
}

function commandPrefix(commands, tick) {
  const prefix = [];
  let completeCount = 0;
  for (const entry of commands) {
    if (entry.atTick > tick) break;
    if (entry.command.type === 'advance') {
      if (entry.atTick === tick) break;
      if (entry.atTick + entry.command.days > tick) {
        prefix.push(freeze({ atTick: entry.atTick, command: { type: 'advance', days: tick - entry.atTick } }));
        break;
      }
    }
    prefix.push(entry);
    completeCount++;
  }
  return { commands: prefix, completeCount };
}

export function forkHistory(history, tick, name = `History ${history.nextBranchId}`) {
  const source = activeBranch(history);
  integer(tick, 0, source.head.tick, 'Branch day');
  shortText(name, 64, 'Branch name');
  if (history.branches.length >= HISTORY_LIMITS.branches) limit(`This world already has ${HISTORY_LIMITS.branches} branches.`);
  const prefix = commandPrefix(source.commands, tick);
  if (totalCommands(history) + prefix.commands.length > HISTORY_LIMITS.commands) limit('Creating this branch would exceed the retained command limit.');
  const head = worldAt(history, tick);
  const checkpoints = source.checkpoints.filter(checkpoint => checkpoint.commandIndex <= prefix.completeCount);
  if (prefix.commands.length % CHECKPOINT_EVERY === 0 && checkpoints.at(-1).commandIndex !== prefix.commands.length) checkpoints.push({ commandIndex: prefix.commands.length, world: head });
  const id = `b${history.nextBranchId}`;
  const branch = trust({ id, name: name.trim(), parentId: source.id, forkTick: tick, forkCommandIndex: prefix.commands.length, commands: prefix.commands, checkpoints, head }, history.initialConfig, history.simulationVersion);
  return complete({ ...history, activeBranchId: id, nextBranchId: history.nextBranchId + 1, branches: [...history.branches, branch] });
}

export function selectBranch(history, id) {
  activeBranch(history, id);
  return complete({ ...history, activeBranchId: id });
}

function archiveHasPerson(history, id) {
  return history.branches.some(branch => branch.head.characters.some(person => person.id === id));
}
function archiveHasHome(history, id) {
  return history.branches.some(branch => branch.head.settlements.some(place => place.structures.some(structure => structure.id === id && structure.kind === 'home')));
}
function styleMap(value, maximum, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(`${label} must be an identity map.`);
  const ids = Object.keys(value);
  if (ids.length > maximum) fail(`${label} exceeds its ${maximum}-entry limit.`);
  for (const id of ids) if (dangerousKeys.has(id) || !/^[a-z][a-z0-9-]{0,99}$/u.test(id)) fail(`${label} contains an invalid stable identity.`);
  return ids.sort();
}
function validatePersonalization(value, history) {
  record(value, ['version', 'people', 'homes'], 'Personalization');
  if (value.version !== 1) fail('Unsupported personalization version.');
  const people = {}, homes = {};
  for (const id of styleMap(value.people, PERSONALIZATION_LIMITS.people, 'Person styles')) {
    if (!archiveHasPerson(history, id)) fail(`Person style refers to unknown character “${id}”.`);
    const style = value.people[id];
    record(style, [], 'Person style', ['color', 'accessory']);
    if (!Object.keys(style).length) fail('Person style must choose a color or accessory.');
    people[id] = {
      ...(Object.hasOwn(style, 'color') ? { color: choice(style.color, STYLE_COLOR_IDS, 'Person color') } : {}),
      ...(Object.hasOwn(style, 'accessory') ? { accessory: choice(style.accessory, PERSON_ACCESSORY_IDS, 'Person accessory') } : {}),
    };
  }
  for (const id of styleMap(value.homes, PERSONALIZATION_LIMITS.homes, 'Home styles')) {
    if (!archiveHasHome(history, id)) fail(`Home style refers to an unknown home “${id}”.`);
    const style = value.homes[id];
    record(style, ['decoration'], 'Home style', ['color']);
    homes[id] = {
      ...(Object.hasOwn(style, 'color') ? { color: choice(style.color, STYLE_COLOR_IDS, 'Home color') } : {}),
      decoration: choice(style.decoration, HOME_DECORATION_IDS, 'Home decoration'),
    };
  }
  return { version: 1, people, homes };
}
function validateGuide(value) {
  record(value, ['version', 'completed', 'dismissed'], 'Guide progress');
  if (value.version !== 1) fail('Unsupported guide version.');
  if (!Array.isArray(value.completed) || value.completed.length > GUIDE_STEP_IDS.length || new Set(value.completed).size !== value.completed.length) fail('Guide completion steps must be a bounded list without duplicates.');
  for (const id of value.completed) choice(id, GUIDE_STEP_IDS, 'Guide step');
  if (typeof value.dismissed !== 'boolean') fail('Guide dismissal must be true or false.');
  return { version: 1, completed: GUIDE_STEP_IDS.filter(id => value.completed.includes(id)), dismissed: value.dismissed };
}
function presentationMetadata(history) {
  return {
    ...(Object.hasOwn(history, 'personalization') ? { personalization: validatePersonalization(history.personalization, history) } : {}),
    ...(Object.hasOwn(history, 'guide') ? { guide: validateGuide(history.guide) } : {}),
    ...(Object.hasOwn(history, 'neighborhood') ? { neighborhood: validateNeighborhood(history.neighborhood) } : {}),
  };
}

// Protected invariant: cosmetic choices, guide progress and courtyard activities
// are player-wide presentation metadata, shared across branches and timeline
// views. They never enter snapshots, command logs, fingerprints, decision context,
// or events. A solved channel preview cannot itself restore simulated habitat.
// Absence remains absence so older uncustomized exports stay byte-identical.
function withPersonalization(history, personalization) {
  const result = { ...history, ...presentationMetadata(history) };
  if (Object.keys(personalization.people).length || Object.keys(personalization.homes).length) result.personalization = validatePersonalization(personalization, history);
  else delete result.personalization;
  return complete(result);
}

/** Use 'original' to remove a character's color override. */
export function setPersonStyle(history, id, color) {
  if (typeof id !== 'string' || !archiveHasPerson(history, id)) fail('Choose an existing character before changing their colors.');
  choice(color, [...STYLE_COLOR_IDS, 'original'], 'Person color');
  const metadata = presentationMetadata(history);
  const existing = metadata.personalization ?? { version: 1, people: {}, homes: {} };
  const people = { ...existing.people };
  const style = { ...people[id] };
  if (color === 'original') delete style.color;
  else style.color = color;
  if (Object.keys(style).length) people[id] = style;
  else delete people[id];
  return withPersonalization(history, { ...existing, people });
}

/** 'none' removes only the accessory; the character's color remains unchanged. */
export function setPersonAccessory(history, id, accessory) {
  if (typeof id !== 'string' || !archiveHasPerson(history, id)) fail('Choose an existing character before changing their accessories.');
  choice(accessory, PERSON_ACCESSORY_IDS, 'Person accessory');
  const metadata = presentationMetadata(history);
  const existing = metadata.personalization ?? { version: 1, people: {}, homes: {} };
  const people = { ...existing.people }, style = { ...people[id] };
  if (accessory === 'none') delete style.accessory;
  else style.accessory = accessory;
  if (Object.keys(style).length) people[id] = style;
  else delete people[id];
  return withPersonalization(history, { ...existing, people });
}

/** Supply both fields; 'original' clears color, and 'none' clears decoration. */
export function setHomeStyle(history, id, style) {
  if (typeof id !== 'string' || !archiveHasHome(history, id)) fail('Choose an existing home before changing its appearance.');
  record(style, ['color', 'decoration'], 'Home appearance');
  choice(style.color, [...STYLE_COLOR_IDS, 'original'], 'Home color');
  choice(style.decoration, HOME_DECORATION_IDS, 'Home decoration');
  const metadata = presentationMetadata(history);
  const existing = metadata.personalization ?? { version: 1, people: {}, homes: {} };
  const homes = { ...existing.homes };
  if (style.color === 'original' && style.decoration === 'none') delete homes[id];
  else homes[id] = { ...(style.color !== 'original' ? { color: style.color } : {}), decoration: style.decoration };
  return withPersonalization(history, { ...existing, homes });
}

/** Completion is reported by the UI's actual actions; persistence never infers it. */
export function setGuideProgress(history, progress) {
  record(progress, ['completed', 'dismissed'], 'Guide progress update');
  const guide = validateGuide({ version: 1, completed: progress.completed, dismissed: progress.dismissed });
  return complete({ ...history, ...presentationMetadata(history), guide });
}

/** Looking at an untouched courtyard must not modify a legacy export. */
export function getNeighborhood(history) {
  return Object.hasOwn(history, 'neighborhood') ? validateNeighborhood(history.neighborhood) : defaultNeighborhood();
}

/** Player activities belong to the whole archive; callers separately enforce live-view interaction. */
export function setNeighborhood(history, action) {
  const current = presentationMetadata(history);
  const neighborhood = reduceNeighborhood(current.neighborhood ?? defaultNeighborhood(), action);
  return complete({ ...history, ...current, neighborhood });
}

function metadata(history) {
  if (history.format !== FORMAT || history.saveVersion !== SAVE_VERSION) fail('This save is incompatible with save format 1.');
  simulationVersion(history.simulationVersion);
  const settings = initialConfig(history.initialConfig);
  if (!Array.isArray(history.branches) || history.branches.length < 1 || history.branches.length > HISTORY_LIMITS.branches) fail('The save has an invalid branch count.');
  if (history.nextBranchId !== history.branches.length + 1) fail('The next branch identity is inconsistent.');
  if (totalCommands(history) > HISTORY_LIMITS.commands) fail('The save exceeds the retained command limit.');
  activeBranch(history);
  if (!Array.isArray(history.followed) || history.followed.length > HISTORY_LIMITS.followed || new Set(history.followed).size !== history.followed.length) fail('The follow list is invalid or too large.');
  for (const id of history.followed) {
    shortText(id, 100, 'Followed identity');
    if (!history.branches.some(branch => getEntity(branch.head, id))) fail(`Followed identity “${id}” does not exist in this history.`);
  }
  choice(history.attention, ['quiet', 'balanced', 'attentive'], 'Attention');
  record(history.session, ['lastSeenTick'], 'Session');
  integer(history.session.lastSeenTick, 0, HISTORY_LIMITS.ticks, 'Last seen day');
  presentationMetadata(history);
  return settings;
}

function portable(history) {
  const settings = metadata(history);
  const configurationKey = trustKey(settings, history.simulationVersion);
  for (const [index, branch] of history.branches.entries()) {
    if (trustedBranches.get(branch) !== configurationKey) fail('History was changed outside the simulation. Export was stopped to protect recorded state.');
    if (branch.id !== `b${index + 1}`) fail('Branch identities must be unique and ordered.');
    validateLineage(branch, history.branches.slice(0, index));
  }
  return {
    format: FORMAT, saveVersion: SAVE_VERSION, simulationVersion: history.simulationVersion, initialConfig: settings,
    activeBranchId: history.activeBranchId, nextBranchId: history.nextBranchId,
    branches: history.branches.map(branch => ({ id: branch.id, name: branch.name, parentId: branch.parentId, forkTick: branch.forkTick, forkCommandIndex: branch.forkCommandIndex, commands: branch.commands, headDigest: digest(branch.head) })),
    followed: [...history.followed], attention: history.attention, session: { lastSeenTick: history.session.lastSeenTick },
    ...presentationMetadata(history),
  };
}

export function serializeHistory(history) {
  const text = JSON.stringify(portable(history));
  if (new TextEncoder().encode(text).byteLength > HISTORY_LIMITS.exportBytes) limit('This world has reached its portable-save size limit.');
  return text;
}

function validateTree(value, depth = 0, budget = { nodes: 0 }) {
  if (++budget.nodes > 35000 || depth > 24) fail('The save contains excessive nested data.');
  if (typeof value === 'number' && !Number.isFinite(value)) fail('The save contains a non-finite number.');
  if (typeof value === 'string' && value.length > 12000) fail('The save contains excessive text.');
  if (value && typeof value === 'object') {
    if (Array.isArray(value) && value.length > HISTORY_LIMITS.commands) fail('The save contains an excessive list.');
    for (const key of Object.keys(value)) {
      if (dangerousKeys.has(key)) fail('The save contains a prohibited object property.');
      validateTree(value[key], depth + 1, budget);
    }
  }
}

function validateLineage(branch, branches) {
  if (branch.id === 'b1') {
    if (branch.parentId !== null || branch.forkTick !== 0 || branch.forkCommandIndex !== 0) fail('The first history has invalid ancestry.');
    return;
  }
  const parent = branches.find(item => item.id === branch.parentId);
  if (!parent || branch.forkTick > parent.head.tick || branch.forkCommandIndex > parent.commands.length) fail('A branch refers to invalid source history.');
  const inherited = commandPrefix(parent.commands.slice(0, branch.forkCommandIndex), branch.forkTick).commands;
  if (inherited.length !== branch.forkCommandIndex || canonical(inherited) !== canonical(branch.commands.slice(0, branch.forkCommandIndex))) fail('A branch does not preserve the recorded source history.');
  const last = inherited.at(-1);
  const endTick = last ? last.atTick + (last.command.type === 'advance' ? last.command.days : 0) : 0;
  if (endTick !== branch.forkTick) fail('The branch point does not match its inherited history.');
}

export function parseHistory(text) {
  if (typeof text !== 'string' || text.length > HISTORY_LIMITS.exportBytes || new TextEncoder().encode(text).byteLength > HISTORY_LIMITS.exportBytes) fail('The save is too large or is not text (4 MB maximum).');
  let data;
  try { data = JSON.parse(text); } catch { fail('The save is not valid JSON. Your current world has not been changed.'); }
  validateTree(data);
  record(data, ['format', 'saveVersion', 'simulationVersion', 'initialConfig', 'activeBranchId', 'nextBranchId', 'branches', 'followed', 'attention', 'session'], 'Save', ['personalization', 'guide', 'neighborhood']);
  if (data.format !== FORMAT || data.saveVersion !== SAVE_VERSION) fail('This save is incompatible with save format 1.');
  const version = simulationVersion(data.simulationVersion);
  record(data.initialConfig, ['seed', 'tier', 'climate', 'temperament', 'density'], 'Initial world settings');
  const settings = initialConfig(data.initialConfig);
  if (!Array.isArray(data.branches) || data.branches.length < 1 || data.branches.length > HISTORY_LIMITS.branches) fail('The save has an invalid branch count.');
  const genesis = freeze(createWorld({ ...settings, engineVersion: version }));
  const branches = [];
  let count = 0;
  // Protected invariant: imported heads and checkpoints are never authoritative.
  // Every accepted world is rebuilt from a validated genesis and command log.
  // A snapshot, fingerprint mismatch, impossible action, or broken ancestry
  // rejects the whole candidate before the caller can replace its current world.
  for (let branchIndex = 0; branchIndex < data.branches.length; branchIndex++) {
    const entry = data.branches[branchIndex];
    record(entry, ['id', 'name', 'parentId', 'forkTick', 'forkCommandIndex', 'commands', 'headDigest'], 'Branch');
    if (entry.id !== `b${branchIndex + 1}`) fail('Branch identities must be unique and ordered.');
    shortText(entry.name, 64, 'Branch name');
    integer(entry.forkTick, 0, HISTORY_LIMITS.ticks, 'Fork day');
    if (!Array.isArray(entry.commands)) fail('Branch commands must be a list.');
    count += entry.commands.length;
    if (count > HISTORY_LIMITS.commands) fail('The save exceeds the retained command limit.');
    integer(entry.forkCommandIndex, 0, entry.commands.length, 'Inherited command count');
    if (typeof entry.headDigest !== 'string' || !/^[0-9a-f]{32}$/u.test(entry.headDigest)) fail('The saved world fingerprint is invalid.');
    let world = genesis;
    const checkpoints = [{ commandIndex: 0, world }];
    const commands = [];
    for (let index = 0; index < entry.commands.length; index++) {
      const raw = entry.commands[index];
      record(raw, ['atTick', 'command'], 'Command record');
      if (raw.atTick !== world.tick) fail('A command is recorded at the wrong simulation day.');
      const command = validateCommand(raw.command);
      if (command.type === 'advance' && world.tick + command.days > HISTORY_LIMITS.ticks) fail('The save exceeds its simulation horizon.');
      try { world = freeze(execute(world, command)); } catch (error) { fail(`The saved command cannot be replayed: ${error.message}`); }
      commands.push(freeze({ atTick: raw.atTick, command }));
      if ((index + 1) % CHECKPOINT_EVERY === 0) checkpoints.push({ commandIndex: index + 1, world });
    }
    if (digest(world) !== entry.headDigest) fail('The saved state does not match deterministic replay. The file may be damaged or from a different simulation.');
    const branch = { id: entry.id, name: entry.name, parentId: entry.parentId, forkTick: entry.forkTick, forkCommandIndex: entry.forkCommandIndex, commands, checkpoints, head: world };
    validateLineage(branch, branches);
    branches.push(trust(branch, settings, version));
  }
  const history = { format: FORMAT, saveVersion: SAVE_VERSION, simulationVersion: version, initialConfig: settings, activeBranchId: data.activeBranchId, nextBranchId: data.nextBranchId, branches, followed: data.followed, attention: data.attention, session: data.session };
  if (Object.hasOwn(data, 'personalization')) history.personalization = validatePersonalization(data.personalization, history);
  if (Object.hasOwn(data, 'guide')) history.guide = validateGuide(data.guide);
  if (Object.hasOwn(data, 'neighborhood')) history.neighborhood = validateNeighborhood(data.neighborhood);
  metadata(history);
  return complete(history);
}

function cachedParse(storage, text) {
  if (!text) return null;
  let cache = slotCache.get(storage);
  if (!cache) { cache = new Map(); slotCache.set(storage, cache); }
  if (cache.has(text)) return cache.get(text);
  const history = parseHistory(text);
  if (cache.size >= 3) cache.clear();
  cache.set(text, history);
  return history;
}
function remember(storage, text, history) {
  let cache = slotCache.get(storage);
  if (!cache) { cache = new Map(); slotCache.set(storage, cache); }
  if (cache.size >= 3) cache.clear();
  // UI preferences may arrive via an ordinary object spread. Keep the cached
  // saved value independent of later caller edits, just like the stored bytes.
  cache.set(text, complete({
    format: FORMAT, saveVersion: SAVE_VERSION, simulationVersion: history.simulationVersion,
    initialConfig: history.initialConfig, activeBranchId: history.activeBranchId,
    nextBranchId: history.nextBranchId, branches: [...history.branches],
    followed: [...history.followed], attention: history.attention,
    session: { lastSeenTick: history.session.lastSeenTick },
    ...presentationMetadata(history),
  }));
}
function cleanup(storage) { try { storage.removeItem(SAVE_KEYS.staging); } catch { /* A leftover verified stage is safe. */ } }

export function saveHistory(storage, history) {
  let existing = null;
  let currentWriteAttempted = false;
  try {
    const text = serializeHistory(history);
    existing = storage.getItem(SAVE_KEYS.current);
    let previousIsValid = false;
    if (existing) { try { previousIsValid = Boolean(cachedParse(storage, existing)); } catch { /* Never overwrite the recovery slot with corrupt data. */ } }
    // Protected invariant: write and read back a complete candidate before
    // replacing current; preserve a validated previous slot first. Quota errors
    // never require deleting the only valid save to make room for a new one.
    storage.setItem(SAVE_KEYS.staging, text);
    if (storage.getItem(SAVE_KEYS.staging) !== text) fail('The staged save could not be verified.');
    if (previousIsValid) {
      storage.setItem(SAVE_KEYS.previous, existing);
      if (storage.getItem(SAVE_KEYS.previous) !== existing) fail('The recovery copy could not be verified.');
    }
    currentWriteAttempted = true;
    storage.setItem(SAVE_KEYS.current, text);
    if (storage.getItem(SAVE_KEYS.current) !== text) fail('The completed save could not be verified.');
    remember(storage, text, history);
    cleanup(storage);
    return { ok: true };
  } catch (error) {
    let rollbackFailed = false;
    if (currentWriteAttempted) {
      // A successful write followed by a failed readback must not make a
      // rejected import become the next reload's committed world. Restore the
      // captured current slot; the previous valid slot remains independent.
      // Arbitrary storage failures can also prevent rollback: report that
      // uncertainty explicitly, never claim an atomic transaction we lack.
      try {
        if (existing === null) storage.removeItem(SAVE_KEYS.current);
        else storage.setItem(SAVE_KEYS.current, existing);
        if (storage.getItem(SAVE_KEYS.current) !== existing) rollbackFailed = true;
      } catch {
        try { rollbackFailed = storage.getItem(SAVE_KEYS.current) !== existing; } catch { rollbackFailed = true; }
      }
    }
    cleanup(storage);
    const uncertainty = rollbackFailed ? ' Storage also prevented verified rollback; reopening may load the attempted save. Any separate previous-valid slot is retained.' : ' Any previous valid save is retained.';
    return { ok: false, ...(rollbackFailed ? { commitUncertain: true } : {}), error: `Autosave failed: ${error.message || 'storage is unavailable'}.${uncertainty} Export your world to keep this session.` };
  }
}

export function loadHistory(storage) {
  const failures = [];
  let found = false;
  for (const [slot, key] of Object.entries(SAVE_KEYS)) {
    let text;
    try { text = storage.getItem(key); } catch (error) { return { history: null, error: `Saved worlds could not be read: ${error.message}. You can still create or import a world.` }; }
    if (!text) continue;
    found = true;
    try {
      const history = cachedParse(storage, text);
      return { history, error: slot === 'current' ? null : `Recovered the ${slot === 'previous' ? 'previous valid save' : 'verified staged save'}. ${failures.join(' ')}`.trim() };
    } catch (error) { failures.push(`${slot}: ${error.message}`); }
  }
  return { history: null, error: found ? `No saved world passed validation. ${failures.join(' ')} Your saved files have been left intact.` : null };
}
