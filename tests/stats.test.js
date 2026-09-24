import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, advance } from '../src/sim/world.js';
import { createHistory, currentWorld, applyCommand, worldAt, forkHistory, serializeHistory } from '../src/persistence/history.js';
import { getWorldStats, getPersonStats } from '../src/stats.js';

const values = dto => Object.fromEntries(dto.stats.map(stat => [stat.id, stat.value]));
const move = (history, days) => applyCommand(history, { type: 'advance', days });
function developedHistory() {
  let history = createHistory({ tier: 2 });
  history = applyCommand(history, { type: 'intervene', intervention: { kind: 'open-route', targetId: 'r-hearth-lattice' } });
  history = move(history, 4);
  history = applyCommand(history, { type: 'intervene', intervention: { kind: 'offer-refuge', targetId: 's-hearth' } });
  return move(history, 56);
}

test('world statistics count actual forms, construction, culture, institution and material-response records', () => {
  const history = developedHistory();
  const world = currentWorld(history);
  const dto = getWorldStats(world, history);
  const stats = values(dto);
  assert.equal(dto.version, 1);
  assert.equal(dto.scope, 'world');
  assert.equal(dto.tick, 60);
  assert.equal(stats['population.organic'], world.settlements.reduce((sum, place) => sum + place.population, 0));
  assert.equal(stats['population.synthetic'], world.settlements.reduce((sum, place) => sum + place.synthetics, 0));
  assert.equal(stats['population.collective'], world.settlements.reduce((sum, place) => sum + place.collective, 0));
  assert.ok(stats['structures.built'] > 0);
  assert.ok(stats['structures.abandoned'] >= 1);
  assert.equal(stats['cultures.total'], 4);
  assert.equal(stats['institutions.collapsed'], 2);
  assert.equal(stats['power.recorded'], 1);
  assert.equal(stats['power.materialResponses'], world.events.filter(event => ['power-emerged', 'power-redistribution'].includes(event.kind)).length);
  assert.equal(stats['power.redistributions'], world.flags.powerActs);
  assert.equal(stats['history.interventions'], 2);
  assert.equal(stats['history.interventions.open-route'], 1);
  assert.equal(stats['history.interventions.offer-refuge'], 1);
  assert.equal(stats['history.daysAdvanced'], 60);
  assert.equal(stats['events.total'], stats['events.personal'] + stats['events.cultural'] + stats['events.infrastructural'] + stats['events.civilizational']);
});

test('a historical snapshot never reads later populations, structures, culture, power or actions from the history head', () => {
  const history = developedHistory();
  const early = values(getWorldStats(worldAt(history, 3), history));
  const later = values(getWorldStats(currentWorld(history), history));
  assert.equal(early['time.days'], 3);
  assert.equal(early['power.recorded'], 0);
  assert.equal(early['power.materialResponses'], 0);
  assert.equal(early['network.storedCharge'], undefined);
  assert.equal(early['cultures.total'], 3);
  assert.ok(early['structures.total'] < later['structures.total']);
  assert.ok(early['population.collective'] < later['population.collective']);
  assert.equal(early['institutions.collapsed'], 1);
  assert.equal(early['history.interventions'], 1);
  assert.equal(early['history.interventions.offer-refuge'], 0);
  assert.equal(early['history.commands'], 2, 'Only the route opening and the elapsed part of advance are represented.');
  assert.equal(early['history.daysAdvanced'], 3);
});

test('an older same-day snapshot does not count interventions issued later that day', () => {
  const beginning = createHistory({ tier: 2 });
  const snapshotBeforeAction = currentWorld(beginning);
  const history = applyCommand(beginning, { type: 'intervene', intervention: { kind: 'open-route', targetId: 'r-hearth-lattice' } });
  const before = values(getWorldStats(snapshotBeforeAction, history));
  const after = values(getWorldStats(currentWorld(history), history));
  assert.equal(before['history.interventions'], 0);
  assert.equal(before['history.commands'], 0);
  assert.equal(after['history.interventions'], 1);
  assert.equal(after['history.commands'], 1);
  assert.equal(before['routes.open'] + 1, after['routes.open']);
  assert.equal(after['history.daysAdvanced'], 0);
});

test('archive metadata is explicit and command statistics require matching actual history', () => {
  let history = developedHistory();
  history = forkHistory(history, 2, 'Earlier possibility');
  const dto = getWorldStats(currentWorld(history), history);
  assert.equal(values(dto)['history.branches'], 2);
  assert.match(dto.stats.find(stat => stat.id === 'history.branches').label, /archive/);
  assert.equal(values(dto)['history.interventions'], 1);
  assert.equal(values(dto)['history.interventions.offer-refuge'], 0);
  const noHistory = getWorldStats(currentWorld(history));
  assert.equal(noHistory.stats.some(stat => stat.id.startsWith('history.')), false);
  const unrelated = getWorldStats(createWorld({ tier: 2, seed: 992 }), history);
  assert.equal(unrelated.stats.some(stat => stat.id.startsWith('history.')), false);
});

test('person statistics preserve actual motives, age, known records and directed relationship strength at the requested day', () => {
  const history = developedHistory();
  const earlyWorld = worldAt(history, 1);
  const laterWorld = currentWorld(history);
  const earlyDto = getPersonStats(earlyWorld, 'c-nera');
  const early = values(earlyDto);
  const later = values(getPersonStats(laterWorld, 'c-nera'));
  const nera = earlyWorld.characters.find(person => person.id === 'c-nera');
  assert.equal(earlyDto.entityId, nera.id);
  assert.equal(earlyDto.scope, 'person');
  assert.equal(early['motive.care'], nera.motives.care);
  assert.equal(early['motive.curiosity'], nera.motives.curiosity);
  assert.equal(early['motive.duty'], nera.motives.duty);
  assert.equal(early['person.ageDays'], earlyWorld.tick - nera.bornAt);
  assert.equal(early['person.ageYears'], Math.floor((earlyWorld.tick - nera.bornAt) / 365));
  assert.equal(early['person.decisions'], 0);
  assert.ok(later['person.decisions'] > 0);
  assert.ok(later['person.memories'] > early['person.memories']);
  assert.ok(later['relationship.c-oren.strength'] > early['relationship.c-oren.strength']);
  assert.equal(getPersonStats(laterWorld, 's-hearth'), null);
  assert.equal(getPersonStats(laterWorld, 'not-a-person'), null);
});

test('age stops at a recorded death while inherited people and memories remain queryable', () => {
  const world = advance(createWorld({ tier: 2 }), 5000);
  const ivo = world.characters.find(person => person.id === 'c-ivo');
  assert.equal(ivo.alive, false);
  const dto = getPersonStats(world, ivo.id);
  const stats = values(dto);
  assert.equal(stats['person.alive'], 0);
  assert.equal(stats['person.ageDays'], ivo.diedAt - ivo.bornAt);
  assert.equal(stats['person.ageYears'], 84);
  assert.match(dto.stats.find(stat => stat.id === 'person.ageYears').label, /death/);
  assert.ok(getPersonStats(world, 'c-lio'));
  assert.ok(stats['person.memories'] > 0);
});

test('statistics leave worlds, replay bytes and preferences unchanged; returned DTOs own their data', () => {
  const history = developedHistory();
  const world = currentWorld(history);
  const beforeWorld = JSON.stringify(world);
  const beforeHistory = serializeHistory(history);
  const summary = getWorldStats(world, history);
  const person = getPersonStats(world, 'c-nera');
  summary.stats[0].value = 999;
  person.stats[0].value = 999;
  summary.stats.push({ id: 'consumer.example', label: 'Local display data', value: 42 });
  assert.equal(JSON.stringify(world), beforeWorld);
  assert.equal(serializeHistory(history), beforeHistory);
  assert.equal(values(getWorldStats(world))['time.days'], 60);
  assert.notEqual(values(getPersonStats(world, 'c-nera'))['person.ageYears'], 999);
});

test('stat IDs are unique and values finite; corrupt numeric inputs fail visibly instead of becoming zeroes', () => {
  const history = developedHistory();
  const world = currentWorld(history);
  for (const dto of [getWorldStats(world, history), ...world.characters.map(person => getPersonStats(world, person.id))]) {
    assert.equal(new Set(dto.stats.map(stat => stat.id)).size, dto.stats.length);
    for (const stat of dto.stats) {
      assert.equal(typeof stat.label, 'string');
      assert.ok(stat.label.length > 0);
      assert.ok(Number.isFinite(stat.value), stat.id);
    }
  }
  const brokenPopulation = structuredClone(world);
  brokenPopulation.settlements[0].population = NaN;
  assert.throws(() => getWorldStats(brokenPopulation), /not a finite number/);
  const brokenMotive = structuredClone(world);
  brokenMotive.characters[0].motives.care = Infinity;
  assert.throws(() => getPersonStats(brokenMotive, brokenMotive.characters[0].id), /not a finite number/);
});
