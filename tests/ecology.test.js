import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeEcology, evolveEcology, ecologyBudget } from '../src/sim/ecology.js';

const api = {
  addEvent(w, details) { const event = { id: `event-${w.events.length}`, tick: w.tick, observed: [], interpretations: [], ...structuredClone(details) }; w.events.push(event); return event; },
  addStructure(w, s, values, event) { s.structures.push({ ...structuredClone(values), entityType: 'structure', settlementId: s.id, eventId: event.id, builtAt: w.tick }); event.entities.push(values.id); },
  decision(actor, known, alternatives, chosen, motives) { return structuredClone({ actorId: actor.id, known, alternatives, chosen, motives }); },
  openThread(w, values, event) { w.threads.push({ ...values, status: 'open', eventId: event.id }); },
  resolveThread(w, id, event) { const thread = w.threads.find(v => v.id === id); if (thread) { thread.status = 'resolved'; thread.eventId = event.id; } },
};

function fixture(seed = 13, climate = 'temperate') {
  const place = (id, name, x, population, food, housingCapacity) => ({ id, name, entityType: 'settlement', x, y: 400, regionId: 'region', habitat: 70, population, food, materials: 80, energy: 60, housingCapacity, knowledge: 15, synthetics: 0, collective: 0, cultureId: 'culture', institutionId: null, structures: [{ id: `home-${id}`, name: 'Household rooms', kind: 'home', x: 0, y: 0 }] });
  const w = { seed, tick: 0, config: { climate }, regions: [{ id: 'region', name: 'Region', x: 400, y: 400 }], settlements: [place('place-a', 'Alder', 230, 30, 25, 34), place('place-b', 'Birch', 650, 8, 70, 32)], characters: [], routes: [{ id: 'path', from: 'place-a', to: 'place-b', open: true, passable: true, history: [] }], cultures: [{ id: 'culture', settlementIds: ['place-a', 'place-b'] }], events: [], threads: [] };
  initializeEcology(w, api);
  for (const s of w.settlements) { const site = w.ecology.sites.find(v => v.id === s.ecology.siteId); Object.assign(site, { soil: 0.8, water: 0.8, arablePlots: 5, buildingLots: 8 }); s.ecology.plots = 2; s.ecology.nourishment = 20; }
  return w;
}

function advance(w, days) { const next = structuredClone(w); for (let i = 0; i < days; i++) { next.tick++; evolveEcology(next, api); } return next; }
const sum = (w, key) => w.settlements.reduce((n, s) => n + s[key], 0);
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 0.008, `${message}: ${actual} != ${expected}`);

function pressured(w) {
  const source = w.settlements[0], site = w.ecology.sites[0];
  Object.assign(site, { soil: 0.3, water: 0.2, arablePlots: 1 });
  Object.assign(source.ecology, { plots: 1, pressure: 12, waterworks: 2 });
  source.food = 20;
  return w;
}

test('a route and receiving capacity change the same household decision', () => {
  const open = pressured(fixture());
  const closed = structuredClone(open); closed.routes[0].open = false;
  const full = structuredClone(open); full.settlements[1].housingCapacity = full.settlements[1].population;
  assert.ok(advance(open, 1).events.some(e => e.kind === 'households-migrated'));
  assert.equal(advance(closed, 1).events.some(e => e.kind === 'households-migrated'), false);
  assert.equal(advance(full, 1).events.some(e => e.kind === 'households-migrated'), false);
});

test('a full pantry welcomes households without destroying or overfilling cargo', () => {
  const w = pressured(fixture()); w.settlements[1].food = 100;
  const after = advance(w, 1), event = after.events.find(e => e.kind === 'households-migrated');
  assert.ok(event);
  assert.equal(event.evidence.cargo.food, 0);
  assert.ok(after.settlements[1].food <= 100);
});

test('migration fits the actual free sleeping places and leaves followed people at home', () => {
  const w = pressured(fixture()); w.settlements[1].housingCapacity = 10;
  w.characters = [{ id: 'person', alive: true, residenceId: 'place-a', settlementId: 'place-a' }];
  const after = advance(w, 1), event = after.events.find(e => e.kind === 'households-migrated');
  assert.equal(event.evidence.amount, 2);
  assert.equal(after.characters[0].residenceId, 'place-a');
  assert.equal(sum(after, 'population'), sum(w, 'population'));
});

test('physical resource sufficiency changes the same adaptation opportunity', () => {
  const rich = pressured(fixture()); rich.routes[0].open = false;
  rich.ecology.sites[0].arablePlots = 4;
  const poor = structuredClone(rich); poor.settlements[0].materials = 0;
  assert.equal(advance(rich, 1).events.find(e => e.kind === 'settlement-adapted')?.decision.chosen, 'cultivate');
  assert.equal(advance(poor, 1).events.some(e => e.kind === 'settlement-adapted'), false);
});

test('household flows and decisions conserve each material except recorded production, use and waste', () => {
  const w = pressured(fixture());
  const after = advance(w, 180);
  for (const key of ['food', 'materials', 'energy']) {
    const ledger = after.ecology;
    near(sum(after, key), sum(w, key) + ledger.production[key] - ledger.consumed[key] - ledger.waste[key] - ledger.costs[key], key);
  }
  assert.equal(sum(after, 'population'), sum(w, 'population') + after.ecology.births);
  for (const s of after.settlements) for (const key of ['food', 'materials', 'energy']) assert.ok(s[key] >= 0 && s[key] <= 100);
});

test('founding requires a prior measured survey and moves existing people into actual buildings and a route', () => {
  let w = pressured(fixture()); w.routes[0].open = false;
  w.settlements[0].food = 30;
  for (const site of w.ecology.sites.filter(v => !v.settlementId)) Object.assign(site, { soil: 0.9, water: 0.9 });
  w = advance(w, 20);
  const event = w.events.find(e => e.kind === 'settlement-founded');
  assert.ok(event, 'An affordable, surveyed, viable place should be founded.');
  const survey = w.events.find(e => e.id === event.evidence.surveyEventId);
  assert.equal(survey.kind, 'site-surveyed'); assert.ok(survey.tick < event.tick);
  const founded = w.settlements.find(s => s.eventId === event.id);
  assert.ok(founded.structures.some(s => s.kind === 'home'));
  assert.ok(founded.structures.some(s => s.kind === 'garden'));
  assert.ok(w.routes.some(r => r.to === founded.id && r.open));
  assert.equal(event.evidence.before.population - event.evidence.after.population, event.evidence.destinationAfter.population);
  assert.equal(event.evidence.populationDelta, 0);
});

test('new places use the same adaptation rules as the initial settlements', () => {
  let w = pressured(fixture()); w.routes[0].open = false; w.settlements[0].food = 30;
  for (const site of w.ecology.sites.filter(v => !v.settlementId)) Object.assign(site, { soil: 0.9, water: 0.9 });
  w = advance(w, 20);
  const founded = w.settlements.find(s => s.foundedAt != null);
  assert.ok(founded);
  Object.assign(founded, { population: 15, food: 15, materials: 70, energy: 20, housingCapacity: 20 });
  Object.assign(founded.ecology, { pressure: 12, laborDebt: 0, plots: 1, waterworks: 2 });
  const site = w.ecology.sites.find(v => v.id === founded.ecology.siteId);
  Object.assign(site, { soil: 0.3, water: 0.2, arablePlots: 5 });
  for (const r of w.routes) if (r.from === founded.id || r.to === founded.id) r.open = false;
  const after = advance(w, 1);
  assert.equal(after.events.findLast(e => e.settlementId === founded.id && e.kind === 'settlement-adapted')?.decision.chosen, 'cultivate');
});

test('founding can evacuate a small household and preserves the place it leaves', () => {
  let w = pressured(fixture()); w.routes[0].open = false;
  Object.assign(w.settlements[0], { population: 6, housingCapacity: 4, food: 30 });
  w.ecology.sites[0].buildingLots = 1;
  for (const site of w.ecology.sites.filter(v => !v.settlementId)) Object.assign(site, { soil: 0.9, water: 0.9 });
  w = advance(w, 40);
  assert.equal(w.settlements[0].population, 0);
  const event = w.events.find(e => e.kind === 'settlement-founded');
  assert.ok(event);
  assert.equal(w.settlements[0].structures[0].abandonedByEventId, event.id);
  assert.ok(w.threads.filter(t => t.entityIds.includes(w.settlements[0].id)).every(t => t.status === 'resolved'));
});

test('actual abandonment preserves construction history and resolves household pressure', () => {
  const w = pressured(fixture());
  const source = w.settlements[0]; source.population = 2; source.food = 10;
  Object.assign(w.ecology.sites[0], { soil: 0.1, water: 0.12, buildingLots: 0 });
  source.ecology.soilCondition = 0.45;
  // Keep housing pressure real even for this very small household.
  source.housingCapacity = 0;
  const after = advance(w, 1);
  const event = after.events.find(e => e.kind === 'households-migrated');
  if (!event) return assert.fail('The household should have an available relocation.');
  assert.equal(after.settlements[0].population, 0);
  assert.equal(after.settlements[0].structures[0].kind, 'ruin');
  assert.equal(after.settlements[0].structures[0].abandonedByEventId, event.id);
  assert.ok(after.threads.every(thread => thread.status === 'resolved'));
});

test('one anonymous resident can leave and abandoned homes can be repaired by returning households', () => {
  const stranded = pressured(fixture());
  Object.assign(stranded.settlements[0], { population: 1, food: 10, housingCapacity: 0 });
  stranded.ecology.sites[0].buildingLots = 0;
  assert.equal(advance(stranded, 1).settlements[0].population, 0);

  const returning = pressured(fixture()), destination = returning.settlements[1];
  destination.population = 0; destination.food = 4;
  Object.assign(destination.structures[0], { kind: 'ruin', formerKind: 'home', abandonedAt: 0, eventId: 'original-building-event' });
  destination.structures.push({ id: 'another-home', name: 'Other rooms', kind: 'ruin', formerKind: 'home', abandonedAt: 0, eventId: 'original-other-event' });
  const after = advance(returning, 1), repaired = after.settlements[1].structures[0];
  assert.ok(after.settlements[1].population > 0);
  assert.equal(repaired.kind, 'home');
  assert.equal(repaired.eventId, 'original-building-event');
  assert.equal(repaired.abandonedAt, undefined);
  assert.ok(after.events.some(event => event.id === repaired.restoredByEventId));
  assert.ok(after.settlements[1].structures.some(b => b.kind === 'garden'));
  assert.equal(after.settlements[1].structures.find(b => b.id === 'another-home').kind, 'home');
  const event = after.events.find(e => e.id === repaired.restoredByEventId);
  assert.equal(event.evidence.costs.materials, 8 + destination.ecology.plots * 4 + (destination.housingCapacity - 8) / 4);
});

test('event-time numerical evidence remains unchanged after future choices', () => {
  const before = advance(pressured(fixture()), 1), event = before.events.find(e => e.decision);
  const evidence = structuredClone(event);
  const after = advance(before, 200);
  assert.deepEqual(after.events.find(e => e.id === event.id), evidence);
  assert.deepEqual(before.events.find(e => e.id === event.id), evidence);
  assert.equal(event.decision.alternatives.find(a => a.id === event.decision.chosen)?.available, true);
});

test('equal state replays identically across chunking and JSON round trips', () => {
  const w = pressured(fixture());
  assert.deepEqual(advance(w, 300), advance(JSON.parse(JSON.stringify(advance(w, 111))), 189));
});

test('changing names and IDs leaves physical decisions and results unchanged', () => {
  const w = pressured(fixture());
  const replacements = new Map([['place-a', 'arbitrary-z'], ['place-b', 'arbitrary-y'], ['Alder', 'Kestrel'], ['Birch', 'Cloud'], ['path', 'another-route'], ['culture', 'custom-culture'], ['home-place-a', 'custom-home-z'], ['home-place-b', 'custom-home-y']]);
  const renamed = JSON.parse(JSON.stringify(w), (_, value) => typeof value === 'string' && replacements.has(value) ? replacements.get(value) : value);
  const a = advance(w, 40), b = advance(renamed, 40);
  assert.deepEqual(a.settlements.map(s => [s.x, s.y, s.population, s.food, s.materials, s.energy, s.ecology.plots]), b.settlements.map(s => [s.x, s.y, s.population, s.food, s.materials, s.energy, s.ecology.plots]));
  assert.deepEqual(a.events.map(e => [e.tick, e.kind, e.decision?.chosen?.split(':')[0]]), b.events.map(e => [e.tick, e.kind, e.decision?.chosen?.split(':')[0]]));
});

test('landscape differences are numeric, bounded and causally affect the same budget', () => {
  const a = fixture(1), b = fixture(2);
  assert.notDeepEqual(a.ecology.sites, b.ecology.sites);
  for (const w of [a, b]) for (const [i, site] of w.ecology.sites.entries()) {
    assert.ok(site.x >= 0 && site.x <= 1200 && site.y >= 0 && site.y <= 800);
    for (const previous of w.ecology.sites.slice(0, i)) assert.ok(Math.hypot(site.x - previous.x, site.y - previous.y) >= 195);
  }
  const before = ecologyBudget(a, a.settlements[0]);
  a.ecology.sites[0].water = 0.15;
  assert.ok(ecologyBudget(a, a.settlements[0]).foodBalance < before.foodBalance);
});
