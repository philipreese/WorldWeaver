
/**
 * The Quiet Basin's only source of historical truth.
 * Protected invariant: scene claims follow state changes and point to their event;
 * decisions retain what the actor knew BEFORE the choice, never reconstructed facts.
 * All updates clone JSON state. No clock, renderer, storage, or network enters here.
 */
const VERSION = '1.0.0';
const MAX_TICK = 6000;
const CONFIG = { climate: ['temperate', 'dry', 'wet'], temperament: ['careful', 'curious', 'communal'], density: ['sparse', 'balanced', 'dense'] };
const clone = value => structuredClone(value);
const clamp = (n, min = 0, max = 100) => Math.round(Math.min(max, Math.max(min, n)) * 100) / 100;
const settlement = (w, id) => w.settlements.find(s => s.id === id);
const character = (w, id) => w.characters.find(c => c.id === id);
const route = (w, id) => w.routes.find(r => r.id === id);
const structure = (w, id) => w.settlements.flatMap(s => s.structures).find(s => s.id === id);
const lastEvent = (w, kind) => w.events.findLast(e => e.kind === kind);
const unique = values => [...new Set(values.filter(Boolean))];

function random(w) {
  let x = w.rng || 0x9e3779b9;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  w.rng = x >>> 0;
  return w.rng / 4294967296;
}

function addEvent(w, details) {
  const event = {
    id: `e-${String(w.events.length + 1).padStart(5, '0')}`, tick: w.tick,
    kind: details.kind, category: details.category || 'personal',
    title: details.title, text: details.text,
    entities: unique(details.entities || []), settlementId: details.settlementId || 's-hearth',
    severity: details.severity || 1, causes: unique(details.causes || []),
    observed: details.observed || [], interpretations: details.interpretations || [],
    ...(details.family ? { family: details.family } : {}),
    ...(details.decision ? { decision: details.decision } : {}),
  };
  w.events.push(event);
  for (const c of w.characters) {
    if (!c.alive) continue;
    if (c.settlementId === event.settlementId || event.entities.includes(c.id)) {
      c.knowledge = unique([...c.knowledge, event.id]);
      if (event.entities.includes(c.id) || event.severity === 3) c.memories = unique([...c.memories, event.id]);
    }
  }
  return event;
}

function addStructure(w, s, values, event) {
  if (s.structures.some(v => v.id === values.id)) return;
  s.structures.push({ entityType: 'structure', settlementId: s.id, builtAt: w.tick, eventId: event.id, ...values });
  if (!event.entities.includes(values.id)) event.entities.push(values.id);
}

function resolveThread(w, id, event, summary) {
  const t = w.threads.find(v => v.id === id);
  if (t) { t.status = 'resolved'; t.eventId = event.id; if (summary) t.summary = summary; }
}

function openThread(w, values, event) {
  if (w.threads.some(t => t.id === values.id)) return;
  w.threads.push({ status: 'open', eventId: event.id, ...values });
}

function relationship(a, b, amount, label) {
  let link = a.relationships.find(r => r.otherId === b.id);
  if (!link) { link = { otherId: b.id, label, strength: 35 }; a.relationships.push(link); }
  link.strength = clamp(link.strength + amount);
  if (label) link.label = label;
}

function decision(actor, known, alternatives, chosen, motives = []) {
  if (!alternatives.some(a => a.id === chosen && a.available)) throw new Error('A character cannot choose an unavailable alternative.');
  return {
    actorId: actor.id, known, motives: [...motives, `Commitment: ${actor.commitment}`],
    alternatives, chosen,
  };
}

function initialStructure(id, name, kind, x, y, description, lore = '') {
  return { id, entityType: 'structure', name, kind, x, y, builtAt: 0, eventId: 'e-00001', description, ...(lore ? { lore } : {}) };
}

export function createWorld(options = {}) {
  const { seed = 8417, tier = 1, climate = 'temperate', temperament = 'careful', density = 'balanced' } = options;
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw new Error('Seed must be an integer from 0 to 4294967295.');
  if (tier !== 1 && tier !== 2) throw new Error('This release supports tiers 1 and 2.');
  for (const [key, value] of Object.entries({ climate, temperament, density })) if (!CONFIG[key].includes(value)) throw new Error(`Unknown ${key}: ${value}.`);
  const habitatOffset = climate === 'dry' ? -15 : climate === 'wet' ? 12 : 0;
  const population = density === 'sparse' ? 32 : density === 'dense' ? 64 : 46;
  const w = {
    version: VERSION, seed, rng: seed >>> 0, tick: 0, tier,
    config: { climate, temperament, density },
    regions: [
      { id: 'reg-reed', entityType: 'region', name: 'Reed Basin', x: 330, y: 520, color: '#c8a563', description: 'Warm wet terraces folded around a machine no living person remembers starting.' },
      { id: 'reg-glass', entityType: 'region', name: 'Glass Reach', x: 870, y: 355, color: '#84d6e5', description: 'Glass ribs drink the sun above a slowly settling causeway.' },
      { id: 'reg-ash', entityType: 'region', name: 'Ash Fold', x: 580, y: 180, color: '#83c7a0', description: 'A green rain basin beneath an enormous broken crescent.' },
    ],
    settlements: [
      { id: 's-hearth', entityType: 'settlement', name: 'Hearth', regionId: 'reg-reed', x: 420, y: 470, habitat: clamp(58 + habitatOffset), energy: 49, materials: 42, food: 39, population, synthetics: 0, collective: 0, knowledge: 12, cultureId: 'culture-table', institutionId: 'i-ledger', housingCapacity: population + 4, structures: [
        initialStructure('k-hearth-door', 'The Unfinished Door', 'ruin', 0, -70, 'The opening survey recorded this immense broken ring. Homes now gather in its shelter.', 'Lore: Ivo says it was a doorway. Senn points out that nobody agrees which side was inside.'),
        initialStructure('k-hearth-table', 'The Warm Table', 'home', -90, 0, 'Nera keeps one seat empty for whoever arrives late.'),
        initialStructure('k-hearth-archive', 'Seed Archive', 'archive', 80, -10, 'A low room of seed vessels and hand-copied migration ledgers. Its cooling seam is damaged.'),
        initialStructure('k-hearth-garden', 'Senn’s Rain Garden', 'garden', -45, 85, 'Senn labels edible stems and vehemently refuses to label the weeds.'),
        initialStructure('k-hearth-yard', 'Ivo’s Mending Yard', 'workshop', 65, 95, 'Little objects from Old Hollow hang beside tools still in use.'),
      ] },
      { id: 's-lattice', entityType: 'settlement', name: 'Lattice', regionId: 'reg-glass', x: 840, y: 360, habitat: clamp(43 + habitatOffset), energy: 79, materials: 72, food: 54, population: 14, synthetics: 0, collective: 0, knowledge: 25, cultureId: 'culture-table', institutionId: 'i-carriers', housingCapacity: 22, structures: [
        initialStructure('k-lattice-hall', 'Carrier House', 'home', -55, 25, 'Oren keeps unpacked letters on a shelf facing the western passage.'),
        initialStructure('k-lattice-glass', 'The Listening Glass', 'spire', 28, -45, 'An inherited solar collector. Its readable output is energy; its original purpose is unknown.'),
        initialStructure('k-lattice-yard', 'Pattern Yard', 'workshop', 72, 65, 'Repair patterns are kept here on washable ceramic leaves.'),
      ] },
      { id: 's-choir', entityType: 'settlement', name: 'Choir', regionId: 'reg-ash', x: 580, y: 200, habitat: clamp(80 + habitatOffset), energy: 38, materials: 32, food: 65, population: 16, synthetics: 0, collective: 0, knowledge: 18, cultureId: 'culture-table', institutionId: 'i-rain', housingCapacity: 24, structures: [
        initialStructure('k-choir-garden', 'The Rain Rooms', 'garden', -45, 50, 'Roofless rooms guide water through deliberately porous walls.'),
        initialStructure('k-choir-house', 'Mira’s Dry Step', 'home', 55, 20, 'A house small enough that its owner always has to lend a chair.'),
        initialStructure('k-choir-ring', 'The Tilted Halo', 'ruin', 0, -70, 'The first survey found living roots wrapped around the broken conductor.', 'Lore: the oldest account says the sky once rested here. Mira calls that an unhelpful measurement.'),
      ] },
      { id: 's-hollow', entityType: 'settlement', name: 'Old Hollow', regionId: 'reg-reed', x: 190, y: 280, habitat: 24, energy: 5, materials: 16, food: 4, population: 6, synthetics: 0, collective: 0, knowledge: 8, cultureId: 'culture-table', institutionId: 'i-hollow', housingCapacity: 12, structures: [
        initialStructure('k-hollow-hall', 'The Empty Drying Hall', 'home', -35, 25, 'The lintel bears the height marks of people who left together.'),
        initialStructure('k-hollow-relic', 'Buried Rain Memory', 'ruin', 45, -30, 'A patterned ceramic chamber is visible under the settling bank.', 'Lore: a vessel for remembering rain, according to an account no surviving record can verify.'),
      ] },
    ],
    characters: [],
    routes: [
      { id: 'r-hearth-lattice', entityType: 'route', name: 'The Silt Saddle', from: 's-hearth', to: 's-lattice', open: false, terrain: 'A stable stone sill lies under loose silt; a passage can be exposed.', history: [], passable: true },
      { id: 'r-hearth-choir', entityType: 'route', name: 'The Rain Path', from: 's-hearth', to: 's-choir', open: true, terrain: 'A walkable reed terrace, already used by the rain keepers.', history: [], passable: true },
      { id: 'r-hollow-hearth', entityType: 'route', name: 'The Leaving Steps', from: 's-hollow', to: 's-hearth', open: true, terrain: 'Narrow dry steps remain usable after the evacuation.', history: [], passable: true },
    ],
    cultures: [{ id: 'culture-table', entityType: 'culture', name: 'The Warm Table', settlementIds: ['s-hearth', 's-lattice', 's-choir', 's-hollow'], practice: 'Record a debt as a name, and leave space for a new arrival.', interpretation: 'A useful thing is something you can pass to another person.' }],
    institutions: [
      { id: 'i-ledger', entityType: 'institution', name: 'The Ember Ledger', settlementId: 's-hearth', members: ['c-nera', 'c-senn', 'c-tavi'], status: 'active', practice: 'Stores and seed obligations are witnessed at the Warm Table.', history: [] },
      { id: 'i-carriers', entityType: 'institution', name: 'The Carriers’ Shelf', settlementId: 's-lattice', members: ['c-oren'], status: 'active', practice: 'Keep a repair pattern beside every remembered route.', history: [] },
      { id: 'i-rain', entityType: 'institution', name: 'The Rain Keepers', settlementId: 's-choir', members: ['c-mira'], status: 'active', practice: 'Leave channels open for the next people downstream.', history: [] },
      { id: 'i-hollow', entityType: 'institution', name: 'The Drying Circle', settlementId: 's-hollow', members: ['c-ivo'], status: 'active', practice: 'Mend a neighbor’s tools before your own.', history: [] },
    ],
    power: null, events: [], threads: [],
    flags: { archiveThreat: true, seedIntegrity: 43, archiveResolved: null, contacts: 0, exchanges: 0, relicRevealed: false, habitatRestored: false, refugeOffered: false, recovery: false, gardenEfficiency: 0, growthCount: 0, sceneCounts: {}, lore: 'Lore: people call this basin the footprint of a sleeping sky. The recorded history begins with the survey below.' },
  };
  const characterDefs = [
    ['c-nera', 'Nera', 'storekeeper', 's-hearth', 'I will not make a stranger pay for a promise I made.', 'Counts plates before people. When frightened, becomes excessively polite.', { care: temperament === 'communal' ? 98 : 82, curiosity: temperament === 'curious' ? 94 : 42, duty: temperament === 'careful' ? 90 : 59 }],
    ['c-senn', 'Senn', 'gardener', 's-hearth', 'A preserved seed is a promise to plant it.', 'Talks to seedlings as if negotiating rent. Deeply suspicious of neat rows.', { care: 87, curiosity: 63, duty: 52 }],
    ['c-ivo', 'Ivo', 'mender', 's-hollow', 'What we carry from Hollow must remain useful.', 'Repairs handles too large for his own hands. Saves every bent nail.', { care: 78, curiosity: 40, duty: 83 }],
    ['c-tavi', 'Tavi', 'archivist', 's-hearth', 'A record should tell you who was missing, too.', 'Writes precise headings over extremely untidy notes. Laughs a beat too late.', { care: 68, curiosity: 91, duty: 77 }],
    ['c-daro', 'Daro', 'braider', 's-hearth', 'Nobody should eat alone because they arrived late.', 'Braids reed mats in patterns nobody can quite copy, including Daro.', { care: 96, curiosity: 49, duty: 62 }],
    ['c-ves', 'Ves', 'apprentice', 's-hearth', 'Learn one thing properly before calling it impossible.', 'Asks an excellent question, then ruins it with three more.', { care: 65, curiosity: 95, duty: 38 }],
    ['c-oren', 'Oren', 'pattern carrier', 's-lattice', 'A repair kept secret is a broken thing in waiting.', 'Has a solemn face and an appalling collection of puns about bridges.', { care: 80, curiosity: 85, duty: 64 }],
    ['c-mira', 'Mira', 'channel keeper', 's-choir', 'The water belongs downstream as much as here.', 'Leaves mud on every threshold except her own, which she calls research.', { care: 88, curiosity: 78, duty: 74 }],
  ];
  w.characters = characterDefs.map(([id, name, role, settlementId, commitment, description, motives], index) => ({
    id, entityType: 'character', name, role, settlementId, x: index * 9 - 25, y: index * 5,
    activity: 'Settling into the morning', motives, commitment, relationships: [], knowledge: [], memories: [], alive: true, bornAt: -365 * (index === 2 ? 73 : 23 + index * 4), description,
    homeId: settlement(w, settlementId).structures.find(s => s.kind === 'home')?.id || null,
  }));
  for (const [a, b, label, strength] of [['c-nera', 'c-senn', 'old friend; regular disagreement', 73], ['c-nera', 'c-oren', 'correspondent', 48], ['c-ivo', 'c-ves', 'patient teacher', 58], ['c-tavi', 'c-daro', 'shares supper and unfinished sentences', 71], ['c-mira', 'c-senn', 'trades practical advice', 63]]) {
    character(w, a).relationships.push({ otherId: b, label, strength });
    character(w, b).relationships.push({ otherId: a, label, strength });
  }
  for (const s of w.settlements) for (const b of s.structures) b.settlementId = s.id;
  const survey = addEvent(w, { kind: 'founding-survey', category: 'civilizational', severity: 2, title: 'The first shared survey', text: 'Four places enter one record. Hearth’s families occupy rooms beneath the Unfinished Door; Lattice keeps repair patterns; Choir keeps the rain channels. Old Hollow still has six residents.', entities: [...w.settlements.map(s => s.id), ...w.settlements.flatMap(s => s.structures.map(b => b.id)), ...w.characters.map(c => c.id)], observed: w.settlements.map(s => `${s.name}: ${s.population} organic residents, ${s.structures.length} recorded structures.`) });
  for (const inst of w.institutions) inst.history.push(survey.id);
  for (const r of w.routes) r.history.push(survey.id);
  const hollow = settlement(w, 's-hollow');
  const hearth = settlement(w, 's-hearth');
  hollow.population = 0; hearth.population += 6; hearth.housingCapacity += 6;
  character(w, 'c-ivo').settlementId = hearth.id; character(w, 'c-ivo').homeId = 'k-hearth-table';
  structure(w, 'k-hollow-hall').kind = 'ruin'; structure(w, 'k-hollow-hall').abandonedAt = 0;
  const departing = addEvent(w, { kind: 'hollow-departure', category: 'civilizational', severity: 2, family: 'recovery', title: 'Six names carried out of Hollow', text: 'Ivo and five neighbors leave the failing terraces for Hearth. He brings the Drying Circle’s tools. The hall stays behind, with the height marks on its lintel.', entities: ['c-ivo', 's-hollow', 's-hearth', 'k-hollow-hall', 'i-hollow'], causes: [survey.id], observed: ['Old Hollow’s habitat is 24/100, below viable organic settlement conditions.', 'Old Hollow population: 6 → 0.', `Hearth population: ${population} → ${hearth.population}.`, 'Ivo is now at Hearth; the drying hall is abandoned.'] });
  const hollowInstitution = w.institutions.find(i => i.id === 'i-hollow');
  hollowInstitution.status = 'collapsed'; hollowInstitution.history.push(departing.id);
  const fault = addEvent(w, { kind: 'archive-fault', category: 'infrastructural', severity: 2, title: 'Water in the seed room', text: 'A cracked cooling seam leaves the seed archive damp. Nera asks Senn to count what can be saved. Oren’s last letter describes a repair pattern in Lattice, beyond the closed saddle.', entities: ['s-hearth', 'c-nera', 'c-senn', 'c-oren', 'k-hearth-archive', 'r-hearth-lattice'], causes: [survey.id], observed: ['Seed integrity is 43/100.', 'The archive seam is damaged.', 'The Silt Saddle is closed.', 'A letter containing the existence, but not the method, of Oren’s repair is in the archive.'] });
  structure(w, 'k-hearth-archive').damaged = true;
  w.threads = [
    { id: 't-seeds', title: 'What is worth carrying?', summary: 'Nera must find a place for the endangered seed vessels. The Silt Saddle could make Oren’s repair available.', entityIds: ['c-nera', 'c-senn', 'c-oren', 's-hearth', 'k-hearth-archive'], status: 'open', eventId: fault.id },
    { id: 't-hollow', title: 'The hall that stayed behind', summary: 'Visit Old Hollow’s height-marked lintel. An exposed ceramic chamber may hold useful knowledge.', entityIds: ['s-hollow', 'c-ivo', 'k-hollow-hall', 'k-hollow-relic'], status: 'open', eventId: departing.id },
    { id: 't-east', title: 'A letter beyond the silt', summary: 'The eastern stone sill could support a route. Oren has repair patterns; Hearth has people who need them.', entityIds: ['r-hearth-lattice', 'c-oren', 's-lattice', 's-hearth'], status: 'open', eventId: fault.id },
  ];
  setActivities(w);
  return w;
}

export function getEntity(w, id) {
  if (typeof id !== 'string') return null;
  return [...w.regions, ...w.settlements, ...w.characters, ...w.routes, ...w.cultures, ...w.institutions, ...w.settlements.flatMap(s => s.structures), ...w.events, ...w.threads, ...(w.power ? [w.power] : [])].find(e => e.id === id) || null;
}

export function entityLabel(w, id) {
  const e = getEntity(w, id);
  return e?.name || e?.title || (id ? 'Unrecorded entity' : 'The basin');
}

export function getInterventions(w) {
  const east = route(w, 'r-hearth-lattice');
  const hearth = settlement(w, 's-hearth');
  const hollow = settlement(w, 's-hollow');
  const choices = [
    { id: 'open-east', kind: 'open-route', targetId: east.id, title: 'Expose the Silt Saddle', description: 'Make the eastern stone sill usable. People can then exchange supplies and repair patterns.', available: !east.open && east.passable, reason: east.open ? 'The passage is already usable.' : east.passable ? 'A stable stone sill lies beneath loose silt.' : 'The terrain cannot support a passage.' },
    { id: 'reveal-memory', kind: 'reveal-relic', targetId: 'k-hollow-relic', title: 'Reveal the rain memory', description: 'Expose the surviving ceramic chamber at Old Hollow so someone can inspect it.', available: !w.flags.relicRevealed && hollow.population === 0, reason: w.flags.relicRevealed ? 'The chamber has already been exposed.' : 'The recorded abandoned bank contains a surviving chamber.' },
    { id: 'restore-reed', kind: 'restore-habitat', targetId: hearth.id, title: 'Reconnect the buried spring', description: 'Let groundwater return to Hearth’s dry channels. The habitat improves; inhabitants decide how to use it.', available: !w.flags.habitatRestored && hearth.habitat < 85, reason: w.flags.habitatRestored ? 'The spring is already connected.' : hearth.habitat >= 85 ? 'These channels already hold as much water as they can use.' : 'The survey records a buried spring and intact downstream channels.' },
  ];
  return choices;
}

export function intervene(world, command) {
  if (!command || typeof command !== 'object' || typeof command.kind !== 'string' || typeof command.targetId !== 'string') throw new Error('An intervention needs a kind and targetId.');
  const available = getInterventions(world).find(i => i.kind === command.kind && i.targetId === command.targetId);
  if (!available || !available.available) throw new Error(available?.reason || 'That intervention is not possible at this place.');
  const w = clone(world);
  const target = getEntity(w, command.targetId);
  if (command.kind === 'open-route') {
    target.open = true;
    const e = addEvent(w, { kind: 'passage-opened', category: 'infrastructural', severity: 2, title: 'A usable line through the silt', text: 'The stone sill is exposed. The Silt Saddle now connects Hearth and Lattice; using it remains a choice for the people at either end.', entities: [target.id, target.from, target.to, 'c-nera', 'c-oren'], causes: [target.history[0]], observed: ['The Silt Saddle changed from closed to open.', 'Trade and travel alternatives between Hearth and Lattice are now available.'] });
    target.history.push(e.id);
  } else if (command.kind === 'reveal-relic') {
    w.flags.relicRevealed = true; target.exposed = true;
    addEvent(w, { kind: 'relic-exposed', category: 'infrastructural', severity: 2, title: 'The rain memory uncovered', text: 'Silt falls away from the patterned chamber. The surviving ceramic leaves are accessible from the Leaving Steps; nobody has read them yet.', settlementId: 's-hollow', entities: ['k-hollow-relic', 's-hollow', 'c-tavi', 'c-ivo'], causes: [lastEvent(w, 'hollow-departure').id], observed: ['The chamber is exposed and reachable.', 'No knowledge has yet been learned from it.'] });
  } else if (command.kind === 'restore-habitat') {
    const before = target.habitat; target.habitat = clamp(target.habitat + 24); w.flags.habitatRestored = true;
    addEvent(w, { kind: 'spring-restored', category: 'infrastructural', severity: 2, title: 'Water finds the old channels', text: 'Groundwater reaches Hearth’s existing garden channels. Senn puts a palm in the flow and leaves it there longer than necessary.', entities: ['s-hearth', 'c-senn', 'k-hearth-garden'], causes: ['e-00001'], observed: [`Hearth habitat: ${before} → ${target.habitat}.`, 'The garden’s existing channels now receive spring water.'] });
  }
  return w;
}

export function advance(world, days = 1) {
  if (!Number.isInteger(days) || days < 0 || days > MAX_TICK || world.tick + days > MAX_TICK) throw new Error('Advance by a whole number of days within the 6000-day archive. Export this history before beginning another world.');
  const w = clone(world);
  for (let i = 0; i < days; i++) {
    w.tick++;
    updateResources(w);
    contact(w);
    if (w.tick >= 4 && !w.flags.archiveResolved) resolveSeeds(w);
    discover(w);
    recover(w);
    grow(w);
    scenes(w);
    setActivities(w);
  }
  return w;
}


function updateResources(w) {
  for (const s of w.settlements) {
    if (!s.population) continue;
    const gardenBonus = s.id === 's-hearth' ? w.flags.gardenEfficiency : 0;
    const yieldRate = s.habitat * 0.025 + 0.35 + gardenBonus;
    s.food = clamp(s.food + yieldRate - s.population * 0.026);
    s.materials = clamp(s.materials + 0.36 + s.knowledge * 0.003);
    s.energy = clamp(s.energy + (s.regionId === 'reg-glass' ? 0.18 : 0.05));
  }
  if (w.flags.archiveThreat) w.flags.seedIntegrity = clamp(w.flags.seedIntegrity - 1.5);
  const east = route(w, 'r-hearth-lattice');
  if (east.open) {
    const h = settlement(w, east.from), l = settlement(w, east.to);
    if (h.food < 62 && l.food > 44) { const n = Math.min(0.8, l.food - 44); l.food = clamp(l.food - n); h.food = clamp(h.food + n); }
  }
}

function contact(w) {
  const east = route(w, 'r-hearth-lattice');
  if (!east.open || w.flags.easternContact) return;
  const h = settlement(w, 's-hearth'), l = settlement(w, 's-lattice');
  const nera = character(w, 'c-nera'), oren = character(w, 'c-oren');
  const before = { hFood: h.food, lFood: l.food, knowledge: h.knowledge };
  l.food = clamp(l.food - 7); h.food = clamp(h.food + 7); h.knowledge += 5;
  relationship(nera, oren, 9, 'correspondent who brought food'); relationship(oren, nera, 9, 'trusted receiver');
  w.flags.easternContact = true; w.flags.contacts++; w.flags.exchanges++;
  const e = addEvent(w, { kind: 'eastern-contact', family: 'contact', category: 'cultural', severity: 2, title: 'A pattern with a meal attached', text: 'Oren sends food and a ceramic repair leaf across the saddle. “The instructions are on the dry side,” his note says. Nera reads both sides anyway.', entities: ['s-hearth', 's-lattice', 'c-nera', 'c-oren', east.id], causes: [east.history.at(-1)], observed: [`Hearth food: ${before.hFood} → ${h.food}.`, `Lattice food: ${before.lFood} → ${l.food}.`, `Hearth repair knowledge: ${before.knowledge} → ${h.knowledge}.`, 'Nera now has Oren’s repair method and knows the passage is usable.'], decision: decision(oren, ['The eastern passage is usable.', `Lattice has ${before.lFood} food before the gift.`, 'Nera’s letter describes a damaged seed archive.'], [{ id: 'share', label: 'Send a repair leaf and food', available: true, reason: 'The route is open and Lattice has a surplus.' }, { id: 'keep', label: 'Keep the surplus at Lattice', available: true, reason: 'No rule requires a gift.' }], 'share', ['Care 80: answer a named need.', 'Curiosity 85: see whether a repair works elsewhere.']) });
  resolveThread(w, 't-east', e, 'The passage now carries food and repair knowledge. Watch what the new dependence changes.');
}

function resolveSeeds(w) {
  const h = settlement(w, 's-hearth'), l = settlement(w, 's-lattice');
  const nera = character(w, 'c-nera'), oren = character(w, 'c-oren');
  const alternatives = [
    { id: 'exchange', label: 'Ask Oren to rebuild the cooling seam', available: route(w, 'r-hearth-lattice').open && !!w.flags.easternContact && l.materials >= 12, reason: route(w, 'r-hearth-lattice').open ? 'The passage carries Oren’s method and Lattice has repair materials.' : 'The Silt Saddle is closed; Nera cannot bring Oren or his materials here.' },
    { id: 'raise', label: 'Raise the seed vessels into a dry loft', available: h.materials >= 18, reason: h.materials >= 18 ? 'Hearth can spend 18 materials on supports.' : 'The supports require 18 materials.' },
    { id: 'plant', label: 'Give the threatened seeds a living nursery', available: h.habitat >= 40 && h.food >= 18, reason: h.habitat >= 40 && h.food >= 18 ? 'The garden can support planting; food can be reserved for the work.' : 'The habitat or food reserve cannot support a nursery.' },
  ];
  const scores = {
    exchange: nera.motives.care * 0.85 + nera.motives.curiosity * 0.6 + nera.motives.duty * 0.45 + 30,
    raise: nera.motives.duty * 1.1 + nera.motives.care * 0.6,
    plant: nera.motives.curiosity * 0.9 + nera.motives.care * 0.72 + (w.flags.habitatRestored ? 12 : 0),
  };
  const chosen = alternatives.filter(a => a.available).sort((a, b) => scores[b.id] - scores[a.id] || a.id.localeCompare(b.id))[0]?.id;
  if (!chosen) return; // A valid decision requires a genuinely available action.
  const before = { materials: h.materials, food: h.food, integrity: w.flags.seedIntegrity, knowledge: h.knowledge };
  const context = decision(nera, [`Seed integrity is ${before.integrity}/100 and still falling.`, `Hearth has ${before.materials} materials and ${before.food} food.`, `The garden habitat is ${h.habitat}/100.`, w.flags.easternContact ? 'Oren’s repair leaf has arrived across the usable saddle.' : 'Oren’s old letter names a method, but the closed saddle prevents exchange.'], alternatives, chosen, [`Care ${nera.motives.care}: keep the seeds useful to living people.`, `Duty ${nera.motives.duty}: preserve the store entrusted to her.`, `Curiosity ${nera.motives.curiosity}: consider an unfamiliar way to save it.`]);
  let title, text;
  const observed = [];
  const entities = ['c-nera', 'c-senn', 's-hearth', 'k-hearth-archive', 'i-ledger'];
  if (chosen === 'exchange') {
    h.materials = clamp(h.materials - 10); l.materials = clamp(l.materials - 12); h.knowledge += 13;
    h.population++; l.population--; oren.settlementId = h.id; oren.homeId = 'k-hearth-table';
    w.flags.seedIntegrity = 94; structure(w, 'k-hearth-archive').damaged = false;
    relationship(nera, oren, 14, 'trusted collaborator'); relationship(oren, nera, 14, 'trusted collaborator');
    title = 'Nera makes room for a stranger';
    text = 'Nera accepts Oren’s method. He comes to Hearth with the missing ceramic. At the Warm Table she moves her own bowl to make room. “I was told the welcome was warmer,” he says. “That is the bowl,” she says.';
    entities.push('c-oren', 's-lattice', 'r-hearth-lattice');
    observed.push('Oren moved from Lattice to Hearth; their organic populations changed by −1 and +1.', 'Lattice supplied 12 materials; Hearth spent 10.', 'The cooling seam is repaired.', `Hearth knowledge: ${before.knowledge} → ${h.knowledge}.`);
    w.flags.exchanges++;
  } else if (chosen === 'raise') {
    h.materials = clamp(h.materials - 18); w.flags.seedIntegrity = 77; structure(w, 'k-hearth-archive').damaged = false;
    title = 'The vessels above the water';
    text = 'Nera spends the spare timber on a dry loft. Senn helps, then leaves one seed vessel on the garden step. “A store is not a future,” Senn says. “It is one way to reach one,” Nera answers.';
    observed.push('Hearth spent 18 materials on a dry archive loft.', 'The endangered vessels are above the damaged seam; the archive is usable again.');
    relationship(nera, character(w, 'c-senn'), -3, 'old friend; disagreement over stored seeds');
  } else {
    h.food = clamp(h.food - 12); h.habitat = clamp(h.habitat + 7); w.flags.seedIntegrity = 86; w.flags.gardenEfficiency += 0.3;
    const archive = structure(w, 'k-hearth-archive'); archive.kind = 'ruin'; archive.abandonedAt = w.tick;
    title = 'The archive takes root';
    text = 'Nera gives Senn the threatened vessels for planting. They close the damp archive. Tavi saves its door label and fastens it beside the new beds. “Same collection,” Senn says. “Less shelving.”';
    observed.push('Hearth spent 12 food supporting the planting.', 'Garden habitat increased by 7; the nursery now adds food production.', 'The old seed room was abandoned and survives as a ruin.');
    relationship(nera, character(w, 'c-senn'), 11, 'co-keepers of the living archive');
  }
  w.flags.archiveThreat = false; w.flags.archiveResolved = chosen;
  observed.push(`Seed integrity: ${before.integrity} → ${w.flags.seedIntegrity}.`);
  const e = addEvent(w, { kind: 'seed-decision', family: 'obligations', category: 'personal', severity: 3, title, text, entities, observed, causes: [lastEvent(w, 'archive-fault').id, lastEvent(w, 'eastern-contact')?.id, lastEvent(w, 'spring-restored')?.id], decision: context });
  if (chosen === 'exchange') {
    addStructure(w, h, { id: 'k-hearth-pattern', name: 'Oren’s Open Workshop', kind: 'workshop', x: 120, y: 42, description: 'A shared repair bench built when Oren moved here. The first leaf records the seed-room repair.' }, e);
    addStructure(w, h, { id: 'k-hearth-bridge', name: 'The Welcome Landing', kind: 'bridge', x: 132, y: -70, description: 'A landing built by the carriers after the passage brought Oren to Hearth.' }, e);
  } else if (chosen === 'raise') {
    addStructure(w, h, { id: 'k-hearth-loft', name: 'The Dry Loft', kind: 'archive', x: 118, y: 23, description: 'Nera’s solution to the damaged archive, built from 18 materials.' }, e);
  } else {
    addStructure(w, h, { id: 'k-hearth-nursery', name: 'The Living Archive', kind: 'garden', x: -105, y: 93, description: 'The endangered seeds were planted here instead of returned to storage.' }, e);
  }
  resolveThread(w, 't-seeds', e);
  openThread(w, { id: 't-recovery', title: 'What the saved seeds can become', summary: 'Senn wants the rescued collection to feed the next arrivals. Recovery depends on knowledge, room, and usable supplies.', entityIds: ['c-senn', 'c-nera', 's-hearth', 'k-hearth-garden'] }, e);
}

function discover(w) {
  if (!w.flags.relicRevealed || w.flags.relicStudied) return;
  const tavi = character(w, 'c-tavi'), ivo = character(w, 'c-ivo');
  const h = settlement(w, 's-hearth');
  if (!tavi.alive || !ivo.alive || !route(w, 'r-hollow-hearth').open) return;
  const known = ['The exposed chamber is reachable by the Leaving Steps.', 'Ivo knows the old drying hall and has offered to accompany the visit.', `Hearth’s repair knowledge is ${h.knowledge}.`];
  tavi.settlementId = 's-hollow'; ivo.settlementId = 's-hollow';
  w.flags.discoveryReturnAt = w.tick + 1; w.flags.relicStudied = true;
  w.flags.pendingKnowledge = 16;
  const e = addEvent(w, { kind: 'rain-memory-read', family: 'discovery', category: 'cultural', severity: 2, title: 'The marks are also instructions', text: 'Tavi and Ivo reach the chamber. Some ceramic marks describe a working capillary channel; what else they meant remains unknown. Ivo traces one with his thumb. “My mother cut these into bowls.” Tavi leaves a blank line under that.', settlementId: 's-hollow', entities: ['c-tavi', 'c-ivo', 's-hollow', 'k-hollow-relic'], causes: [lastEvent(w, 'relic-exposed').id, lastEvent(w, 'hollow-departure').id], observed: ['Tavi and Ivo are visiting Old Hollow.', 'They carry a copied channel pattern; it has not reached Hearth yet.', 'The chamber remains in place.'], decision: decision(tavi, known, [{ id: 'visit', label: 'Read the chamber with Ivo', available: true, reason: 'The chamber is exposed and Ivo can guide the visit.' }, { id: 'wait', label: 'Leave it undisturbed', available: true, reason: 'The chamber is stable.' }], 'visit', ['Curiosity 91: turn a promising trace into usable knowledge.', 'Care 68: ask the person who knows this place.']) });
  resolveThread(w, 't-hollow', e, 'The chamber’s channel pattern is copied; its meaning to earlier inhabitants remains uncertain.');
}

function recover(w) {
  if (w.flags.discoveryReturnAt && w.tick >= w.flags.discoveryReturnAt) {
    character(w, 'c-tavi').settlementId = 's-hearth'; character(w, 'c-ivo').settlementId = 's-hearth';
    const h = settlement(w, 's-hearth'), before = h.knowledge;
    h.knowledge += w.flags.pendingKnowledge || 0;
    addEvent(w, { kind: 'readers-returned', family: 'recovery', title: 'The old place comes home on paper', text: 'Tavi and Ivo return to Hearth with the copied channel marks. Ivo puts his copy beside the mending tools.', entities: ['c-tavi', 'c-ivo', 's-hearth', 's-hollow'], causes: [lastEvent(w, 'rain-memory-read').id], observed: ['Tavi and Ivo are back at Hearth.', `The copied pattern reached Hearth; knowledge: ${before} → ${h.knowledge}.`, 'The copied pattern is retained in their memories.'] });
    w.flags.discoveryReturnAt = null;
    w.flags.pendingKnowledge = 0;
  }
  if (!w.flags.archiveResolved || w.flags.recovery) return;
  const h = settlement(w, 's-hearth');
  if (h.food < 45 || h.materials < 20 || h.habitat < 40) return;
  const senn = character(w, 'c-senn');
  const shared = h.knowledge >= 25;
  // A scene cannot borrow an absent participant or information still in transit.
  const nera = character(w, 'c-nera'), ivo = character(w, 'c-ivo');
  if (!senn.alive || senn.settlementId !== h.id || !nera.alive || nera.settlementId !== h.id || (shared && (!ivo.alive || ivo.settlementId !== h.id))) return;
  const before = { food: h.food, materials: h.materials };
  const outcome = shared ? 'channels' : 'beds';
  h.materials = clamp(h.materials - 16); h.food = clamp(h.food + (shared ? 14 : 8)); w.flags.gardenEfficiency += shared ? 0.8 : 0.4; w.flags.recovery = true;
  const living = w.flags.archiveResolved === 'plant';
  const recoveryText = living
    ? shared ? 'Senn and Ivo lay copied channels around the living nursery. Nera helps move the established seedlings into the new beds. The archive keeps growing out of its labels.' : 'Senn makes ordinary raised beds from spare material. Nera helps transplant seedlings from the living nursery. Tavi makes the label large enough to survive another expansion.'
    : shared ? 'Senn and Ivo lay copied channels beneath the garden. The first bed drains cleanly. Senn takes a seed vessel from storage and empties it into a palm. “Now,” is all that gets said.' : 'Senn makes ordinary raised beds from spare material. Nera carries out the first saved vessel herself. They plant without settling their argument.';
  const e = addEvent(w, { kind: 'seed-recovery', family: 'recovery', category: 'infrastructural', severity: 2, title: shared ? 'Water that remembers the way' : 'Room for the saved seeds', text: recoveryText, entities: ['s-hearth', 'c-senn', 'c-ivo', 'c-nera', 'k-hearth-garden'], causes: [lastEvent(w, 'seed-decision').id, lastEvent(w, 'readers-returned')?.id, lastEvent(w, 'eastern-contact')?.id], observed: [`Hearth materials: ${before.materials} → ${h.materials}.`, `Hearth food: ${before.food} → ${h.food}.`, `Permanent garden production increased by ${shared ? 0.8 : 0.4} per day.`], decision: decision(senn, [`Hearth has ${before.food} food and ${before.materials} materials.`, `Usable garden knowledge is ${h.knowledge}.`, 'Nera has resolved the threatened seed collection.'], [{ id: 'channels', label: 'Build copied capillary channels', available: shared, reason: shared ? 'The community has enough transmitted knowledge.' : 'Nobody here yet knows the required pattern.' }, { id: 'beds', label: 'Build familiar raised beds', available: true, reason: 'Local skills and materials suffice.' }, { id: 'keep', label: living ? 'Leave the nursery as it is' : 'Leave the seeds stored', available: true, reason: 'The immediate threat has passed.' }], outcome, ['Care 87: use preserved seeds to feed people.', 'Curiosity 63: adopt an understood method when available.']) });
  addStructure(w, h, { id: 'k-hearth-recovery', name: shared ? 'The Borrowed Channels' : 'The Second Garden', kind: 'garden', x: -112, y: -50, description: shared ? 'This garden uses knowledge carried from another community.' : w.flags.archiveResolved === 'plant' ? 'This garden extends the living nursery Nera and Senn planted.' : 'This garden began with seeds Nera saved in the dry loft.' }, e);
  resolveThread(w, 't-recovery', e);
}

function grow(w) {
  const h = settlement(w, 's-hearth');
  if (!w.flags.archiveResolved || h.food < 65 || h.materials < 32 || h.habitat < 45 || w.flags.growthCount >= 5) return;
  const before = { population: h.population, food: h.food, materials: h.materials };
  h.population += 3; h.food = clamp(h.food - 9); h.materials = clamp(h.materials - 22); h.housingCapacity += 4; w.flags.growthCount++;
  const number = w.flags.growthCount;
  const e = addEvent(w, { kind: 'settlement-growth', category: 'infrastructural', severity: 2, title: 'A house that faces the garden', text: 'Hearth’s households make room for three new children and build beside the food channels. Daro gives the new doorway a reed mat; one corner stubbornly refuses to lie flat.', entities: ['s-hearth', 'c-daro', 'i-ledger'], causes: [lastEvent(w, 'seed-recovery')?.id || lastEvent(w, 'seed-decision').id], observed: [`Hearth population: ${before.population} → ${h.population} (three births in aggregated households).`, `Materials: ${before.materials} → ${h.materials}; food: ${before.food} → ${h.food}.`, 'Four places of housing were built.'] });
  addStructure(w, h, { id: `k-hearth-home-${number}`, name: ['The Uneven Mat', 'House of Two Kettles', 'The South Windows', 'The Open Cupboard', 'Last House Before Rain'][number - 1], kind: 'home', x: -150 + number * 52, y: 145, description: `Built for growing households on day ${w.tick}. Its doorway faces the gardens that made it viable.` }, e);
  if (number === 1) changeInstitution(w, e);
}

function changeInstitution(w, cause) {
  const inst = w.institutions.find(i => i.id === 'i-ledger');
  const before = inst.name;
  inst.status = 'changed'; inst.name = 'The Open Ledger'; inst.members.push('c-daro'); inst.practice = 'Stores remain recorded, but newcomers can witness obligations and share seed decisions.';
  const e = addEvent(w, { kind: 'ledger-changed', family: 'institution', category: 'cultural', severity: 2, title: 'One more place at the ledger', text: 'The growing households ask who may witness a seed debt. Nera brings Daro to the table. The Ember Ledger becomes the Open Ledger; its old pages remain bound at the front.', entities: ['i-ledger', 'c-nera', 'c-daro', 's-hearth', 'culture-table'], causes: [cause.id, lastEvent(w, 'seed-decision').id], observed: [`${before} changed its name and practice; the same institution identity survives.`, 'Daro joined the witnesses.', 'Hearth’s population and existing structures are preserved.'] });
  inst.history.push(e.id);
}

function scenes(w) {
  const ivo = character(w, 'c-ivo'), ves = character(w, 'c-ves');
  if (!w.flags.firstLesson && w.tick >= 2 && ivo.settlementId === ves.settlementId && ivo.alive && ves.alive) {
    const before = ves.relationships.find(r => r.otherId === ivo.id)?.strength || 0;
    relationship(ivo, ves, 8, 'patient teacher'); relationship(ves, ivo, 8, 'trusted teacher');
    w.flags.firstLesson = true;
    addEvent(w, { kind: 'mending-lesson', family: 'relationships', title: 'The nail that was apparently valuable', text: 'Ves asks why Ivo keeps a nail bent in three places. “Four,” Ivo says, and shows the hidden bend. He lets Ves straighten the easy one. Neither calls this a lesson.', entities: ['c-ivo', 'c-ves', 'k-hearth-yard'], causes: [lastEvent(w, 'hollow-departure').id], observed: [`Ves’s trust in Ivo: ${before} → ${ves.relationships.find(r => r.otherId === ivo.id).strength}.`, 'They share a remembered mending lesson at Hearth.'] });
  }
  const tavi = character(w, 'c-tavi'), daro = character(w, 'c-daro');
  if (w.flags.archiveResolved && !w.flags.supper && tavi.settlementId === daro.settlementId) {
    w.flags.supper = true; relationship(tavi, daro, 7, 'shares supper and unfinished sentences'); relationship(daro, tavi, 7, 'shares supper and unfinished sentences');
    addEvent(w, { kind: 'late-supper', family: 'relationships', title: 'A heading for ordinary things', text: 'Daro leaves supper beside Tavi’s notes. “You should record that the soup is cold.” Tavi writes: A PERSON WAITED. Daro crosses it out and writes: TWO PERSONS ATE.', entities: ['c-tavi', 'c-daro', 'k-hearth-table'], causes: [lastEvent(w, 'seed-decision').id], observed: ['Tavi and Daro shared supper at Hearth.', 'Their mutual relationship strength increased by 7.', 'Both retain this event as a memory.'] });
  }
  if (w.flags.recovery && !w.flags.downstreamContact) {
    w.flags.downstreamContact = true; w.flags.contacts++;
    const h = settlement(w, 's-hearth'), choir = settlement(w, 's-choir');
    h.knowledge += 4; choir.knowledge += 4;
    addEvent(w, { kind: 'downstream-contact', family: 'contact', category: 'cultural', severity: 2, title: 'Mira checks the other end', text: 'Mira sends Senn a channel sketch along the Rain Path. It includes Hearth’s successful beds and a note: LEAVE SOME WATER FOR EVERYONE ELSE. Senn writes back: AN EXCELLENT PLACE TO START.', entities: ['s-hearth', 's-choir', 'c-senn', 'c-mira', 'r-hearth-choir'], causes: [lastEvent(w, 'seed-recovery').id], observed: ['Hearth and Choir each gained 4 transmitted knowledge.', 'The existing Rain Path carried a recorded exchange.'] });
  }
}

function setActivities(w) {
  const roleKind = { storekeeper: 'archive', gardener: 'garden', mender: 'workshop', archivist: 'archive', braider: 'home', apprentice: 'workshop', 'pattern carrier': 'workshop', 'channel keeper': 'garden' };
  for (const c of w.characters) {
    if (!c.alive) continue;
    const s = settlement(w, c.settlementId);
    const step = (w.tick + w.characters.indexOf(c)) % 6;
    let place = step === 0 ? s.structures.find(b => b.kind === 'home') : s.structures.find(b => b.kind === roleKind[c.role] && b.abandonedAt == null);
    if (!place) place = s.structures.find(b => b.kind !== 'ruin') || s.structures[0];
    c.x = place.x + Math.round(Math.sin((w.tick + w.characters.indexOf(c)) * 1.7) * 15);
    c.y = place.y + 18 + Math.round(Math.cos((w.tick + w.characters.indexOf(c)) * 1.2) * 9);
    c.activityTargetId = place.id;
    c.activity = step === 0 ? `Sharing a meal at ${place.name}` : `Working at ${place.name}`;
  }
}
