/**
 * Read-only statistics over a canonical snapshot. DTO version 1 contains stable
 * stat IDs, readable labels, finite numeric values, and optional display units.
 * Nothing here advances the simulation, records telemetry, or invents a skill.
 */
const VERSION = 1;
const INTERVENTION_EVENTS = Object.freeze({
  'open-route': 'passage-opened',
  'reveal-relic': 'relic-exposed',
  'restore-habitat': 'spring-restored',
  'offer-refuge': 'refuge-possible',
});
const EVENT_CATEGORIES = ['personal', 'cultural', 'infrastructural', 'civilizational'];

function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`Cannot calculate statistics: ${label} is not a finite number.`);
  return value;
}
function entry(id, label, value, unit) {
  // Rounding is presentation only; canonical inputs are never rounded or edited.
  const rounded = Number(finite(value, id).toFixed(2));
  return { id, label, value: rounded, ...(unit ? { unit } : {}) };
}
function count(items, predicate) { return items.reduce((total, item) => total + (predicate(item) ? 1 : 0), 0); }
function total(items, field) { return items.reduce((sum, item) => sum + finite(item[field], field), 0); }
function unique(values) { return new Set(values).size; }
function validateSnapshot(world) {
  if (!world || typeof world !== 'object') throw new TypeError('Statistics need a recorded world snapshot.');
  finite(world.tick, 'world day');
  for (const key of ['regions', 'settlements', 'characters', 'routes', 'cultures', 'institutions', 'events', 'threads']) {
    if (!Array.isArray(world[key])) throw new TypeError(`Statistics need the recorded ${key} list.`);
  }
}

function appendHistoryStats(stats, world, history) {
  if (!history || !Array.isArray(history.branches)) return;
  const branch = history.branches.find(item => item.id === history.activeBranchId);
  if (!branch || !Array.isArray(branch.commands) || branch.head.tick < world.tick) return;
  // A caller must supply the selected branch's history. World facts always come
  // from the supplied snapshot, never the head of a more advanced branch.
  if (branch.head.seed !== world.seed || branch.head.tier !== world.tier) return;
  for (const setting of ['climate', 'temperament', 'density']) if (branch.head.config[setting] !== world.config[setting]) return;
  let commands = 0, interventions = 0, daysAdvanced = 0;
  const byKind = Object.fromEntries(Object.keys(INTERVENTION_EVENTS).map(kind => [kind, 0]));
  for (const recorded of branch.commands) {
    if (recorded.atTick > world.tick) break;
    const command = recorded.command;
    if (command.type === 'advance') {
      const days = Math.min(command.days, world.tick - recorded.atTick);
      if (days > 0) { commands++; daysAdvanced += days; }
    } else if (command.type === 'intervene') {
      // Same-day actions may have been issued after an older in-memory snapshot
      // was captured. A command counts only when its actual event is present.
      const { kind, targetId } = command.intervention;
      const represented = world.events.some(event => event.tick === recorded.atTick && event.kind === INTERVENTION_EVENTS[kind] && event.entities.includes(targetId));
      if (represented) { commands++; interventions++; byKind[kind]++; }
    }
  }
  stats.push(
    entry('history.branches', 'Retained histories (archive)', history.branches.length),
    entry('history.commands', 'Commands through this day', commands),
    entry('history.daysAdvanced', 'Days advanced in this history', daysAdvanced, 'days'),
    entry('history.interventions', 'Interventions through this day', interventions),
    entry('history.interventions.open-route', 'Passages opened by intervention', byKind['open-route']),
    entry('history.interventions.reveal-relic', 'Relics exposed by intervention', byKind['reveal-relic']),
    entry('history.interventions.restore-habitat', 'Habitats restored by intervention', byKind['restore-habitat']),
    entry('history.interventions.offer-refuge', 'Refuges offered by intervention', byKind['offer-refuge']),
  );
}

/** Return a version-1 world DTO. Optional archive metadata uses its active branch. */
export function getWorldStats(world, history) {
  validateSnapshot(world);
  const settlements = world.settlements;
  const structures = settlements.flatMap(place => place.structures);
  const relationshipPairs = new Set();
  for (const person of world.characters) for (const relation of person.relationships) relationshipPairs.add([person.id, relation.otherId].sort().join('\u0000'));
  const stats = [
    entry('time.days', 'Recorded history', world.tick, 'days'),
    entry('regions.total', 'Regions', world.regions.length),
    entry('settlements.total', 'Recorded places', settlements.length),
    entry('settlements.occupied', 'Inhabited places', count(settlements, place => place.population + place.synthetics + place.collective > 0)),
    entry('settlements.empty', 'Places without inhabitants', count(settlements, place => place.population + place.synthetics + place.collective === 0)),
    entry('population.organic', 'Organic residents', total(settlements, 'population')),
    entry('population.synthetic', 'Active synthetic bodies', total(settlements, 'synthetics')),
    entry('population.collective', 'Living collective nodes', total(settlements, 'collective')),
    entry('characters.alive', 'Living focal people', count(world.characters, person => person.alive)),
    entry('characters.remembered', 'Deceased focal people', count(world.characters, person => !person.alive)),
    entry('characters.relationships', 'Recorded relationships', relationshipPairs.size),
    entry('characters.memories', 'Memories held across the cast', world.characters.reduce((sum, person) => sum + unique(person.memories), 0)),
    entry('structures.total', 'Recorded structures and traces', structures.length),
    entry('structures.built', 'Structures built after the founding day', count(structures, structure => finite(structure.builtAt, 'construction day') > 0 && structure.builtAt <= world.tick)),
    entry('structures.abandoned', 'Abandoned structures', count(structures, structure => structure.abandonedAt != null && finite(structure.abandonedAt, 'abandonment day') <= world.tick)),
    entry('structures.ruins', 'Surviving ruins', count(structures, structure => structure.kind === 'ruin')),
    entry('routes.total', 'Recorded routes', world.routes.length),
    entry('routes.open', 'Usable routes', count(world.routes, route => route.open)),
    entry('cultures.total', 'Living cultural records', world.cultures.length),
    entry('institutions.total', 'Institutions in the record', world.institutions.length),
    entry('institutions.active', 'Institutions with their original charter', count(world.institutions, institution => institution.status === 'active')),
    entry('institutions.changed', 'Institutions with a changed charter', count(world.institutions, institution => institution.status === 'changed')),
    entry('institutions.collapsed', 'Collapsed institutions', count(world.institutions, institution => institution.status === 'collapsed')),
    entry('threads.open', 'Unresolved threads', count(world.threads, thread => thread.status === 'open')),
    entry('threads.resolved', 'Resolved threads', count(world.threads, thread => thread.status === 'resolved')),
    entry('events.total', 'Recorded events', world.events.length),
    ...EVENT_CATEGORIES.map(category => entry(`events.${category}`, `${category[0].toUpperCase()}${category.slice(1)} events`, count(world.events, event => event.category === category))),
    entry('resources.food', 'Combined food reserves', total(settlements, 'food'), 'model units'),
    entry('resources.energy', 'Combined energy reserves', total(settlements, 'energy'), 'model units'),
    entry('resources.materials', 'Combined material reserves', total(settlements, 'materials'), 'model units'),
    entry('resources.habitatMean', 'Mean habitat across recorded places', settlements.length ? total(settlements, 'habitat') / settlements.length : 0, '/100'),
    entry('knowledge.settlementScores', 'Knowledge scores across places', total(settlements, 'knowledge'), 'model units'),
    entry('power.recorded', 'Recorded emergent powers', world.power ? 1 : 0),
    entry('power.active', 'Active emergent powers', world.power?.active ? 1 : 0),
    entry('power.materialResponses', 'Recorded material responses', count(world.events, event => event.kind === 'power-emerged' || event.kind === 'power-redistribution')),
    entry('power.redistributions', 'Independent redistributions', count(world.events, event => event.kind === 'power-redistribution')),
  ];
  if (world.power) stats.push(
    entry('power.strength', `${world.power.name}: modeled strength`, world.power.strength, '/100'),
    entry('power.daysSinceEmergence', 'Days since the first answering current', world.tick - finite(world.power.emergedAt, 'power emergence day'), 'days'),
    entry('power.daysSinceResponse', 'Days since the last material response', world.tick - finite(world.power.lastActAt, 'last power response'), 'days'),
  );
  if (world.flags.sharedNetwork) stats.push(
    entry('network.storedCharge', 'Charge stored in the shared channel', world.flags.networkCharge, 'model units'),
    entry('network.transferredCharge', 'Charge supplied to the shared channel', world.flags.networkTransfers, 'model units'),
  );
  appendHistoryStats(stats, world, history);
  return { version: VERSION, scope: 'world', tick: world.tick, entityId: null, name: 'The Quiet Basin', stats };
}

/** Return a version-1 person DTO, or null when the ID is not a focal character. */
export function getPersonStats(world, id) {
  validateSnapshot(world);
  const person = world.characters.find(item => item.id === id);
  if (!person) return null;
  const stats = [
    entry('person.alive', 'Living', person.alive ? 1 : 0),
    entry('motive.care', 'Care', person.motives.care, '/100'),
    entry('motive.curiosity', 'Curiosity', person.motives.curiosity, '/100'),
    entry('motive.duty', 'Duty', person.motives.duty, '/100'),
    entry('person.knowledge', 'Events known', unique(person.knowledge)),
    entry('person.memories', 'Personal memories', unique(person.memories)),
    entry('person.relationships', 'Recorded relationships', unique(person.relationships.map(relation => relation.otherId))),
    entry('person.appearances', 'Appearances in recorded events', count(world.events, event => event.entities.includes(person.id))),
    entry('person.decisions', 'Recorded consequential decisions', count(world.events, event => event.decision?.actorId === person.id)),
    entry('person.institutionalTies', 'Recorded institutional ties', count(world.institutions, institution => institution.members.includes(person.id))),
    entry('person.continuingTies', 'Ties to continuing institutions', count(world.institutions, institution => institution.status !== 'collapsed' && institution.members.includes(person.id))),
  ];
  if (person.bornAt != null && (person.alive || person.diedAt != null)) {
    const endDay = person.alive ? world.tick : finite(person.diedAt, 'death day');
    const ageDays = Math.max(0, endDay - finite(person.bornAt, 'birth day'));
    stats.unshift(entry('person.ageYears', person.alive ? 'Age' : 'Age at death', Math.floor(ageDays / 365), 'years'), entry('person.ageDays', 'Recorded lifespan', ageDays, 'days'));
  }
  for (const relation of [...person.relationships].sort((left, right) => left.otherId.localeCompare(right.otherId))) {
    const other = world.characters.find(item => item.id === relation.otherId);
    stats.push(entry(`relationship.${relation.otherId}.strength`, `${other?.name ?? relation.otherId}: ${relation.label}`, relation.strength, '/100'));
  }
  return { version: VERSION, scope: 'person', tick: world.tick, entityId: person.id, name: person.name, stats };
}
