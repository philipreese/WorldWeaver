import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, advance, intervene, getInterventions, getEntity, entityLabel } from '../src/sim/world.js';
import { createHistory, currentWorld, applyCommand, worldAt, forkHistory, selectBranch, serializeHistory, parseHistory, saveHistory, loadHistory, setPersonStyle, setHomeStyle, setGuideProgress, HISTORY_LIMITS, SAVE_KEYS } from '../src/persistence/history.js';
import { STYLE_COLORS, resolveStyleColor, PERSONALIZATION_LIMITS } from '../src/customization.js';

class MemoryStorage {
  constructor() { this.data = new Map(); this.failAt = null; this.corruptAt = null; }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) {
    if (this.failAt === key) throw new Error('QuotaExceededError: test storage full');
    this.data.set(key, this.corruptAt === key ? 'damaged write' : String(value));
  }
  removeItem(key) { this.data.delete(key); }
}
const step = (history, days) => applyCommand(history, { type: 'advance', days });
function availableIntervention(world, kind = 'open-route') {
  const action = getInterventions(world).find(item => item.available && item.kind === kind);
  assert.ok(action, `Test world must offer ${kind}`);
  return { kind: action.kind, targetId: action.targetId };
}
function altered(history, edit) {
  const data = JSON.parse(serializeHistory(history));
  edit(data);
  return JSON.stringify(data);
}

// Captured from the executable Tier 1 milestone (67d6731), before Tier 2 life
// behavior, by running its source archive independently of the working tree.
// Keep this independent of createHistory so replay drift cannot bless itself.
const TIER1_MILESTONE_SAVE = {
  format: 'worldweaver', saveVersion: 1, simulationVersion: '1.0.0',
  initialConfig: { seed: 8417, tier: 1, climate: 'temperate', temperament: 'careful', density: 'balanced' },
  activeBranchId: 'b2', nextBranchId: 3,
  branches: [
    { id: 'b1', name: 'First history', parentId: null, forkTick: 0, forkCommandIndex: 0,
      commands: [
        { atTick: 0, command: { type: 'advance', days: 2 } },
        { atTick: 2, command: { type: 'intervene', intervention: { kind: 'open-route', targetId: 'r-hearth-lattice' } } },
        { atTick: 2, command: { type: 'advance', days: 50 } },
      ], headDigest: '3ec54af046f7187c0a2e6c1697166450' },
    { id: 'b2', name: 'Before the opening', parentId: 'b1', forkTick: 1, forkCommandIndex: 1,
      commands: [
        { atTick: 0, command: { type: 'advance', days: 1 } },
        { atTick: 1, command: { type: 'advance', days: 51 } },
      ], headDigest: '48d3ac526ef68af6753184b8591b3f9a' },
  ],
  followed: ['s-hearth', 'c-nera'], attention: 'balanced', session: { lastSeenTick: 0 },
};

test('the committed Tier 1 milestone save remains exactly replayable after Tier 2 additions', () => {
  const text = JSON.stringify(TIER1_MILESTONE_SAVE);
  const restored = parseHistory(text);
  assert.equal(restored.branches[0].head.flags.archiveResolved, 'exchange');
  assert.equal(restored.branches[1].head.flags.archiveResolved, 'raise');
  assert.equal(serializeHistory(restored), text);
});

test('commands and snapshots are immutable; unchanged input replays exactly', () => {
  const initial = createHistory();
  const before = serializeHistory(initial);
  const advanced = step(initial, 24);
  assert.equal(currentWorld(initial).tick, 0);
  assert.equal(serializeHistory(initial), before);
  assert.deepEqual(currentWorld(advanced), advance(createWorld(), 24));
  assert.throws(() => { currentWorld(advanced).settlements[0].food = -1; }, TypeError);
  assert.deepEqual(currentWorld(step(initial, 24)), currentWorld(advanced));
});

test('arbitrary timeline days split long advances without running later history', () => {
  let history = step(createHistory(), 31);
  history = step(history, 39);
  for (const tick of [0, 1, 3, 4, 17, 30, 31, 32, 69, 70]) {
    assert.deepEqual(worldAt(history, tick), advance(createWorld(), tick), `day ${tick}`);
  }
  assert.throws(() => worldAt(history, 71), /Timeline day/);
  assert.throws(() => worldAt(history, 2.5), /integer/);
});

test('timeline includes decisions and interventions at the selected day', () => {
  let history = step(createHistory(), 1);
  const command = availableIntervention(currentWorld(history));
  history = applyCommand(history, { type: 'intervene', intervention: command });
  const expected = currentWorld(history);
  history = step(history, 12);
  assert.deepEqual(worldAt(history, 1), expected);
  assert.deepEqual(worldAt(history, 0), createWorld());
});

test('checkpoints accelerate reconstruction without changing earlier states', () => {
  let history = createHistory();
  for (let day = 0; day < 45; day++) history = step(history, 1);
  assert.deepEqual(history.branches[0].checkpoints.map(item => item.commandIndex), [0, 20, 40]);
  for (const tick of [19, 20, 21, 39, 40, 41, 45]) assert.deepEqual(worldAt(history, tick), advance(createWorld(), tick));
});

test('forking inside a command preserves the source future and supports independent divergence', () => {
  const source = step(createHistory(), 28);
  const sourceBytes = serializeHistory(source);
  let branched = forkHistory(source, 1, 'Open the passage');
  assert.equal(branched.activeBranchId, 'b2');
  assert.equal(currentWorld(branched).tick, 1);
  assert.deepEqual(branched.branches[1].commands, [{ atTick: 0, command: { type: 'advance', days: 1 } }]);
  const command = availableIntervention(currentWorld(branched));
  branched = applyCommand(branched, { type: 'intervene', intervention: command });
  branched = step(branched, 27);
  assert.equal(serializeHistory(source), sourceBytes);
  assert.deepEqual(currentWorld(selectBranch(branched, 'b1')), currentWorld(source));
  assert.notDeepEqual(currentWorld(branched), currentWorld(source));
  assert.deepEqual(currentWorld(parseHistory(serializeHistory(branched))), currentWorld(branched));
});

test('fork metadata preserves the exact source prefix when parent receives another same-day action', () => {
  let history = step(createHistory(), 1);
  history = forkHistory(history, 1, 'Before the opening');
  const branchBefore = currentWorld(history);
  history = selectBranch(history, 'b1');
  history = applyCommand(history, { type: 'intervene', intervention: availableIntervention(currentWorld(history)) });
  const restored = parseHistory(serializeHistory(history));
  assert.deepEqual(currentWorld(selectBranch(restored, 'b2')), branchBefore);
  assert.notDeepEqual(worldAt(restored, 1, 'b1'), worldAt(restored, 1, 'b2'));
});

test('portable export reconstructs heads and checkpoints instead of accepting serialized snapshots', () => {
  let history = createHistory();
  for (let index = 0; index < 42; index++) history = step(history, 1);
  const text = serializeHistory(history);
  const portable = JSON.parse(text);
  assert.equal(Object.hasOwn(portable.branches[0], 'head'), false);
  assert.equal(Object.hasOwn(portable.branches[0], 'checkpoints'), false);
  const restored = parseHistory(text);
  assert.deepEqual(restored, history);
  assert.equal(serializeHistory(restored), text);
  assert.throws(() => parseHistory(altered(history, save => { save.branches[0].head = { tick: 42 }; })), /unsupported field/);
});

test('Tier and alternate creation settings persist through deterministic replay', () => {
  const history = step(createHistory({ tier: 2, seed: 3721, climate: 'wet', temperament: 'communal', density: 'dense' }), 120);
  assert.deepEqual(currentWorld(parseHistory(serializeHistory(history))), currentWorld(history));
});

// These claims describe the shipped authored episode; v1 must retain it exactly.
function developedTier2History() {
  let history = createHistory({ tier: 2 }, '1.0.0');
  history = applyCommand(history, { type: 'intervene', intervention: availableIntervention(currentWorld(history)) });
  history = step(history, 4);
  history = applyCommand(history, { type: 'intervene', intervention: availableIntervention(currentWorld(history), 'offer-refuge') });
  return step(history, 56);
}

test('Tier 2 round-trip retains distinct forms, a mixed community, divergent cultures, power effects and institution collapse', () => {
  const history = developedTier2History();
  const world = currentWorld(history);
  const hearth = world.settlements.find(item => item.id === 's-hearth');
  const lattice = world.settlements.find(item => item.id === 's-lattice');
  const choir = world.settlements.find(item => item.id === 's-choir');
  const institution = world.institutions.find(item => item.id === 'i-confluence');
  assert.ok(hearth.population > 0 && hearth.synthetics > 0 && hearth.collective > 0, 'Refuge must create an actual mixed settlement.');
  assert.ok(lattice.synthetics > 0 && choir.collective > 0);
  assert.ok(world.events.some(item => item.kind === 'synthetic-replication'));
  assert.ok(world.events.some(item => item.kind === 'collective-expansion'));
  assert.ok(hearth.structures.some(item => item.form === 'synthetic'));
  assert.ok(hearth.structures.some(item => item.form === 'collective'));
  assert.notEqual(hearth.cultureId, lattice.cultureId, 'Organic communities retain different living practices.');
  assert.ok(world.cultures.find(item => item.id === lattice.cultureId)?.form === 'organic');
  assert.equal(institution.status, 'collapsed');
  assert.ok(institution.history.length >= 2);
  assert.ok(hearth.structures.some(item => item.id === 'k-hearth-conduit' && item.abandonedAt == null));
  assert.equal(world.power.id, 'p-undersong');
  assert.equal(world.power.active, true);
  assert.ok(world.power.lastActAt > world.power.emergedAt);
  assert.ok(world.flags.powerActs >= 3);
  const emergence = world.events.find(item => item.id === world.power.eventId);
  assert.equal(emergence.kind, 'power-emerged');
  const effects = world.events.filter(item => item.kind === 'power-redistribution');
  assert.ok(effects.length >= 3);
  assert.ok(effects.every(item => item.causes.includes(emergence.id) && item.observed.length > 1 && item.interpretations.length >= 3));
  for (const interpretation of world.power.interpretations) assert.ok(world.cultures.some(culture => culture.id === interpretation.cultureId));

  const restored = parseHistory(serializeHistory(history));
  assert.deepEqual(currentWorld(restored), world);
  const before = worldAt(restored, world.power.emergedAt - 1);
  const after = worldAt(restored, world.power.emergedAt);
  assert.equal(before.power, null);
  assert.equal(after.power.eventId, emergence.id);
  assert.ok(after.settlements.find(item => item.id === 's-hearth').energy > before.settlements.find(item => item.id === 's-hearth').energy, 'The restored emergence has a real material effect.');
  assert.equal(worldAt(restored, 4).settlements.find(item => item.id === 's-hearth').synthetics, 0, 'Offering refuge alone does not dictate a move.');
  assert.equal(worldAt(restored, 5).settlements.find(item => item.id === 's-hearth').synthetics, 2);
});

test('forks immediately before power emergence preserve the source and replay unchanged or altered futures exactly', () => {
  const source = developedTier2History();
  const sourceWorld = currentWorld(source);
  const originalBytes = serializeHistory(source);
  const forkDay = sourceWorld.power.emergedAt - 1;
  let repeated = forkHistory(source, forkDay, 'Before the answering current');
  assert.equal(currentWorld(repeated).power, null);
  repeated = step(repeated, sourceWorld.tick - forkDay);
  assert.deepEqual(currentWorld(repeated), sourceWorld, 'Identical inputs across a split advance reproduce the whole Tier 2 future.');

  let changed = forkHistory(repeated, forkDay, 'Water before the answer');
  changed = applyCommand(changed, { type: 'intervene', intervention: availableIntervention(currentWorld(changed), 'restore-habitat') });
  changed = step(changed, sourceWorld.tick - forkDay);
  assert.notDeepEqual(currentWorld(changed), sourceWorld);
  assert.equal(serializeHistory(source), originalBytes);
  assert.deepEqual(currentWorld(selectBranch(changed, 'b1')), sourceWorld);
  const restored = parseHistory(serializeHistory(changed));
  for (const branch of changed.branches) {
    assert.deepEqual(currentWorld(selectBranch(restored, branch.id)), branch.head);
    for (const day of [0, 4, 5, forkDay, forkDay + 1, 22, 42, 60]) {
      assert.deepEqual(worldAt(restored, day, branch.id), worldAt(changed, day, branch.id), `${branch.id}, day ${day}`);
    }
  }
});

test('cold storage reload preserves Tier 2 follows, pre-emergence branches and preferences without cache or elapsed time', () => {
  let history = developedTier2History();
  history = { ...history, followed: ['p-undersong', 'i-confluence', 'culture-carriers', 'k-hearth-refuge-root'], attention: 'attentive', session: { lastSeenTick: 59 } };
  history = forkHistory(history, 2, 'Before the shared channel');
  assert.equal(currentWorld(history).power, null);
  const storage = new MemoryStorage();
  assert.equal(saveHistory(storage, history).ok, true);
  const coldStorage = new MemoryStorage();
  coldStorage.data = new Map(storage.data);
  const restored = loadHistory(coldStorage);
  assert.equal(restored.error, null);
  assert.deepEqual(restored.history, history);
  assert.equal(currentWorld(restored.history).tick, 2);
  assert.equal(currentWorld(selectBranch(restored.history, 'b1')).tick, 60);
});

test('presentation metadata does not change snapshots, fingerprints, commands or later choices', () => {
  const source = developedTier2History();
  const original = serializeHistory(source);
  let styled = setPersonStyle(source, 'c-nera', 'rose');
  styled = setHomeStyle(styled, 'k-hearth-table', { color: 'jade', decoration: 'planter' });
  styled = setGuideProgress(styled, { completed: ['style', 'meet'], dismissed: false });
  assert.equal(currentWorld(styled), currentWorld(source));
  assert.equal(styled.branches, source.branches);
  assert.equal(serializeHistory(source), original);
  const portable = JSON.parse(serializeHistory(styled));
  assert.deepEqual(portable.branches, JSON.parse(original).branches);
  assert.deepEqual(portable.guide.completed, ['meet', 'style']);
  assert.deepEqual(currentWorld(step(styled, 12)), currentWorld(step(source, 12)));
  assert.deepEqual(worldAt(styled, 1), worldAt(source, 1));
  assert.throws(() => { styled.personalization.people['c-nera'].color = 'amber'; }, TypeError);
});

test('cosmetics follow stable IDs across archive branches and survive export plus a cold reload', () => {
  let history = developedTier2History();
  history = forkHistory(history, 2, 'A quieter beginning');
  history = setPersonStyle(history, 'c-nera', 'lilac');
  history = setHomeStyle(history, 'k-hearth-table', { color: 'original', decoration: 'lantern' });
  history = setGuideProgress(history, { completed: ['meet', 'style', 'watch', 'why'], dismissed: true });
  assert.deepEqual(history.personalization.homes['k-hearth-table'], { decoration: 'lantern' });
  assert.deepEqual(selectBranch(history, 'b1').personalization, history.personalization);
  assert.deepEqual(parseHistory(serializeHistory(history)), history);
  const storage = new MemoryStorage();
  assert.equal(saveHistory(storage, history).ok, true);
  const cold = new MemoryStorage();
  cold.data = new Map(storage.data);
  const loaded = loadHistory(cold);
  assert.equal(loaded.error, null);
  assert.deepEqual(loaded.history, history);
  assert.equal(currentWorld(loaded.history).tick, 2);
  assert.equal(currentWorld(selectBranch(loaded.history, 'b1')).tick, 60);
});

test('original-color and no-decoration reset removes overrides without adding fields to legacy exports', () => {
  const original = JSON.stringify(TIER1_MILESTONE_SAVE);
  let history = parseHistory(original);
  assert.equal(Object.hasOwn(history, 'personalization'), false);
  assert.equal(Object.hasOwn(history, 'guide'), false);
  history = setPersonStyle(history, 'c-nera', 'amber');
  history = setHomeStyle(history, 'k-hearth-table', { color: 'sky', decoration: 'bunting' });
  history = setPersonStyle(history, 'c-nera', 'original');
  assert.equal(Object.hasOwn(history.personalization.people, 'c-nera'), false);
  history = setHomeStyle(history, 'k-hearth-table', { color: 'original', decoration: 'none' });
  assert.equal(Object.hasOwn(history, 'personalization'), false);
  assert.equal(serializeHistory(history), original);
  assert.equal(serializeHistory(setPersonStyle(history, 'c-nera', 'original')), original);
});

test('setters require real character/home identities, exact fields and allowlisted presentation values', () => {
  const history = createHistory({ tier: 2 });
  const before = serializeHistory(history);
  assert.throws(() => setPersonStyle(history, 's-hearth', 'amber'), /existing character/);
  assert.throws(() => setPersonStyle(history, 'imagined-person', 'amber'), /existing character/);
  assert.throws(() => setPersonStyle(history, 'c-nera', '#ff0000'), /Person color/);
  assert.throws(() => setPersonStyle(history, 'c-nera', { color: 'amber' }), /Person color/);
  assert.throws(() => setHomeStyle(history, 'k-hearth-archive', { color: 'amber', decoration: 'none' }), /existing home/);
  assert.throws(() => setHomeStyle(history, 'c-nera', { color: 'amber', decoration: 'none' }), /existing home/);
  assert.throws(() => setHomeStyle(history, 'k-hearth-table', { color: 'amber', decoration: 'turret' }), /Home decoration/);
  assert.throws(() => setHomeStyle(history, 'k-hearth-table', { color: 'amber', decoration: 'none', population: 900 }), /unsupported field/);
  assert.throws(() => setHomeStyle(history, 'k-hearth-table', { decoration: 'none' }), /missing/);
  assert.throws(() => setGuideProgress(history, { completed: ['combat'], dismissed: false }), /Guide step/);
  assert.throws(() => setGuideProgress(history, { completed: ['meet', 'meet'], dismissed: false }), /duplicates/);
  assert.throws(() => setGuideProgress(history, { completed: [], dismissed: 'yes' }), /true or false/);
  assert.throws(() => setGuideProgress(history, { completed: [], dismissed: false, award: 10 }), /unsupported field/);
  assert.equal(serializeHistory(history), before);
});

test('invalid presentation imports reject unknown identities, arbitrary objects, extra fields, versions and unbounded maps', () => {
  let history = setPersonStyle(createHistory(), 'c-nera', 'amber');
  history = setHomeStyle(history, 'k-hearth-table', { color: 'ivory', decoration: 'lantern' });
  history = setGuideProgress(history, { completed: ['meet'], dismissed: false });
  const mutations = [
    save => { save.personalization.version = 2; },
    save => { save.personalization.people = []; },
    save => { save.personalization.people['unknown-person'] = { color: 'amber' }; },
    save => { save.personalization.people['c-nera'] = { color: 'original' }; },
    save => { save.personalization.people['c-nera'] = { color: { url: 'arbitrary' } }; },
    save => { save.personalization.people['c-nera'].motives = { care: 100 }; },
    save => { save.personalization.homes['k-hearth-archive'] = { decoration: 'none' }; },
    save => { save.personalization.homes['k-hearth-table'].decoration = 'tower'; },
    save => { save.personalization.homes['k-hearth-table'].color = '#ffffff'; },
    save => { save.personalization.homes['k-hearth-table'].x = 12; },
    save => { save.personalization.people = Object.fromEntries(Array.from({ length: PERSONALIZATION_LIMITS.people + 1 }, (_, index) => [`c-${index}`, { color: 'amber' }])); },
    save => { save.personalization.homes = Object.fromEntries(Array.from({ length: PERSONALIZATION_LIMITS.homes + 1 }, (_, index) => [`home-${index}`, { decoration: 'none' }])); },
    save => { Object.defineProperty(save.personalization.people, '__proto__', { value: { color: 'amber' }, enumerable: true }); },
    save => { save.guide.version = 2; },
    save => { save.guide.completed = ['meet', 'unknown']; },
    save => { save.guide.completed = ['meet', 'meet']; },
    save => { save.guide.dismissed = 1; },
    save => { save.guide.completeAll = true; },
  ];
  const before = serializeHistory(history);
  for (const mutate of mutations) assert.throws(() => parseHistory(altered(history, mutate)));
  assert.equal(serializeHistory(history), before);
});

test('guide progress is explicit, immutable, resumable and independent of world evolution', () => {
  const beginning = createHistory({ tier: 2 });
  const completed = ['why'];
  const guided = setGuideProgress(beginning, { completed, dismissed: false });
  completed.push('meet');
  assert.deepEqual(guided.guide.completed, ['why'], 'The caller owns its input list; no other steps are inferred.');
  const advanced = step(guided, 60);
  assert.deepEqual(advanced.guide, guided.guide);
  const dismissed = setGuideProgress(advanced, { completed: advanced.guide.completed, dismissed: true });
  const restored = parseHistory(serializeHistory(dismissed));
  assert.deepEqual(restored.guide, { version: 1, completed: ['why'], dismissed: true });
  assert.equal(currentWorld(dismissed), currentWorld(advanced));
  assert.deepEqual(currentWorld(advanced), currentWorld(step(beginning, 60)));
});

test('failed metadata-only saves preserve the committed appearance and guide state', () => {
  const storage = new MemoryStorage();
  let original = setPersonStyle(createHistory(), 'c-nera', 'jade');
  original = setGuideProgress(original, { completed: ['meet'], dismissed: false });
  assert.equal(saveHistory(storage, original).ok, true);
  let attempted = setPersonStyle(original, 'c-nera', 'rose');
  attempted = setGuideProgress(attempted, { completed: ['meet', 'style'], dismissed: true });
  storage.failAt = SAVE_KEYS.current;
  assert.equal(saveHistory(storage, attempted).ok, false);
  const cold = new MemoryStorage();
  cold.data = new Map(storage.data);
  assert.deepEqual(loadHistory(cold).history, original);
  assert.deepEqual(currentWorld(attempted), currentWorld(original));
});

test('shared cosmetic palette is bounded, immutable and resolves original to no override', () => {
  assert.equal(STYLE_COLORS.length, 6);
  assert.equal(resolveStyleColor('original'), null);
  assert.equal(resolveStyleColor('unrecognized'), null);
  for (const color of STYLE_COLORS) {
    assert.equal(resolveStyleColor(color.id), color);
    for (const field of ['coat', 'shade', 'accent', 'trim']) assert.match(color[field], /^#[0-9a-f]{6}$/);
    assert.equal(Object.isFrozen(color), true);
  }
});

test('invalid imports fail closed across versions, state, commands, references and bounds', () => {
  const history = step(createHistory(), 12);
  const mutations = [
    save => { save.simulationVersion = '9.0.0'; },
    save => { save.saveVersion = 2; },
    save => { save.initialConfig.seed = -1; },
    save => { save.initialConfig.climate = 'unknown'; },
    save => { save.branches[0].headDigest = '0'.repeat(32); },
    save => { save.branches[0].commands[0].atTick = 1; },
    save => { save.branches[0].commands[0].command.days = 1.5; },
    save => { save.branches[0].commands[0].command.days = 6001; },
    save => { save.branches[0].commands[0].command.type = 'set-world'; },
    save => { save.branches[0].commands[0].command = { type: 'intervene', intervention: { kind: 'open-route', targetId: 'missing-route' } }; },
    save => { save.branches[0].id = 'b999'; },
    save => { save.branches[0].parentId = 'b1'; },
    save => { save.branches[0].forkTick = 1; },
    save => { save.activeBranchId = 'b999'; },
    save => { save.nextBranchId = 999; },
    save => { save.followed.push('invented-person'); },
    save => { save.followed.push(save.followed[0]); },
    save => { save.session.lastSeenTick = 6001; },
    save => { save.attention = 'everything'; },
    save => { save.branches[0].commands.push({ atTick: 12, command: { type: 'advance', days: 1 } }); },
  ];
  const before = serializeHistory(history);
  for (const mutate of mutations) assert.throws(() => parseHistory(altered(history, mutate)));
  assert.equal(serializeHistory(history), before);
  assert.throws(() => parseHistory('{"__proto__":{"polluted":true}}'), /prohibited/);
  assert.throws(() => parseHistory('{"constructor":{}}'), /prohibited/);
  assert.throws(() => parseHistory(before.replace('"seed":8417', '"seed":1e309')), /non-finite/);
  assert.throws(() => parseHistory('['.repeat(26) + '0' + ']'.repeat(26)), /nested/);
  assert.throws(() => parseHistory(' '.repeat(HISTORY_LIMITS.exportBytes + 1)), /too large/);
  assert.equal({}.polluted, undefined);
});

test('forged ancestry and externally modified state are rejected before saving', () => {
  const history = forkHistory(step(createHistory(), 10), 3, 'Fork');
  assert.throws(() => parseHistory(altered(history, save => { save.branches[1].forkTick = 4; })), /branch point|source history/);
  assert.throws(() => parseHistory(altered(history, save => { save.branches[1].parentId = 'b2'; })), /source history/);
  const badBranch = { ...history.branches[0], head: { ...history.branches[0].head, tick: 999 } };
  const counterfeit = { ...history, branches: [badBranch, history.branches[1]] };
  assert.throws(() => serializeHistory(counterfeit), /outside the simulation/);
  const storage = new MemoryStorage();
  assert.equal(saveHistory(storage, history).ok, true);
  const before = storage.getItem(SAVE_KEYS.current);
  assert.equal(saveHistory(storage, counterfeit).ok, false);
  assert.equal(storage.getItem(SAVE_KEYS.current), before);
});

test('retention bounds reject growth with an export-first explanation and leave history intact', () => {
  let history = createHistory();
  for (let index = 1; index < HISTORY_LIMITS.branches; index++) history = forkHistory(history, 0, `Branch ${index + 1}`);
  const before = serializeHistory(history);
  assert.throws(() => forkHistory(history, 0, 'One too many'), /Export.*never silently discarded/);
  assert.equal(serializeHistory(history), before);
  assert.throws(() => step(history, HISTORY_LIMITS.ticks + 1), /Advance days/);
});

test('staged saving preserves a validated previous slot and restores unchanged state', () => {
  const storage = new MemoryStorage();
  const first = step(createHistory(), 8);
  const second = step(first, 9);
  assert.deepEqual(loadHistory(storage), { history: null, error: null });
  assert.deepEqual(saveHistory(storage, first), { ok: true });
  const firstText = storage.getItem(SAVE_KEYS.current);
  assert.deepEqual(saveHistory(storage, second), { ok: true });
  assert.equal(storage.getItem(SAVE_KEYS.previous), firstText);
  assert.equal(storage.getItem(SAVE_KEYS.staging), null);
  assert.deepEqual(loadHistory(storage).history, second);
  storage.data.set(SAVE_KEYS.current, '{broken');
  const recovered = loadHistory(storage);
  assert.match(recovered.error, /Recovered the previous valid save/);
  assert.deepEqual(recovered.history, first);
});

test('saved preference values do not change when caller-owned metadata is later edited', () => {
  const storage = new MemoryStorage();
  const history = { ...createHistory(), followed: ['s-hearth'], session: { lastSeenTick: 0 } };
  assert.equal(saveHistory(storage, history).ok, true);
  history.followed.push('c-nera');
  history.session.lastSeenTick = 99;
  const restored = loadHistory(storage).history;
  assert.deepEqual(restored.followed, ['s-hearth']);
  assert.equal(restored.session.lastSeenTick, 0);
});

test('quota errors at every write boundary retain a recoverable valid world', () => {
  for (const key of Object.values(SAVE_KEYS)) {
    const storage = new MemoryStorage();
    const first = step(createHistory(), 3);
    const second = step(first, 7);
    assert.equal(saveHistory(storage, first).ok, true);
    const before = storage.getItem(SAVE_KEYS.current);
    storage.failAt = key;
    const result = saveHistory(storage, second);
    assert.equal(result.ok, false, key);
    assert.match(result.error, /Export your world/);
    assert.equal(storage.getItem(SAVE_KEYS.current), before);
    assert.deepEqual(loadHistory(storage).history, first);
  }
});

test('a corrupt write is detected and the previous valid world is recovered', () => {
  for (const key of Object.values(SAVE_KEYS)) {
    const storage = new MemoryStorage();
    const first = step(createHistory(), 3);
    assert.equal(saveHistory(storage, first).ok, true);
    storage.corruptAt = key;
    assert.equal(saveHistory(storage, step(first, 7)).ok, false, key);
    assert.deepEqual(loadHistory(storage).history, first);
  }
});

test('a successful current write followed by transient readback failure rolls back the committed world', () => {
  for (const hasPrevious of [false, true]) {
    const storage = new MemoryStorage();
    const first = step(createHistory(), 3);
    if (hasPrevious) assert.equal(saveHistory(storage, first).ok, true);
    const before = storage.getItem(SAVE_KEYS.current);
    const originalSet = storage.setItem.bind(storage);
    const originalGet = storage.getItem.bind(storage);
    let written = false;
    let failRead = false;
    storage.setItem = (key, text) => {
      originalSet(key, text);
      if (key === SAVE_KEYS.current && !written) { written = true; failRead = true; }
    };
    storage.getItem = key => {
      if (key === SAVE_KEYS.current && failRead) { failRead = false; throw new Error('Readback temporarily unavailable'); }
      return originalGet(key);
    };
    const result = saveHistory(storage, step(first, 10));
    assert.equal(result.ok, false);
    assert.equal(result.commitUncertain, undefined);
    assert.equal(storage.getItem(SAVE_KEYS.current), before);
    assert.deepEqual(loadHistory(storage).history, hasPrevious ? first : null);
  }
});

test('storage that blocks both readback and rollback reports uncertainty and retains the recovery copy', () => {
  const storage = new MemoryStorage();
  const first = step(createHistory(), 3);
  assert.equal(saveHistory(storage, first).ok, true);
  const firstText = storage.getItem(SAVE_KEYS.current);
  const originalSet = storage.setItem.bind(storage);
  const originalGet = storage.getItem.bind(storage);
  let written = false;
  let failRead = false;
  storage.setItem = (key, text) => {
    if (key === SAVE_KEYS.current && written) throw new Error('Rollback write unavailable');
    originalSet(key, text);
    if (key === SAVE_KEYS.current) { written = true; failRead = true; }
  };
  storage.getItem = key => {
    if (key === SAVE_KEYS.current && failRead) { failRead = false; throw new Error('Readback temporarily unavailable'); }
    return originalGet(key);
  };
  const result = saveHistory(storage, step(first, 10));
  assert.equal(result.ok, false);
  assert.equal(result.commitUncertain, true);
  assert.match(result.error, /reopening may load the attempted save/);
  assert.equal(storage.getItem(SAVE_KEYS.previous), firstText);
  assert.deepEqual(currentWorld(parseHistory(firstText)), currentWorld(first));
});

test('interrupted save recovers staging only when no committed valid world remains', () => {
  const storage = new MemoryStorage();
  const history = step(createHistory(), 6);
  storage.data.set(SAVE_KEYS.staging, serializeHistory(history));
  assert.deepEqual(loadHistory(storage).history, history);
  assert.match(loadHistory(storage).error, /verified staged save/);
  const committed = createHistory();
  storage.data.set(SAVE_KEYS.current, serializeHistory(committed));
  assert.deepEqual(loadHistory(storage).history, committed);
});

test('invalid slots remain untouched, inaccessible storage reports an accurate error', () => {
  const storage = new MemoryStorage();
  storage.data.set(SAVE_KEYS.current, '{damaged');
  storage.data.set(SAVE_KEYS.previous, '{also-damaged');
  const before = [...storage.data];
  const result = loadHistory(storage);
  assert.equal(result.history, null);
  assert.match(result.error, /No saved world passed validation/);
  assert.deepEqual([...storage.data], before);
  const denied = { getItem() { throw new Error('Access denied'); }, removeItem() {} };
  assert.match(loadHistory(denied).error, /could not be read/);
  assert.equal(saveHistory(denied, createHistory()).ok, false);
});

// Captured from the published v1 examples before the ecological engine change.
// Kept inline so regenerating current examples cannot bless a legacy replay drift.
const LEGACY_PORTABLE_SAVES = {
  "quiet-basin": "{\"format\":\"worldweaver\",\"saveVersion\":1,\"simulationVersion\":\"1.0.0\",\"initialConfig\":{\"seed\":8417,\"tier\":2,\"climate\":\"temperate\",\"temperament\":\"careful\",\"density\":\"balanced\"},\"activeBranchId\":\"b1\",\"nextBranchId\":2,\"branches\":[{\"id\":\"b1\",\"name\":\"First history\",\"parentId\":null,\"forkTick\":0,\"forkCommandIndex\":0,\"commands\":[{\"atTick\":0,\"command\":{\"type\":\"advance\",\"days\":2}}],\"headDigest\":\"294772f4b40c309ccc41c1e47e3274a0\"}],\"followed\":[\"s-hearth\",\"c-nera\"],\"attention\":\"balanced\",\"session\":{\"lastSeenTick\":0}}",
  "two-tellings": "{\"format\":\"worldweaver\",\"saveVersion\":1,\"simulationVersion\":\"1.0.0\",\"initialConfig\":{\"seed\":8417,\"tier\":2,\"climate\":\"temperate\",\"temperament\":\"careful\",\"density\":\"balanced\"},\"activeBranchId\":\"b2\",\"nextBranchId\":3,\"branches\":[{\"id\":\"b1\",\"name\":\"First history\",\"parentId\":null,\"forkTick\":0,\"forkCommandIndex\":0,\"commands\":[{\"atTick\":0,\"command\":{\"type\":\"advance\",\"days\":2}},{\"atTick\":2,\"command\":{\"type\":\"advance\",\"days\":50}}],\"headDigest\":\"b9e8deb37fdb768f1d6fb405d26d0063\"},{\"id\":\"b2\",\"name\":\"The open passage\",\"parentId\":\"b1\",\"forkTick\":2,\"forkCommandIndex\":1,\"commands\":[{\"atTick\":0,\"command\":{\"type\":\"advance\",\"days\":2}},{\"atTick\":2,\"command\":{\"type\":\"intervene\",\"intervention\":{\"kind\":\"open-route\",\"targetId\":\"r-hearth-lattice\"}}},{\"atTick\":2,\"command\":{\"type\":\"advance\",\"days\":50}}],\"headDigest\":\"1297221c41127abc560d1b3072840bf8\"}],\"followed\":[\"s-hearth\",\"c-nera\"],\"attention\":\"balanced\",\"session\":{\"lastSeenTick\":0}}",
  "wet-beginning": "{\"format\":\"worldweaver\",\"saveVersion\":1,\"simulationVersion\":\"1.0.0\",\"initialConfig\":{\"seed\":2026,\"tier\":2,\"climate\":\"wet\",\"temperament\":\"curious\",\"density\":\"sparse\"},\"activeBranchId\":\"b1\",\"nextBranchId\":2,\"branches\":[{\"id\":\"b1\",\"name\":\"First history\",\"parentId\":null,\"forkTick\":0,\"forkCommandIndex\":0,\"commands\":[{\"atTick\":0,\"command\":{\"type\":\"advance\",\"days\":2}}],\"headDigest\":\"f8883cc893e3e0d485d5888242d0cac8\"}],\"followed\":[\"s-hearth\",\"c-nera\"],\"attention\":\"balanced\",\"session\":{\"lastSeenTick\":0}}"
};

test('all published v1 example archives remain byte-identical without an engine upgrade', () => {
  for (const [name, bytes] of Object.entries(LEGACY_PORTABLE_SAVES)) {
    const restored = parseHistory(bytes);
    assert.equal(restored.simulationVersion, '1.0.0', name);
    assert.ok(restored.branches.every(branch => branch.head.version === '1.0.0'), name);
    assert.equal(serializeHistory(restored), bytes, name);
    const continued = step(restored, 5);
    assert.equal(continued.simulationVersion, '1.0.0', name);
    assert.deepEqual(currentWorld(continued), advance(currentWorld(restored), 5), name);
  }
});

test('new archives use v2 while explicit v1 creation and every world operation retain their engine', () => {
  const current = createHistory({ tier: 2 });
  const legacy = createHistory({ tier: 2 }, '1.0.0');
  assert.equal(current.simulationVersion, '2.0.0');
  assert.equal(currentWorld(current).version, '2.0.0');
  assert.equal(legacy.simulationVersion, '1.0.0');
  assert.equal(currentWorld(legacy).version, '1.0.0');
  for (const source of [legacy, current]) {
    const world = currentWorld(source);
    assert.equal(advance(world, 3).version, source.simulationVersion);
    assert.equal(intervene(world, availableIntervention(world)).version, source.simulationVersion);
    assert.equal(getEntity(world, 'c-nera').id, 'c-nera');
    assert.equal(entityLabel(world, 'c-nera'), 'Nera');
  }
  assert.throws(() => createHistory({}, '9.0.0'), /unsupported simulation version/);
  assert.throws(() => createWorld({ engineVersion: '9.0.0' }), /Unsupported simulation version/);
  for (const operation of [world => advance(world), world => intervene(world, {}), getInterventions, world => getEntity(world, 'c-nera'), world => entityLabel(world, 'c-nera')]) {
    assert.throws(() => operation({ ...currentWorld(current), version: '9.0.0' }), /Unsupported simulation version/);
  }
});

test('v2 long-run replay, forks and cold recovery preserve the original future and presentation metadata', () => {
  const source = step(createHistory({ tier: 2, seed: 177, climate: 'wet' }), 300);
  const original = serializeHistory(source);
  let branched = forkHistory(source, 240, 'A later beginning');
  branched = setPersonStyle(branched, 'c-nera', 'lilac');
  branched = setHomeStyle(branched, 'k-hearth-table', { color: 'jade', decoration: 'planter' });
  branched = setGuideProgress(branched, { completed: ['meet', 'watch'], dismissed: true });
  branched = step(branched, 60);
  assert.deepEqual(currentWorld(branched), currentWorld(source), 'Splitting the same future retains every event, identity and resource.');
  assert.equal(serializeHistory(source), original);
  const text = serializeHistory(branched);
  const replayed = parseHistory(text);
  assert.equal(serializeHistory(replayed), text);
  assert.deepEqual(replayed, branched);
  assert.deepEqual(worldAt(replayed, 275), worldAt(source, 275));
  const storage = new MemoryStorage();
  assert.equal(saveHistory(storage, branched).ok, true);
  assert.equal(saveHistory(storage, step(branched, 1)).ok, true);
  storage.data.set(SAVE_KEYS.current, '{damaged');
  const cold = new MemoryStorage();
  cold.data = new Map(storage.data);
  const recovered = loadHistory(cold);
  assert.match(recovered.error, /previous valid save/);
  assert.deepEqual(recovered.history, branched);
  assert.equal(recovered.history.simulationVersion, '2.0.0');
  assert.equal(cold.getItem(SAVE_KEYS.current), '{damaged', 'Recovery must not silently overwrite the damaged slot.');
});

test('cross-engine recovery does not upgrade the previous v1 archive or discard its metadata', () => {
  let legacy = parseHistory(LEGACY_PORTABLE_SAVES['two-tellings']);
  legacy = setPersonStyle(legacy, 'c-nera', 'amber');
  legacy = setHomeStyle(legacy, 'k-hearth-table', { color: 'sky', decoration: 'lantern' });
  legacy = setGuideProgress(legacy, { completed: ['meet', 'style'], dismissed: false });
  const bytes = serializeHistory(legacy);
  const storage = new MemoryStorage();
  assert.equal(saveHistory(storage, legacy).ok, true);
  assert.equal(loadHistory(storage).history.simulationVersion, '1.0.0', 'The warm cache keeps the archive version too.');
  assert.equal(saveHistory(storage, createHistory({ tier: 2 })).ok, true);
  assert.equal(storage.getItem(SAVE_KEYS.previous), bytes);
  const cold = new MemoryStorage();
  cold.data = new Map(storage.data);
  cold.data.set(SAVE_KEYS.current, '{damaged');
  const recovered = loadHistory(cold);
  assert.match(recovered.error, /previous valid save/);
  assert.deepEqual(recovered.history, legacy);
  assert.equal(serializeHistory(recovered.history), bytes);
});

test('version tampering and mixed-engine branches or checkpoints fail closed before saving', () => {
  const legacy = forkHistory(step(createHistory({ tier: 2 }, '1.0.0'), 15), 3, 'Legacy fork');
  const current = forkHistory(step(createHistory({ tier: 2 }), 15), 3, 'Current fork');
  for (const [source, opposite] of [[legacy, current], [current, legacy]]) {
    assert.throws(() => parseHistory(altered(source, save => { save.simulationVersion = opposite.simulationVersion; })), /deterministic replay/);
    const wrongVersion = { ...source, simulationVersion: opposite.simulationVersion };
    const mixedHeads = { ...source, branches: [source.branches[0], opposite.branches[1]] };
    const mixedCheckpoint = { ...source, branches: [{ ...source.branches[0], checkpoints: opposite.branches[0].checkpoints }, source.branches[1]] };
    for (const changed of [wrongVersion, mixedHeads, mixedCheckpoint]) {
      for (const operation of [serializeHistory, currentWorld, history => worldAt(history, 0), history => step(history, 1), history => forkHistory(history, 1)]) {
        assert.throws(() => operation(changed), /mixed simulation versions/);
      }
      const storage = new MemoryStorage();
      assert.equal(saveHistory(storage, source).ok, true);
      const before = storage.getItem(SAVE_KEYS.current);
      assert.equal(saveHistory(storage, changed).ok, false);
      assert.equal(storage.getItem(SAVE_KEYS.current), before);
    }
  }
});


test('an advance or fork cannot bless an untrusted head or changed genesis under either engine', () => {
  for (const version of ['1.0.0', '2.0.0']) {
    const history = step(createHistory({ tier: 2 }, version), 10);
    const before = serializeHistory(history);
    const changedHead = { ...history, branches: [{ ...history.branches[0], head: { ...currentWorld(history), rng: 123 } }] };
    const changedGenesis = { ...history, initialConfig: { ...history.initialConfig, seed: 901 } };
    for (const changed of [changedHead, changedGenesis]) {
      for (const operation of [serializeHistory, currentWorld, candidate => step(candidate, 1), candidate => forkHistory(candidate, 3)]) {
        assert.throws(() => operation(changed), /outside the simulation/);
      }
    }
    assert.equal(serializeHistory(history), before);
  }
});
