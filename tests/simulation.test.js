import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, advance, intervene, getInterventions, getEntity, entityLabel } from '../src/sim/world.js';

const east = { kind: 'open-route', targetId: 'r-hearth-lattice' };
const relic = { kind: 'reveal-relic', targetId: 'k-hollow-relic' };
const event = (w, kind) => w.events.find(e => e.kind === kind);
const entity = (w, id) => getEntity(w, id);
const legacyWorld = options => createWorld({ ...options, engineVersion: '1.0.0' });
function untilRefuge(world) {
  let w = world;
  while (w.tick < 400 && !getInterventions(w).find(i => i.kind === 'offer-refuge').available) w = advance(w, 1);
  assert.ok(getInterventions(w).find(i => i.kind === 'offer-refuge').available, 'A viable terrace must actually become available.');
  return w;
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function assertHistoryReferences(w) {
  const visitValue = (value, path = 'world') => {
    assert.notEqual(value, undefined, `${path} must survive a JSON round trip.`);
    if (typeof value === 'number') assert.ok(Number.isFinite(value), `${path} must be finite.`);
    if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) visitValue(child, `${path}.${key}`);
  };
  visitValue(w);
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

test('legacy: all six authored situation families remain replayable in the original opening', () => {
  const w = advance(intervene(intervene(legacyWorld(), east), relic), 80);
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

test('legacy: long quiet runs preserve bounds, identities, traces, and deterministic JSON', () => {
  const w = advance(legacyWorld(), 6000);
  assert.equal(w.tick, 6000);
  assert.ok(w.events.length < 100, 'Quiet stability does not manufacture endless crises or scenes.');
  assert.equal(entity(w, 'k-hearth-door').id, 'k-hearth-door');
  assert.equal(entity(w, 'i-hollow').status, 'collapsed');
  assert.deepEqual(JSON.parse(JSON.stringify(w)), w);
  assertHistoryReferences(w);
});

test('Tier 2 forms have different environmental responses, costs, replication, and occupied space', () => {
  const dry = advance(createWorld({ tier: 2, climate: 'dry' }), 30);
  const wet = advance(createWorld({ tier: 2, climate: 'wet' }), 30);
  assert.ok(event(dry, 'synthetic-replication').tick < event(wet, 'synthetic-replication').tick, 'Dry weather supplies solar copying energy sooner.');
  assert.ok(entity(wet, 's-choir').collective > entity(dry, 's-choir').collective, 'Wet connected habitat supports more living root rooms.');
  assert.ok(entity(wet, 's-hearth').food > entity(dry, 's-hearth').food, 'Organic food yield responds to habitat.');
  assert.ok(event(wet, 'collective-expansion').observed.some(line => line.includes('Food nutrients')));
  assert.ok(event(dry, 'synthetic-replication').observed.some(line => line.includes('materials')));
  assert.ok(entity(wet, 's-choir').structures.some(b => b.form === 'collective' && b.kind === 'nest'));
  assert.ok(entity(dry, 's-lattice').structures.some(b => b.form === 'synthetic' && b.kind === 'spire'));
  assertHistoryReferences(dry);
  assertHistoryReferences(wet);
});

test('Tier 2 has real seeded variation while identical seeds replay unchanged', () => {
  const baseline = createWorld({ tier: 2, seed: 8417 });
  const alternate = createWorld({ tier: 2, seed: 42 });
  assert.notEqual(entity(baseline, 's-lattice').energy, entity(alternate, 's-lattice').energy);
  assert.notEqual(entity(baseline, 's-choir').habitat, entity(alternate, 's-choir').habitat);
  assert.notEqual(event(advance(baseline, 60), 'power-emerged').tick, event(advance(alternate, 60), 'power-emerged').tick);
  assert.deepEqual(advance(alternate, 60), advance(createWorld({ tier: 2, seed: 42 }), 60));
});

test('observation alone develops a mixed institution, organic cultural divergence, and a material power', () => {
  const initial = createWorld({ tier: 2 });
  assert.equal(initial.power, null);
  const w = advance(initial, 80);
  assert.equal(w.flags.archiveResolved, 'raise', 'The opening closed-route choice remains intact even after residents later open the route.');
  assert.ok(event(w, 'inhabitants-open-route'));
  assert.ok(event(w, 'common-channel-founded'));
  assert.equal(entity(w, 'culture-carriers').form, 'organic');
  assert.notEqual(entity(w, 's-hearth').cultureId, entity(w, 's-lattice').cultureId);
  assert.equal(w.power.id, 'p-undersong');
  const emergence = event(w, 'power-emerged');
  assert.ok(emergence.observed.some(line => line.includes('Hearth energy:')));
  assert.ok(emergence.interpretations.length >= 3);
  assert.equal(emergence.decision, undefined, 'No consciousness or godly intention is asserted as a recorded decision.');
  assert.ok(w.flags.powerActs >= 3);
  assertHistoryReferences(w);
});

test('power emergence depends on causal history rather than a universal date or belief score', () => {
  const accelerated = advance(intervene(createWorld({ tier: 2 }), east), 60);
  const passive = advance(createWorld({ tier: 2 }), 60);
  assert.ok(event(accelerated, 'power-emerged').tick < event(passive, 'power-emerged').tick);
  const before = advance(intervene(createWorld({ tier: 2 }), east), event(accelerated, 'power-emerged').tick - 1);
  assert.equal(before.power, null);
  assert.ok(before.flags.networkTransfers < 12);
  assert.ok(event(accelerated, 'power-emerged').causes.includes(event(accelerated, 'common-channel-founded').id));
  assert.ok(event(accelerated, 'power-emerged').causes.includes(event(accelerated, 'culture-diverged').id));
});

test('institution collapse preserves people, culture, physical infrastructure and later autonomous effects', () => {
  const before = advance(intervene(createWorld({ tier: 2 }), east), 41);
  const after = advance(before, 1);
  assert.equal(entity(before, 'i-confluence').status, 'active');
  assert.equal(entity(after, 'i-confluence').status, 'collapsed');
  assert.equal(entity(after, 'i-confluence').id, entity(before, 'i-confluence').id);
  for (const id of ['s-hearth', 's-lattice', 's-choir']) assert.equal(entity(after, id).population, entity(before, id).population);
  for (const id of ['k-hearth-conduit', 'k-lattice-conduit', 'k-choir-conduit', 'culture-carriers']) assert.ok(entity(after, id));
  assert.equal(after.power.active, true);
  const later = advance(after, 11);
  assert.ok(later.events.some(e => e.kind === 'power-redistribution' && e.tick > event(later, 'channel-authority-ended').tick));
  assertHistoryReferences(later);
});

test('refuge changes possibilities first; inhabitants then move existing bodies and build a mixed home', () => {
  const available = untilRefuge(intervene(createWorld({ tier: 2 }), east));
  const offered = intervene(available, { kind: 'offer-refuge', targetId: 's-hearth' });
  assert.equal(entity(offered, 's-hearth').synthetics, 0);
  assert.equal(entity(offered, 's-hearth').collective, 0);
  const settled = advance(offered, 1);
  assert.equal(entity(settled, 's-hearth').synthetics, 2);
  assert.equal(entity(settled, 's-hearth').collective, 3);
  assert.equal(entity(settled, 's-lattice').synthetics, entity(offered, 's-lattice').synthetics - 2);
  assert.ok(entity(settled, 'k-hearth-refuge-spire'));
  assert.ok(entity(settled, 'k-hearth-refuge-root'));
  assert.ok(event(settled, 'mixed-refuge-settled').causes.includes(event(settled, 'refuge-possible').id));
  assert.equal(getInterventions(settled).find(i => i.kind === 'offer-refuge').available, false);
  assertHistoryReferences(settled);
});

test('the mixed-channel path cannot spend nonexistent refuge materials', () => {
  const viable = untilRefuge(createWorld({ tier: 2 }));
  const w = structuredClone(viable);
  entity(w, 's-hearth').materials = 5;
  assert.equal(w.flags.sharedNetwork, true);
  assert.ok(entity(w, 's-hearth').materials < 6);
  const choice = getInterventions(w).find(i => i.kind === 'offer-refuge');
  assert.equal(choice.available, false);
  assert.match(choice.reason, /6 materials/);
  assert.throws(() => intervene(w, { kind: 'offer-refuge', targetId: 's-hearth' }), /6 materials/);
  assert.equal(getInterventions(viable).find(i => i.kind === 'offer-refuge').available, true);
});

test('a successor inherits an actual obligation and a late historical visit remains possible', () => {
  const before = advance(createWorld({ tier: 2 }), 364);
  const after = advance(before, 1);
  assert.equal(entity(before, 'c-ivo').alive, true);
  assert.equal(entity(after, 'c-ivo').alive, false);
  assert.equal(entity(after, 's-hearth').population, entity(before, 's-hearth').population - 1);
  assert.equal(entity(after, 'c-ves').inheritedFromId, 'c-ivo');
  assert.equal(entity(after, 'c-ves').role, 'mender');
  assert.ok(entity(after, 'k-ivo-memory'));
  assert.equal(after.characters.filter(c => c.alive).length, 8);
  const visiting = advance(intervene(after, relic), 1);
  assert.equal(entity(visiting, 'c-ivo').settlementId, 's-hearth', 'The deceased does not travel.');
  assert.equal(entity(visiting, 'c-ves').settlementId, 's-hollow');
  assert.match(event(visiting, 'rain-memory-read').text, /Ivo’s old records/);
  const returned = advance(visiting, 1);
  assert.equal(entity(returned, 'c-ves').settlementId, 's-hearth');
  assert.match(event(returned, 'readers-returned').text, /Tavi and Ves/);
  assertHistoryReferences(returned);
});

test('legacy: a new neighborhood home becomes part of two actual lives and keeps its construction history', () => {
  const w = advance(intervene(legacyWorld({ tier: 2 }), east), 100);
  const choice = event(w, 'shared-home');
  const home = entity(w, 'k-hearth-home-1');
  assert.ok(choice);
  assert.ok(choice.causes.includes(home.eventId));
  assert.ok(choice.causes.includes(event(w, 'late-supper').id));
  assert.equal(entity(w, 'c-tavi').homeId, home.id);
  assert.equal(entity(w, 'c-daro').homeId, home.id);
  assert.ok(entity(w, 'c-tavi').memories.includes(choice.id));
  const before = advance(intervene(legacyWorld({ tier: 2 }), east), choice.tick - 1);
  assert.notEqual(entity(before, 'c-tavi').homeId, home.id);
  assertHistoryReferences(w);
});

test('an elder completes a real visit before succession; no dead traveler returns or visitor population vanishes', () => {
  const before = advance(createWorld({ tier: 2 }), 364);
  const visited = advance(intervene(before, relic), 1);
  assert.equal(entity(visited, 'c-ivo').alive, true);
  assert.equal(entity(visited, 'c-ivo').settlementId, 's-hollow');
  assert.equal(entity(visited, 's-hollow').population, 0);
  const after = advance(visited, 1);
  const homecoming = event(after, 'readers-returned');
  const death = event(after, 'mender-remembered');
  assert.ok(after.events.indexOf(homecoming) < after.events.indexOf(death));
  assert.equal(entity(after, 'c-ivo').settlementId, 's-hearth');
  assert.equal(entity(after, 'c-ivo').alive, false);
  assert.equal(entity(after, 's-hearth').population, entity(before, 's-hearth').population - 1);
  assert.equal(entity(after, 's-hollow').population, 0);
  assertHistoryReferences(after);
});

test('long Tier 2 histories with refuge retain complete JSON structures and bounded causal references', () => {
  let w = untilRefuge(intervene(createWorld({ tier: 2, climate: 'wet' }), east));
  w = intervene(w, { kind: 'offer-refuge', targetId: 's-hearth' });
  w = advance(w, 6000 - w.tick);
  assert.equal(w.tick, 6000);
  assert.deepEqual(JSON.parse(JSON.stringify(w)), w);
  assert.ok(w.settlements.length <= w.ecology.limits.settlements, 'New places stay within the surveyed landscape.');
  assert.ok(w.settlements.flatMap(s => s.structures).every(s => typeof s.name === 'string' && s.name.length > 0));
  assertHistoryReferences(w);
});
