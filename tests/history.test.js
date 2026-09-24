import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, advance, intervene, getInterventions } from '../src/sim/world.js';
import { createHistory, currentWorld, applyCommand, worldAt, forkHistory, selectBranch, serializeHistory, parseHistory, saveHistory, loadHistory, HISTORY_LIMITS, SAVE_KEYS } from '../src/persistence/history.js';

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
