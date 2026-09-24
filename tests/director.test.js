import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDigest, relatedEvents, shouldStop } from '../src/director.js';
import { createWorld, advance, intervene } from '../src/sim/world.js';

function event(id, tick, severity = 1, entities = ['c-nera'], extra = {}) {
  return { id, tick, severity, entities, title: id, text: `Recorded ${id}`, ...extra };
}

test('director stops require both a followed participant and the selected severity', () => {
  const thresholds = { quiet: 3, balanced: 2, attentive: 1 };
  for (const [attention, threshold] of Object.entries(thresholds)) {
    for (const severity of [1, 2, 3]) {
      const record = event('e-choice', 4, severity);
      assert.equal(shouldStop(record, ['c-nera'], attention), severity >= threshold);
      assert.equal(shouldStop(record, ['c-someone-else'], attention), false);
      assert.equal(shouldStop(record, [], attention), false);
    }
  }
});

test('settlement and recorded actor links count without requiring duplicated entity IDs', () => {
  assert.equal(shouldStop(event('e-home', 2, 2, [], { settlementId: 's-hearth' }), ['s-hearth']), true);
  assert.equal(shouldStop(event('e-choice', 4, 2, [], { decision: { actorId: 'c-nera' } }), ['c-nera']), true);
  assert.equal(shouldStop(event('e-low', 3, 1), ['c-nera']), false);
  assert.equal(shouldStop(event('e-high', 3, 2), ['c-nera'], 'unknown'), true);
  assert.equal(shouldStop(null, ['c-nera']), false);
});

test('digest retains actual records and favors followed developments over unrelated drama', () => {
  const events = Array.from({ length: 7 }, (_, index) => event(`e-elsewhere-${index}`, index + 2, 3, ['s-other']));
  const followed = event('e-small-personal', 2, 1);
  const world = { tick: 9, events: [event('e-seen', 1), followed, ...events, event('e-future', 10, 3)], threads: [] };
  const digest = makeDigest(world, ['c-nera'], 1);
  assert.equal(digest.events.length, 6);
  assert.equal(digest.events[0], followed);
  assert.ok(digest.events.every(record => world.events.includes(record)));
  assert.ok(digest.events.every(record => record.tick > 1 && record.tick <= world.tick));
  assert.match(digest.summary, /8 recorded developments/);
  assert.match(digest.summary, /1 involves your follow list/);
});

test('unresolved threads survive a quiet session without inventing new threads or reviving resolved ones', () => {
  const events = [event('e-root', 0), event('e-resolved', 2)];
  const oldOpen = { id: 't-old', title: 'An existing question', status: 'open', entityIds: ['c-nera'], eventId: 'e-root' };
  const world = { tick: 9, events, threads: [
    { id: 't-resolved', status: 'resolved', entityIds: ['c-nera'], eventId: 'e-resolved' },
    { id: 't-unfounded', status: 'open', entityIds: ['c-nera'], eventId: 'e-does-not-exist' },
    oldOpen,
  ] };
  const digest = makeDigest(world, ['c-nera'], 9);
  assert.deepEqual(digest.events, []);
  assert.deepEqual(digest.threads, [oldOpen]);
  assert.equal(digest.title, 'A quiet interval');
  assert.match(digest.summary, /No new recorded developments/);
  assert.match(digest.summary, /1 thread remains open/);
});

test('thread selection favors the follow list and remains bounded', () => {
  const followed = { id: 't-followed', status: 'open', entityIds: ['c-nera'], eventId: 'e-root' };
  const world = { tick: 2, events: [event('e-root', 0)], threads: [
    ...Array.from({ length: 5 }, (_, index) => ({ id: `t-${index}`, status: 'open', entityIds: ['s-other'], eventId: 'e-root' })),
    followed,
  ] };
  const digest = makeDigest(world, ['c-nera'], 2);
  assert.equal(digest.threads[0], followed);
  assert.equal(digest.threads.length, 4);
  assert.match(digest.summary, /6 threads remain open/);
});

test('closure is an allowed digest result', () => {
  const world = { tick: 7, events: [event('e-root', 0)], threads: [] };
  const digest = makeDigest(world, [], 7);
  assert.deepEqual(digest.events, []);
  assert.deepEqual(digest.threads, []);
  assert.equal(digest.summary, 'No new recorded developments since day 7. No recorded threads remain open.');
});

test('landmarks, memories, decisions and directly linked events lead to real history', () => {
  const founding = event('e-foundation', 0, 2, ['s-hearth']);
  const decision = event('e-choice', 4, 2, [], { decision: { actorId: 'c-nera' } });
  const remembered = event('e-remembered', 1, 1, ['c-other']);
  const world = {
    tick: 5,
    events: [founding, remembered, decision, event('e-future', 6)],
    settlements: [{ id: 's-hearth', structures: [{ id: 'st-archive', eventId: founding.id }] }],
    characters: [{ id: 'c-nera', memories: [remembered.id, 'e-absent'], knowledge: [decision.id] }],
  };
  assert.deepEqual(relatedEvents(world, 'st-archive'), [founding]);
  assert.deepEqual(relatedEvents(world, 'c-nera'), [decision, remembered]);
  assert.deepEqual(relatedEvents(world, 's-hearth'), [founding]);
  assert.deepEqual(relatedEvents(world, 'missing'), []);
});

test('director reads do not mutate the replayable history or follow list', () => {
  const world = {
    tick: 6,
    events: [event('e-root', 0), event('e-late', 6, 2), event('e-early', 1, 3)],
    threads: [{ id: 't-open', status: 'open', eventId: 'e-root', entityIds: ['c-nera'] }],
    characters: [{ id: 'c-nera', memories: ['e-root'] }],
  };
  const follows = ['c-nera'];
  const before = structuredClone({ world, follows });
  makeDigest(world, follows, 0);
  relatedEvents(world, 'c-nera');
  shouldStop(world.events[1], follows);
  assert.deepEqual({ world, follows }, before);
});

test('the real opening decision is discoverable through the follow list, digest and physical trace', () => {
  const before = advance(createWorld({ seed: 8417, tier: 1 }), 3);
  for (const openRoute of [false, true]) {
    const start = openRoute ? intervene(before, { kind: 'open-route', targetId: 'r-hearth-lattice' }) : before;
    const world = advance(start, 1);
    const choice = world.events.find(record => record.kind === 'seed-decision');
    assert.ok(choice);
    assert.equal(shouldStop(choice, ['c-nera'], 'quiet'), true);
    assert.equal(shouldStop(choice, ['c-mira'], 'attentive'), false);
    assert.ok(makeDigest(world, ['c-nera'], 3).events.includes(choice));
    const trace = openRoute ? 'k-hearth-pattern' : 'k-hearth-loft';
    assert.ok(relatedEvents(world, trace).includes(choice));
    assert.ok(choice.causes.every(id => world.events.some(record => record.id === id)));
  }
  assert.equal(before.tick, 3);
  assert.equal(before.flags.archiveResolved, null);
  assert.equal(before.routes.find(route => route.id === 'r-hearth-lattice').open, false);
});

test('history inspection supports numeric settlement knowledge and every real entity shape', () => {
  const world = advance(createWorld({ seed: 8417, tier: 1 }), 4);
  const entities = [
    ...world.regions, ...world.settlements, ...world.characters, ...world.routes,
    ...world.cultures, ...world.institutions, ...world.threads,
    ...world.settlements.flatMap(settlement => settlement.structures),
  ];
  for (const entity of entities) {
    const records = relatedEvents(world, entity.id);
    assert.ok(Array.isArray(records), entity.id);
    assert.ok(records.every(record => world.events.includes(record)), entity.id);
  }
  const hearth = world.settlements.find(settlement => settlement.id === 's-hearth');
  assert.equal(typeof hearth.knowledge, 'number');
  assert.ok(relatedEvents(world, hearth.id).some(record => record.kind === 'seed-decision'));
});
