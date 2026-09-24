import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, advance, intervene, getInterventions, getEntity, entityLabel } from '../src/sim/world.js';

const east = { kind: 'open-route', targetId: 'r-hearth-lattice' };
const relic = { kind: 'reveal-relic', targetId: 'k-hollow-relic' };
const event = (w, kind) => w.events.find(e => e.kind === kind);
const entity = (w, id) => getEntity(w, id);

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function assertHistoryReferences(w) {
  const allIds = [...w.regions, ...w.settlements, ...w.characters, ...w.routes, ...w.cultures, ...w.institutions, ...w.events, ...w.threads, ...w.settlements.flatMap(s => s.structures), ...(w.power ? [w.power] : [])].map(e => e.id);
  assert.equal(new Set(allIds).size, allIds.length, 'Every entity and event has a unique stable ID.');
  const ids = new Set(allIds);
  const events = new Map(w.events.map(e => [e.id, e]));
  for (const e of w.events) {
    for (const id of e.entities) assert.ok(ids.has(id), `${e.id} links missing entity ${id}`);
    for (const id of e.causes) {
      assert.ok(events.has(id), `${e.id} links missing cause ${id}`);
      assert.ok(events.get(id).tick <= e.tick, 'A cause cannot occur after its effect.');
      assert.ok(w.events.indexOf(events.get(id)) < w.events.indexOf(e), 'Causal references cannot form a cycle.');
    }
    assert.ok(Array.isArray(e.observed));
    assert.ok(Array.isArray(e.interpretations));
    if (e.decision) {
      assert.ok(ids.has(e.decision.actorId));
      assert.ok(e.decision.alternatives.some(a => a.id === e.decision.chosen && a.available), 'The choice must have been available at decision time.');
      assert.ok(e.decision.known.length);
      assert.ok(e.decision.motives.length);
    }
  }
  for (const s of w.settlements) {
    for (const key of ['habitat', 'energy', 'materials', 'food']) assert.ok(s[key] >= 0 && s[key] <= 100, `${s.name}.${key} bounded`);
    for (const b of s.structures) assert.ok(events.has(b.eventId), `${b.id} has a reachable construction or survey record.`);
  }
  for (const c of w.characters) {
    assert.ok(ids.has(c.settlementId));
    for (const id of [...c.knowledge, ...c.memories]) assert.ok(events.has(id));
    for (const r of c.relationships) assert.ok(ids.has(r.otherId));
    if (c.alive) assert.ok(ids.has(c.activityTargetId));
  }
}

test('the opening records abandonment, preserves the place, and contains eight distinct recurring people', () => {
  const w = createWorld();
  assert.equal(w.characters.length, 8);
  assert.equal(entity(w, 's-hollow').population, 0);
  assert.equal(entity(w, 'c-ivo').settlementId, 's-hearth');
  assert.equal(entity(w, 'k-hollow-hall').kind, 'ruin');
  assert.equal(entity(w, 'i-hollow').status, 'collapsed');
  assert.equal(w.threads.filter(t => t.status === 'open').length, 3);
  assert.equal(w.settlements.reduce((n, s) => n + s.synthetics + s.collective, 0), 0);
  assertHistoryReferences(w);
});

test('simulation and commands are immutable and deterministic, including chunked advance', () => {
  const source = deepFreeze(createWorld({ seed: 91 }));
  const before = JSON.stringify(source);
  const a = advance(intervene(source, east), 65);
  const b = advance(advance(intervene(source, east), 20), 45);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(source), before);
  assert.equal(source.tick, 0);
  assert.equal(source.routes[0].open, false);
  assert.deepEqual(createWorld({ seed: 91 }), createWorld({ seed: 91 }));
  assertHistoryReferences(a);
});

test('the eastern passage changes the available choice, resident, physical trace, and later recovery', () => {
  const source = advance(createWorld(), 2);
  const closed = advance(source, 2);
  const opened = advance(intervene(source, east), 2);
  assert.equal(event(closed, 'seed-decision').decision.chosen, 'raise');
  assert.equal(event(opened, 'seed-decision').decision.chosen, 'exchange');
  assert.equal(event(closed, 'seed-decision').decision.alternatives.find(a => a.id === 'exchange').available, false);
  assert.equal(event(opened, 'seed-decision').decision.alternatives.find(a => a.id === 'exchange').available, true);
  assert.equal(entity(closed, 'c-oren').settlementId, 's-lattice');
  assert.equal(entity(opened, 'c-oren').settlementId, 's-hearth');
  assert.ok(entity(closed, 'k-hearth-loft'));
  assert.ok(entity(opened, 'k-hearth-pattern'));
  assert.ok(entity(opened, 'k-hearth-bridge'));
  assert.equal(entity(source, 'k-hearth-pattern'), null);
  assert.equal(event(opened, 'seed-recovery').decision.chosen, 'channels');
  assert.equal(event(advance(closed, 20), 'seed-recovery').decision.chosen, 'beds');
  const choice = event(opened, 'seed-decision');
  const contact = event(opened, 'eastern-contact');
  assert.ok(choice.causes.includes(contact.id));
  assert.ok(contact.causes.includes(event(opened, 'passage-opened').id));
  assertHistoryReferences(opened);
});

test('a different relevant motive produces a third valid answer without a player choosing it', () => {
  const w = advance(createWorld({ temperament: 'curious' }), 4);
  const choice = event(w, 'seed-decision');
  assert.equal(choice.decision.chosen, 'plant');
  assert.ok(choice.decision.motives.some(m => m.includes('Curiosity 94')));
  assert.equal(entity(w, 'k-hearth-archive').kind, 'ruin');
  assert.equal(entity(w, 'k-hearth-archive').abandonedAt, 4);
  assert.ok(entity(w, 'k-hearth-nursery'));
  assertHistoryReferences(w);
});

test('recorded explanation facts remain unchanged after resources and people continue changing', () => {
  const atChoice = advance(intervene(createWorld(), east), 4);
  const snapshot = structuredClone(event(atChoice, 'seed-decision'));
  const later = advance(atChoice, 100);
  assert.deepEqual(event(later, 'seed-decision'), snapshot);
  assert.notEqual(entity(later, 's-hearth').population, entity(atChoice, 's-hearth').population);
  assert.equal(entity(later, 'k-hearth-pattern').eventId, snapshot.id);
});

test('discovery is grounded in a reachable trace and produces knowledge, a visit, and a return', () => {
  const original = createWorld();
  const exposed = intervene(original, relic);
  assert.equal(entity(exposed, 's-hearth').knowledge, entity(original, 's-hearth').knowledge, 'Revealing a relic does not mean someone has learned it.');
  const visited = advance(exposed, 1);
  assert.equal(entity(visited, 'c-tavi').settlementId, 's-hollow');
  assert.equal(entity(visited, 'c-ivo').settlementId, 's-hollow');
  assert.equal(entity(visited, 's-hearth').knowledge, entity(original, 's-hearth').knowledge, 'A pattern still at Old Hollow is unavailable to Hearth.');
  const returned = advance(visited, 1);
  assert.equal(entity(returned, 'c-tavi').settlementId, 's-hearth');
  assert.equal(entity(returned, 's-hearth').knowledge, entity(original, 's-hearth').knowledge + 16);
  assert.ok(event(returned, 'readers-returned').causes.includes(event(returned, 'rain-memory-read').id));
  assertHistoryReferences(returned);
});

test('recovery never uses an absent Ivo or claims a dry loft on the living-nursery path', () => {
  const opened = intervene(advance(createWorld(), 3), east);
  const visiting = advance(intervene(opened, relic), 1);
  assert.equal(entity(visiting, 'c-ivo').settlementId, 's-hollow');
  assert.equal(event(visiting, 'seed-recovery'), undefined);
  const returned = advance(visiting, 1);
  assert.ok(event(returned, 'seed-recovery'));
  assert.equal(entity(returned, 'c-ivo').settlementId, 's-hearth');
  const nursery = advance(createWorld({ temperament: 'curious' }), 100);
  assert.equal(entity(nursery, 'k-hearth-loft'), null);
  assert.match(entity(nursery, 'k-hearth-recovery').description, /living nursery/);
  assert.doesNotMatch(entity(nursery, 'k-hearth-recovery').description, /dry loft/);
});

test('all six situation families are available through real conditions in the opening world', () => {
  const w = advance(intervene(intervene(createWorld(), east), relic), 80);
  assert.deepEqual([...new Set(w.events.map(e => e.family).filter(Boolean))].sort(), ['contact', 'discovery', 'institution', 'obligations', 'recovery', 'relationships']);
  assert.equal(entity(w, 'i-ledger').status, 'changed');
  assert.equal(entity(w, 'i-ledger').id, 'i-ledger');
  assert.ok(entity(w, 's-hearth').population > 52);
  assert.ok(entity(w, 'k-hollow-hall').abandonedAt === 0);
  assertHistoryReferences(w);
});

test('invalid and repeated interventions fail before changing any state', () => {
  const w = deepFreeze(createWorld());
  const before = JSON.stringify(w);
  for (const command of [null, {}, { kind: 'place-building', targetId: 's-hearth' }, { kind: 'open-route', targetId: 's-hearth' }, { kind: 'reveal-relic', targetId: 'c-nera' }]) assert.throws(() => intervene(w, command));
  assert.equal(JSON.stringify(w), before);
  const opened = deepFreeze(intervene(w, east));
  assert.throws(() => intervene(opened, east), /already usable/);
  assert.equal(getInterventions(opened).find(i => i.kind === 'open-route').available, false);
});

test('clock and creation reject invalid values and all entity types have readable labels', () => {
  for (const seed of [-1, Infinity, NaN, 3.1, '4']) assert.throws(() => createWorld({ seed }));
  assert.throws(() => createWorld({ climate: 'volcanic' }));
  assert.throws(() => createWorld({ tier: 3 }));
  const w = createWorld();
  for (const days of [-1, 0.5, NaN, Infinity, 6001, '2']) assert.throws(() => advance(w, days));
  for (const id of ['s-hearth', 'c-nera', 'reg-reed', 'r-hearth-lattice', 'culture-table', 'i-ledger', 'k-hearth-door', 'e-00001', 't-seeds']) assert.notEqual(entityLabel(w, id), 'Unrecorded entity');
  assert.equal(getEntity(w, 'missing'), null);
});

test('long quiet runs preserve bounds, identities, traces, and deterministic JSON', () => {
  const w = advance(createWorld(), 6000);
  assert.equal(w.tick, 6000);
  assert.ok(w.events.length < 100, 'Quiet stability does not manufacture endless crises or scenes.');
  assert.equal(entity(w, 'k-hearth-door').id, 'k-hearth-door');
  assert.equal(entity(w, 'i-hollow').status, 'collapsed');
  assert.deepEqual(JSON.parse(JSON.stringify(w)), w);
  assertHistoryReferences(w);
});
