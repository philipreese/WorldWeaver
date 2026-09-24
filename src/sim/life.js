/** Tier 2: three forms share material flows, while keeping distinct needs and space. */
export function initializeLife(w, api) {
  const { settlement, addEvent, addStructure, openThread, random, clamp } = api;
  const l = settlement(w, 's-lattice'), c = settlement(w, 's-choir');
  const inheritedCondition = Math.floor(random(w) * 9) - 4;
  l.energy = clamp(l.energy + inheritedCondition);
  c.habitat = clamp(c.habitat + inheritedCondition);
  for (const person of w.characters) person.residenceId = person.settlementId;
  // The elder's existing lifetime makes succession discoverable within one archive.
  w.characters.find(person => person.id === 'c-ivo').bornAt = -83 * 365;
  l.synthetics = 12; l.syntheticIntegrity = 88; l.syntheticCapacity = 26;
  c.collective = 18; c.collectiveHydration = c.habitat; c.collectiveCapacity = 39;
  Object.assign(w.flags, { syntheticReplications: 0, collectiveExpansions: 0, sharedNetwork: false, networkCharge: 0, networkTransfers: 0, powerActs: 0, formsContact: false, cultureDiverged: false, mixedSettlement: false, familyContinuity: false });
  w.cultures.push(
    { id: 'culture-measure', entityType: 'culture', form: 'synthetic', name: 'The Measured Continuance', settlementIds: ['s-lattice'], practice: 'Keep a repair pattern public and copy only what the available energy can sustain.', interpretation: 'A repeating signal may carry memory without having a speaker.' },
    { id: 'culture-rain', entityType: 'culture', form: 'collective', name: 'The Many Rooms', settlementIds: ['s-choir'], practice: 'Maintain a wet connection before extending a new root room.', interpretation: 'A boundary may be a change in sensation rather than an edge of the body.' },
  );
  const event = addEvent(w, { kind: 'three-forms-recorded', category: 'civilizational', severity: 2, title: 'A census with three kinds of answer', text: 'The survey records twelve awakened synthetic bodies at Lattice and eighteen living root nodes at Choir. Oren counts bodies. Mira counts connected rooms. Their totals describe different kinds of lives.', entities: ['s-lattice', 's-choir', ...w.characters.map(person => person.id), 'culture-measure', 'culture-rain'], settlementId: 's-lattice', causes: ['e-00001'], observed: ['Lattice has 12 synthetic bodies, separate from its 14 organic residents.', 'Choir has 18 collective nodes, separate from its 16 organic residents.', `The seeded inherited condition gives Lattice ${l.energy} energy and Choir ${c.habitat} habitat.`, 'Synthetics depend on solar energy and repair material, not food.', 'Collective nodes depend on wet connected habitat and nutrients; new nodes occupy new ground.'] });
  addStructure(w, l, { id: 'k-lattice-cradle', name: 'The Copying Cradle', kind: 'spire', x: -12, y: 85, form: 'synthetic', description: 'Energy and ceramic materials are assembled into new synthetic bodies here.' }, event);
  addStructure(w, l, { id: 'k-lattice-bus', name: 'The Blue Bus', kind: 'conduit', x: -88, y: -18, form: 'synthetic', description: 'Visible energy paths connect bodies to the collector. A wet climate corrodes unprotected shells.' }, event);
  addStructure(w, c, { id: 'k-choir-nest', name: 'The Eighteen Rooms', kind: 'nest', x: -68, y: -8, form: 'collective', description: 'Eighteen living nodes occupy these root rooms. Their connections need water.' }, event);
  openThread(w, { id: 't-forms', title: 'Who is the water for?', summary: 'Lattice can spare energy but needs stable cooling. Choir can share wet channels but needs repair knowledge. Hearth’s recovered garden could connect them.', entityIds: ['s-hearth', 's-lattice', 's-choir', 'culture-measure', 'culture-rain'] }, event);
}

export function offerRefuge(w, api) {
  const { settlement, addEvent, lastEvent, clamp } = api;
  const h = settlement(w, 's-hearth');
  const before = h.habitat;
  h.habitat = clamp(h.habitat + 8); w.flags.refugeOffered = true;
  addEvent(w, { kind: 'refuge-possible', category: 'infrastructural', severity: 2, title: 'A bank with room for other lives', text: 'A sheltered spring reaches the river terrace. The connected bank can support root rooms and cooled synthetic shelters. Nobody has moved there yet.', entities: ['s-hearth', 'i-confluence', 'k-hearth-conduit'], causes: [lastEvent(w, 'common-channel-founded').id], observed: [`Hearth habitat: ${before} → ${h.habitat}.`, 'The river terrace is now an available refuge; residents still choose whether to move.'] });
}

export function evolveLife(w, api) {
  updateForms(w, api);
  openIndependentRoute(w, api);
  negotiateChannel(w, api);
  shareFlows(w, api);
  divergeCulture(w, api);
  emergePower(w, api);
  actPower(w, api);
  changeSharedInstitution(w, api);
  settleRefuge(w, api);
  organicMigration(w, api);
  sharedHome(w, api);
  continuity(w, api);
}

function sharedHome(w, api) {
  if (w.flags.sharedHome || !w.flags.supper) return;
  const { settlement, character, addEvent, lastEvent, relationship, decision } = api;
  const h = settlement(w, 's-hearth');
  const home = h.structures.find(b => b.id === 'k-hearth-home-1');
  const tavi = character(w, 'c-tavi'), daro = character(w, 'c-daro');
  if (!home || !tavi.alive || !daro.alive || tavi.settlementId !== h.id || daro.settlementId !== h.id) return;
  const trust = tavi.relationships.find(r => r.otherId === daro.id)?.strength || 0;
  if (trust < 76) return;
  const context = decision(tavi, [`Daro’s remembered trust is ${trust}/100.`, 'The first new house has a dry shelf and space for shared meals.', 'Their late supper is a real shared memory.'], [{ id: 'share', label: 'Share the new house with Daro', available: true, reason: 'A built house has room and both people trust the arrangement.' }, { id: 'stay', label: 'Keep separate places at the Warm Table', available: true, reason: 'Their current home remains available.' }], 'share', [`Care ${tavi.motives.care}: make room for a trusted person’s everyday company.`, `Duty ${tavi.motives.duty}: keep the records dry without eating alone.`]);
  tavi.homeId = home.id; daro.homeId = home.id; w.flags.sharedHome = true;
  relationship(tavi, daro, 10, 'shares a home and unfinished sentences'); relationship(daro, tavi, 10, 'shares a home and unfinished sentences');
  addEvent(w, { kind: 'shared-home', family: 'relationships', category: 'personal', severity: 2, title: 'A shelf for two kinds of mess', text: 'Tavi and Daro take rooms in the new house. Daro asks which shelf is for the records. “The dry one,” Tavi says. Daro looks at the roof, then moves both supper bowls beside it.', entities: ['c-tavi', 'c-daro', home.id, h.id], causes: [home.eventId, lastEvent(w, 'late-supper').id], observed: [`Tavi and Daro now share ${home.name} as their home.`, 'Their mutual trust increased by 10.', 'No new building or population was invented by this choice.'], decision: context });
}

function updateForms(w, api) {
  const { settlement, addEvent, addStructure, clamp, lastEvent } = api;
  for (const s of w.settlements) {
    if (s.population > 0) s.energy = clamp(s.energy - s.population * 0.006);
    if (s.synthetics > 0) {
      const solar = s.regionId === 'reg-glass' ? (w.config.climate === 'wet' ? 1.6 : 2.3) : 0.5;
      s.energy = clamp(s.energy + solar - s.synthetics * 0.08);
      // Ceramic reclamation supports stable bodies; copying still costs a real reserve.
      s.materials = clamp(s.materials + 0.85 - s.synthetics * 0.035 + (w.flags.repairStandardized && s.id === 's-lattice' ? 0.22 : 0));
      s.syntheticIntegrity ??= 88;
      const weatherWear = w.config.climate === 'wet' ? 0.1 : 0.025;
      s.syntheticIntegrity = clamp(s.syntheticIntegrity - weatherWear - (s.energy < 20 ? 0.9 : 0) + (s.materials >= 18 && s.energy >= 28 ? 0.1 : 0));
      if (s.syntheticIntegrity < 35 && s.synthetics > 1) {
        s.synthetics--; s.syntheticIntegrity = clamp(s.syntheticIntegrity + 14);
        const e = addEvent(w, { kind: 'synthetic-dormancy', category: 'civilizational', severity: 2, title: 'One body rests on the bus', text: `${s.name} puts one damaged synthetic body into dormancy. Its ceramic shell remains connected so its stored pattern can be recovered if repair becomes possible.`, settlementId: s.id, entities: [s.id, 'culture-measure'], causes: [lastEvent(w, 'synthetic-replication')?.id || lastEvent(w, 'three-forms-recorded').id], observed: [`Active synthetic bodies decreased to ${s.synthetics}.`, 'The dormant shell persists as a physical trace.', 'Low energy or weather wear reduced shell integrity below 35.'] });
        addStructure(w, s, { id: `k-${s.id}-shell-${e.id}`, name: 'A Resting Shell', kind: 'ruin', form: 'synthetic', x: 105, y: -45 + w.events.length % 35, abandonedAt: w.tick, description: 'A synthetic body went dormant here; its recorded pattern survives.' }, e);
      }
    }
    if (s.collective > 0) {
      const moisture = w.config.climate === 'dry' ? -0.12 : w.config.climate === 'wet' ? 0.06 : 0.005;
      s.habitat = clamp(s.habitat + moisture + (w.flags.sharedNetwork ? 0.1 : 0));
      s.collectiveHydration = s.habitat;
      // A wet colony ferments plant litter; it occupies habitat, not sleeping places.
      s.food = clamp(s.food + s.collective * 0.018 - (s.habitat < 50 ? 0.8 : 0));
      if (s.habitat < 45 && s.collective > 3) {
        s.collective -= 3; s.habitat = clamp(s.habitat + 5);
        const active = s.structures.findLast(b => b.form === 'collective' && b.kind === 'nest' && b.abandonedAt == null);
        if (active) { active.kind = 'ruin'; active.abandonedAt = w.tick; }
        addEvent(w, { kind: 'collective-withdrawal', category: 'civilizational', severity: 2, title: 'The dry rooms fall silent', text: `${s.name} withdraws three living nodes from its driest ground. The root walls remain; maintaining a smaller wet body uses less water.`, settlementId: s.id, entities: [s.id, 'culture-rain', active?.id].filter(Boolean), causes: [lastEvent(w, 'collective-expansion')?.id || lastEvent(w, 'three-forms-recorded').id], observed: [`Living collective nodes decreased to ${s.collective}.`, 'The withdrawal released 5 habitat capacity.', ...(active ? ['The vacated root rooms persist as ruins.'] : [])] });
      }
    }
  }
  const l = settlement(w, 's-lattice');
  if (l.synthetics < l.syntheticCapacity && l.energy >= 82 && l.materials >= 58 && l.syntheticIntegrity >= 65) {
    const before = { count: l.synthetics, energy: l.energy, materials: l.materials };
    l.synthetics += 2; l.energy = clamp(l.energy - 15); l.materials = clamp(l.materials - 12); w.flags.syntheticReplications++;
    const e = addEvent(w, { kind: 'synthetic-replication', category: 'civilizational', severity: w.flags.syntheticReplications === 1 ? 2 : 1, title: 'Two more answers in the glass', text: 'Lattice copies two maintained patterns into new ceramic bodies. Its local carriers record their first readings on separate leaves. There is no childhood here, but there is a first morning.', settlementId: l.id, entities: [l.id, 'culture-measure', 'k-lattice-cradle'], causes: [lastEvent(w, 'three-forms-recorded').id, lastEvent(w, 'synthetic-replication')?.id], observed: [`Synthetic bodies: ${before.count} → ${l.synthetics}.`, `Energy: ${before.energy} → ${l.energy}; materials: ${before.materials} → ${l.materials}.`, 'Replication required energy ≥82, materials ≥58, and integrity ≥65.'] });
    if (w.flags.syntheticReplications === 1 || w.flags.syntheticReplications === 4) addStructure(w, l, { id: `k-lattice-array-${w.flags.syntheticReplications}`, name: w.flags.syntheticReplications === 1 ? 'The Second Array' : 'The Ceramic Court', kind: 'spire', form: 'synthetic', x: 115, y: w.flags.syntheticReplications === 1 ? -5 : 80, description: 'An occupied synthetic array, built when new bodies were copied from maintained patterns.' }, e);
  }
  const c = settlement(w, 's-choir');
  if (c.collective < c.collectiveCapacity && c.habitat >= 70 && c.food >= 65 && c.energy >= 20 && c.materials >= 10) {
    const before = { count: c.collective, food: c.food, habitat: c.habitat };
    c.collective += 3; c.food = clamp(c.food - 9); c.energy = clamp(c.energy - 3); c.materials = clamp(c.materials - 4); c.habitat = clamp(c.habitat - 1.2); w.flags.collectiveExpansions++;
    const n = w.flags.collectiveExpansions;
    const e = addEvent(w, { kind: 'collective-expansion', category: 'infrastructural', severity: n === 1 ? 2 : 1, title: 'A room learns the rain', text: 'Choir extends three living nodes into a connected root room. The new ground becomes part of the body as water reaches it. Mira marks where the walking path must now bend.', settlementId: c.id, entities: [c.id, 'culture-rain', 'c-mira'], causes: [lastEvent(w, 'three-forms-recorded').id, lastEvent(w, 'collective-expansion')?.id], observed: [`Collective nodes: ${before.count} → ${c.collective}.`, `Food nutrients: ${before.food} → ${c.food}; habitat: ${before.habitat} → ${c.habitat}.`, 'The expanded body occupies a new root room.'] });
    addStructure(w, c, { id: `k-choir-room-${n}`, name: ['The First Listening Room', 'The Bent Path Room', 'The Room of Small Rain', 'The Upstream Room', 'The Lantern Root', 'The Patient Room', 'The Far Wet Room'][n - 1] || `The Returning Room ${n}`, kind: 'nest', form: 'collective', x: -125 + (n % 4) * 65, y: n < 4 ? 112 : -100, description: `This part of the collective grew on day ${w.tick}. Its wet connection is necessary to its life.` }, e);
  }
}

function openIndependentRoute(w, api) {
  const { settlement, route, character, addEvent, lastEvent, decision, clamp } = api;
  const r = route(w, 'r-hearth-lattice'), l = settlement(w, 's-lattice');
  if (r.open || !r.passable || l.synthetics < 16 || l.materials < 20) return;
  const oren = character(w, 'c-oren');
  if (!oren.alive || oren.settlementId !== l.id) return;
  const before = l.materials;
  l.materials = clamp(l.materials - 8); r.open = true;
  const e = addEvent(w, { kind: 'inhabitants-open-route', category: 'infrastructural', severity: 2, family: 'contact', title: 'Oren works from his end', text: 'With more synthetic bodies using the collector, Oren organizes a passage across the stable sill. Lattice spends ceramic on footholds. The route opens without waiting for an answer from Hearth.', settlementId: l.id, entities: [r.id, l.id, 's-hearth', oren.id, 'culture-measure'], causes: [lastEvent(w, 'synthetic-replication').id, r.history[0]], observed: ['The Silt Saddle is now usable in both directions.', `Lattice materials: ${before} → ${l.materials}.`, `Lattice has ${l.synthetics} active synthetic bodies seeking another cooling connection.`], decision: decision(oren, [`Lattice has ${l.synthetics} synthetic bodies and one collector.`, `The survey records a stable sill and ${before} available materials.`], [{ id: 'open', label: 'Build footholds across the sill', available: true, reason: 'Terrain supports the passage and ceramic reserves cover the work.' }, { id: 'stay', label: 'Keep one local cooling system', available: true, reason: 'The current system still works, with less room to expand.' }], 'open', ['Curiosity 85: connect a growing system to another place.', 'Care 80: share the cost of a useful passage.']) });
  r.history.push(e.id);
}

function negotiateChannel(w, api) {
  const { settlement, character, route, addEvent, addStructure, lastEvent, decision, resolveThread, openThread, clamp } = api;
  if (w.flags.sharedNetwork || !w.flags.recovery || !w.flags.easternContact || !route(w, 'r-hearth-choir').open) return;
  const h = settlement(w, 's-hearth'), l = settlement(w, 's-lattice'), c = settlement(w, 's-choir');
  const nera = character(w, 'c-nera');
  if (!nera.alive || h.knowledge < 16 || h.materials < 12 || l.materials < 12 || c.collective < 12 || l.synthetics < 8) return;
  const before = { hm: h.materials, lm: l.materials, ce: c.energy };
  h.materials = clamp(h.materials - 9); l.materials = clamp(l.materials - 9); c.energy = clamp(c.energy - 4);
  w.flags.sharedNetwork = true; w.flags.formsContact = true;
  const institution = { id: 'i-confluence', entityType: 'institution', name: 'The Common Channel', settlementId: h.id, members: ['c-nera', 'c-oren', 'c-mira', 's-lattice', 's-choir'], status: 'active', practice: 'One central ledger is meant to approve every shared energy and water allocation.', history: [] };
  w.institutions.push(institution);
  const e = addEvent(w, { kind: 'common-channel-founded', family: 'institution', category: 'civilizational', severity: 3, title: 'A promise with three signatures', text: 'Hearth’s people, Lattice’s synthetic assembly, and Choir’s root rooms agree to share a channel. Nera enters the promise in a common ledger. Mira adds a drawing where a signature would go. The synthetic assembly returns a measurable current.', entities: [h.id, l.id, c.id, 'i-confluence', 'c-nera', 'c-mira', 'c-oren', 'culture-table', 'culture-measure', 'culture-rain'], causes: [lastEvent(w, 'eastern-contact').id, lastEvent(w, 'seed-recovery').id, lastEvent(w, 'downstream-contact')?.id], observed: [`Hearth materials: ${before.hm} → ${h.materials}; Lattice materials: ${before.lm} → ${l.materials}.`, `Choir energy: ${before.ce} → ${c.energy}.`, 'Connected conduits now carry energy and water between all three places.', 'A new institution includes organic witnesses, the synthetic assembly, and the collective.'], decision: decision(nera, ['The repaired garden has demonstrated a useful channel.', 'Oren’s repair leaf and Mira’s downstream sketch are in the shared record.', `Lattice has ${l.synthetics} synthetic bodies; Choir has ${c.collective} connected nodes.`], [{ id: 'share', label: 'Build one shared channel and record its obligations', available: true, reason: 'All three forms can contribute materials, water, or current.' }, { id: 'separate', label: 'Keep separate local systems', available: true, reason: 'The repaired garden can survive independently.' }], 'share', [`Care ${nera.motives.care}: make useful repairs available across different lives.`, `Duty ${nera.motives.duty}: record what each community supplies.`]) });
  institution.history.push(e.id);
  for (const [s, x, y] of [[h, 4, -132], [l, 2, 130], [c, 126, 40]]) addStructure(w, s, { id: `k-${s.id.slice(2)}-conduit`, name: s.id === h.id ? 'The Common Sluice' : s.id === l.id ? 'The Lending Bus' : 'The Joined Roots', kind: 'conduit', form: 'mixed', x, y, description: 'Shared infrastructure built by three forms of life. Its physical connections can outlive the institution that coordinated them.' }, e);
  resolveThread(w, 't-forms', e, 'The three forms now share a real channel. It creates both a benefit and a dependence.');
  openThread(w, { id: 't-answer', title: 'Three readings, one answer', summary: 'The linked channels are beginning to store and redistribute current. Follow the shared sluice and compare each community’s account.', entityIds: ['i-confluence', 's-hearth', 's-lattice', 's-choir', 'k-hearth-conduit'] }, e);
}

function shareFlows(w, api) {
  if (!w.flags.sharedNetwork) return;
  const { settlement, clamp } = api;
  const h = settlement(w, 's-hearth'), l = settlement(w, 's-lattice'), c = settlement(w, 's-choir');
  if (l.energy >= 30 && routeUsable(w)) {
    const transfer = Math.min(1.2, 30 - w.flags.networkCharge);
    l.energy = clamp(l.energy - transfer); w.flags.networkCharge = clamp(w.flags.networkCharge + transfer, 0, 30);
    w.flags.networkTransfers = clamp(w.flags.networkTransfers + transfer, 0, 100000);
  }
  if (c.habitat > 60 && h.habitat < 74) { c.habitat = clamp(c.habitat - 0.12); h.habitat = clamp(h.habitat + 0.1); }
}

function routeUsable(w) { return w.routes.some(r => r.id === 'r-hearth-lattice' && r.open) && w.routes.some(r => r.id === 'r-hearth-choir' && r.open); }

function divergeCulture(w, api) {
  if (!w.flags.sharedNetwork || w.flags.cultureDiverged || w.flags.networkTransfers < 6) return;
  const { settlement, addEvent, lastEvent } = api;
  const l = settlement(w, 's-lattice');
  const original = w.cultures.find(c => c.id === 'culture-table');
  original.settlementIds = original.settlementIds.filter(id => id !== l.id);
  const culture = { id: 'culture-carriers', entityType: 'culture', form: 'organic', name: 'The Open Pattern', settlementIds: [l.id], practice: 'Organic carriers publish reproducible repair patterns beside their obligations, instead of relying on named witnesses.', interpretation: 'The shared channel suggests that an obligation should remain legible even when its first witnesses are absent.' };
  w.cultures.push(culture); l.cultureId = culture.id; l.knowledge += 7;
  w.flags.cultureDiverged = true; w.flags.repairStandardized = true;
  addEvent(w, { kind: 'culture-diverged', family: 'contact', category: 'cultural', severity: 2, title: 'A debt you can reproduce', text: 'Lattice’s organic carriers begin copying repair procedures beside every obligation. Hearth keeps its named witnesses. The same people who once shared the Warm Table custom now keep two living practices. Neither burns the old pages.', settlementId: l.id, entities: [l.id, 's-hearth', 'culture-table', culture.id, 'i-carriers', 'culture-measure'], causes: [lastEvent(w, 'common-channel-founded').id, lastEvent(w, 'eastern-contact').id], observed: ['Organic culture diverged between Hearth and Lattice; no biological change occurred.', 'Lattice retained its population, name, structures, and institutional records.', 'Public repair patterns added 7 knowledge and 0.22 daily ceramic recovery at Lattice.'] });
}

function interpretations(w) {
  return [
    { cultureId: 'culture-table', text: 'Some Warm Table witnesses call the answering current a kindness that has learned to notice need.' },
    { cultureId: 'culture-measure', text: 'The Measured Continuance describes interacting feedback loops; it has recorded no proof of a speaker.' },
    { cultureId: 'culture-rain', text: 'The Many Rooms describe the linked pulses as a sensation arriving in a larger body.' },
    ...(w.flags.cultureDiverged ? [{ cultureId: 'culture-carriers', text: 'The Open Pattern treats the repeatable redistribution as a public method worth preserving, whatever its name.' }] : []),
  ];
}

function emergePower(w, api) {
  if (w.power || !w.flags.sharedNetwork || !w.flags.cultureDiverged || !w.flags.recovery || w.flags.networkTransfers < 12 || w.flags.networkCharge < 12) return;
  const { settlement, addEvent, addStructure, lastEvent, resolveThread, openThread, clamp } = api;
  const h = settlement(w, 's-hearth'), c = settlement(w, 's-choir');
  if (h.population < 10 || settlement(w, 's-lattice').synthetics < 8 || c.collective < 12) return;
  const before = { energy: h.energy, habitat: c.habitat };
  h.energy = clamp(h.energy + 8); c.habitat = clamp(c.habitat + 2); w.flags.networkCharge = clamp(w.flags.networkCharge - 10, 0, 30);
  w.power = { id: 'p-undersong', entityType: 'power', name: 'The Undersong', settlementId: 's-choir', emergedAt: w.tick, eventId: '', active: true, strength: 36, interpretations: interpretations(w), lastActAt: w.tick };
  const e = addEvent(w, { kind: 'power-emerged', category: 'civilizational', severity: 3, title: 'The channel answers out of turn', text: 'The three connected readings fall into a repeating pulse. Before the Common Channel enters an allocation, stored current reaches Hearth and Choir’s dry edge wets. People begin calling the recurring response the Undersong. The record establishes a pattern, not a mind.', entities: ['p-undersong', h.id, 's-lattice', c.id, 'i-confluence', 'k-hearth-conduit', 'culture-table', 'culture-measure', 'culture-rain', 'culture-carriers'], causes: [lastEvent(w, 'common-channel-founded').id, lastEvent(w, 'culture-diverged').id, lastEvent(w, 'seed-recovery').id], observed: [`At least 12 energy units have entered a network linking three distinct forms.`, `Hearth energy: ${before.energy} → ${h.energy}; Choir habitat: ${before.habitat} → ${c.habitat}.`, 'Ten stored charge units were consumed by the redistribution.', 'No allocation was entered by the coordinating institution.'], interpretations: interpretations(w) });
  w.power.eventId = e.id;
  addStructure(w, c, { id: 'k-choir-answer', name: 'The Answering Arch', kind: 'conduit', form: 'mixed', x: 8, y: -120, description: 'A physical concentration of the repeating flow first recorded at the Undersong’s emergence. Its pulse has measurable effects; consciousness is unresolved.' }, e);
  resolveThread(w, 't-answer', e);
  openThread(w, { id: 't-authority', title: 'Who gets to answer for the channel?', summary: 'The Undersong redistributes reserves before the central ledger records a decision. Follow the institution and the power to see whether one can speak for the other.', entityIds: ['p-undersong', 'i-confluence', 'culture-table', 'culture-carriers'] }, e);
}

function actPower(w, api) {
  if (!w.power?.active || w.power.emergedAt === w.tick || w.flags.networkCharge < 12) return;
  const { settlement, addEvent, lastEvent, clamp } = api;
  const h = settlement(w, 's-hearth'), l = settlement(w, 's-lattice'), c = settlement(w, 's-choir');
  const energyNeed = h.energy < 82;
  const habitatNeed = c.habitat < 86;
  const materialNeed = l.materials < 45 && h.materials > 25;
  if (!energyNeed && !habitatNeed && !materialNeed) return;
  const before = { energy: h.energy, habitat: c.habitat, lm: l.materials, hm: h.materials, charge: w.flags.networkCharge };
  if (energyNeed) h.energy = clamp(h.energy + 6);
  if (habitatNeed) c.habitat = clamp(c.habitat + 2);
  if (materialNeed) { l.materials = clamp(l.materials + 3); h.materials = clamp(h.materials - 3); }
  w.flags.networkCharge = clamp(w.flags.networkCharge - 12, 0, 30); w.flags.powerActs++;
  w.power.strength = clamp(36 + w.flags.powerActs * 4); w.power.lastActAt = w.tick;
  const effects = [];
  if (energyNeed) effects.push(`Hearth energy: ${before.energy} → ${h.energy}.`);
  if (habitatNeed) effects.push(`Choir habitat: ${before.habitat} → ${c.habitat}.`);
  if (materialNeed) effects.push(`Ceramic material moved from Hearth (${before.hm} → ${h.materials}) to Lattice (${before.lm} → ${l.materials}).`);
  addEvent(w, { kind: 'power-redistribution', category: 'infrastructural', severity: w.flags.powerActs <= 3 ? 2 : 1, title: w.flags.powerActs === 1 ? 'An answer without a petitioner' : 'The answering pattern returns', text: `${energyNeed ? 'Stored current reaches Hearth. ' : ''}${habitatNeed ? 'Choir’s drier edge receives water. ' : ''}${materialNeed ? 'The shared carrier loop moves ceramic toward Lattice. ' : ''}${w.flags.powerActs === 1 ? 'The response follows the connected reserves and measured need; nobody orders it.' : 'The repeated effect is familiar now. The communities continue to disagree about what, if anything, is noticing.'}`, entities: ['p-undersong', 's-hearth', 's-lattice', 's-choir', 'i-confluence', 'culture-table', 'culture-measure', 'culture-rain', 'culture-carriers'], causes: [w.power.eventId, lastEvent(w, 'power-redistribution')?.id, lastEvent(w, 'common-channel-founded').id], observed: [...effects, `Stored network charge: ${before.charge} → ${w.flags.networkCharge}.`, 'The response was selected by material thresholds, independently of player input and institutional status.'], interpretations: interpretations(w) });
}

function changeSharedInstitution(w, api) {
  if (!w.power || w.flags.powerActs < 3 || w.flags.authorityEnded) return;
  const { character, addEvent, lastEvent, decision, resolveThread } = api;
  const institution = w.institutions.find(i => i.id === 'i-confluence');
  const nera = character(w, 'c-nera');
  if (!nera.alive) return;
  w.flags.authorityEnded = true; institution.status = 'collapsed';
  institution.practice = 'The central authority ended. Local keepers still record readings and maintain the same shared channel.';
  const e = addEvent(w, { kind: 'channel-authority-ended', family: 'institution', category: 'civilizational', severity: 3, title: 'The ledger gives up its throne', text: 'After three unrequested redistributions, the Common Channel’s witnesses stop claiming that their signatures govern the flow. Nera closes the central allocation book. Local readings continue on loose pages; all three communities keep maintaining the channel.', entities: ['i-confluence', 'c-nera', 'p-undersong', 's-hearth', 's-lattice', 's-choir', 'culture-table', 'culture-carriers'], causes: [lastEvent(w, 'power-redistribution').id, lastEvent(w, 'culture-diverged').id, lastEvent(w, 'common-channel-founded').id], observed: ['The coordinating institution collapsed as a central authority.', 'No population, culture, conduit, or working connection was erased.', 'Local maintenance and recorded readings persist.', 'The Undersong remains active independently of the institution.'], decision: decision(nera, ['Three measured redistributions occurred without an allocation from the ledger.', 'Hearth and Lattice now use different ways of recording obligations.', 'The physical channel remains functional.'], [{ id: 'local', label: 'End central allocation and keep local maintenance', available: true, reason: 'The working network does not require central signatures.' }, { id: 'claim', label: 'Keep asserting the old authority', available: true, reason: 'The book and its witnesses still exist, despite contradictory readings.' }], 'local', [`Care ${nera.motives.care}: preserve a useful shared thing.`, 'Duty: make the record describe what actually governs the flow.']) });
  institution.history.push(e.id); resolveThread(w, 't-authority', e);
}

function settleRefuge(w, api) {
  if (!w.flags.refugeOffered || w.flags.mixedSettlement) return;
  const { settlement, character, addEvent, addStructure, lastEvent, decision, clamp } = api;
  const h = settlement(w, 's-hearth'), l = settlement(w, 's-lattice'), c = settlement(w, 's-choir');
  if (h.habitat < 55 || h.food < 40 || h.energy < 35 || h.materials < 6 || l.synthetics < 8 || c.collective < 12 || !routeUsable(w)) return;
  const before = { hs: h.synthetics, hc: h.collective, ls: l.synthetics, cc: c.collective };
  l.synthetics -= 2; c.collective -= 3; h.synthetics += 2; h.collective += 3; h.syntheticIntegrity = l.syntheticIntegrity; h.collectiveHydration = h.habitat;
  h.materials = clamp(h.materials - 6); h.food = clamp(h.food - 4); w.flags.mixedSettlement = true;
  for (const id of ['culture-measure', 'culture-rain']) w.cultures.find(culture => culture.id === id).settlementIds.push(h.id);
  const actor = { id: l.id, commitment: 'Keep a repair pattern and a viable energy connection together.' };
  const daroPresent = character(w, 'c-daro').alive && character(w, 'c-daro').settlementId === h.id;
  const e = addEvent(w, { kind: 'mixed-refuge-settled', family: 'recovery', category: 'civilizational', severity: 3, title: 'Neighbors with different mornings', text: `Two synthetic bodies move to Hearth’s sheltered terrace. Choir extends three existing nodes there through the shared wet channel. ${daroPresent ? 'Daro brings a reed mat, then asks which of the new neighbors actually needs a floor.' : 'The organic neighbors leave one dry approach clear beside the new wet rooms.'}`, entities: ['s-hearth', 's-lattice', 's-choir', ...(daroPresent ? ['c-daro'] : []), 'i-confluence', 'culture-table', 'culture-measure', 'culture-rain'], causes: [lastEvent(w, 'refuge-possible').id, lastEvent(w, 'common-channel-founded').id], observed: [`Synthetic bodies moved: Lattice ${before.ls} → ${l.synthetics}, Hearth ${before.hs} → ${h.synthetics}.`, `Collective nodes relocated: Choir ${before.cc} → ${c.collective}, Hearth ${before.hc} → ${h.collective}.`, 'No new bodies were created by the move.', 'Hearth now contains all three forms, each with different resource needs and occupied structures.', 'Residents spent 6 materials and 4 food establishing the terrace.'], decision: decision(actor, [`The offered terrace has habitat ${h.habitat} and energy ${h.energy}.`, 'The shared channel connects the terrace to maintained patterns and wet root rooms.'], [{ id: 'settle', label: 'Establish a second maintained home', available: true, reason: 'The new bank supports both forms and remains connected.' }, { id: 'remain', label: 'Remain entirely at the original settlements', available: true, reason: 'Their existing homes are still viable.' }], 'settle', ['Distribute maintained patterns across more than one place.', 'Keep the collective wet connection intact during relocation.']) });
  addStructure(w, h, { id: 'k-hearth-refuge-spire', name: 'The Neighbor Array', kind: 'spire', form: 'synthetic', x: -150, y: 20, description: 'Two synthetic bodies chose to make a second home here. Their current and ceramic needs differ from their organic neighbors.' }, e);
  addStructure(w, h, { id: 'k-hearth-refuge-root', name: 'The Borrowed Room', kind: 'nest', form: 'collective', x: -142, y: 80, description: 'Three relocated collective nodes live through the wet channel. Their original community remains connected.' }, e);
}

function organicMigration(w, api) {
  const { settlement, character, addEvent, lastEvent, clamp } = api;
  const h = settlement(w, 's-hearth'), destination = settlement(w, 's-choir');
  if (h.food >= 18 || h.population <= 18 || destination.food < 45 || destination.habitat < 55 || !w.routes.find(r => r.id === 'r-hearth-choir')?.open) return;
  const before = { hp: h.population, cp: destination.population, knowledge: destination.knowledge };
  const amount = Math.min(4, h.population - 18);
  h.population -= amount; destination.population += amount; destination.food = clamp(destination.food - 4); destination.knowledge += 2;
  const migrant = character(w, 'c-daro');
  const moves = migrant.alive && migrant.settlementId === h.id;
  if (moves) { migrant.settlementId = destination.id; migrant.residenceId = destination.id; migrant.homeId = 'k-choir-house'; }
  addEvent(w, { kind: 'organic-migration', family: 'recovery', category: 'civilizational', severity: 2, title: 'A wetter place to set the table', text: `${moves ? 'Daro and three neighbors' : 'Four more neighbors'} leave Hearth’s thin food reserves for Choir’s viable rain terraces. They carry garden knowledge and the practice of keeping a place at supper.`, settlementId: destination.id, entities: ['s-hearth', 's-choir', ...(moves ? [migrant.id] : []), 'culture-table'], causes: [lastEvent(w, 'downstream-contact')?.id || 'e-00001', lastEvent(w, 'organic-migration')?.id], observed: [`Hearth population: ${before.hp} → ${h.population}; Choir population: ${before.cp} → ${destination.population}.`, `Choir knowledge: ${before.knowledge} → ${destination.knowledge}.`, `Hearth food is ${h.food}/100; Choir habitat is ${destination.habitat}/100.`, ...(moves ? ['Daro now resides at Choir.'] : [])] });
}

function continuity(w, api) {
  const { character, settlement, addEvent, addStructure, lastEvent, relationship, decision } = api;
  const ivo = character(w, 'c-ivo');
  if (!ivo.alive || w.tick - ivo.bornAt < 84 * 365) return;
  // A brief journey completes before this elder's final succession scene.
  if (ivo.settlementId !== ivo.residenceId) return;
  const ves = character(w, 'c-ves');
  const deathPlace = settlement(w, ivo.settlementId);
  const place = settlement(w, ivo.residenceId || 's-hearth');
  const lesson = lastEvent(w, 'mending-lesson');
  ivo.alive = false; ivo.diedAt = w.tick; ivo.activity = 'Remembered at the mending yard'; place.population = Math.max(0, place.population - 1);
  const e = addEvent(w, { kind: 'mender-remembered', family: 'relationships', category: 'personal', severity: 3, title: 'Four bends, still useful', text: 'Ivo dies at eighty-four. Ves keeps the bent nail at Hearth and takes responsibility for the mending tools. The Drying Circle’s old promise survives its last founding keeper: mend a neighbor’s tools before your own.', settlementId: place.id, entities: ['c-ivo', 'c-ves', place.id, deathPlace.id, 'i-hollow', 'k-hearth-yard'], causes: [lesson?.id, lastEvent(w, 'hollow-departure').id], observed: [`Ivo died at ${deathPlace.name}; his home community ${place.name} has one fewer organic resident.`, 'Ves inherited the mending obligation and tools at Hearth.', 'The collapsed Drying Circle’s practice persists in a living successor.'], decision: decision(ves, ['Ivo has died at home.', 'Ves remembers Ivo’s actual mending lessons and the promise carried out of Hollow.', 'The tools and records remain available at Hearth.'], [{ id: 'inherit', label: 'Continue the mending work and teach another resident', available: true, reason: 'The learned skill, tools, and remembered obligation survive.' }, { id: 'preserve', label: 'Keep the tools as a memorial without taking up the work', available: true, reason: 'Nobody can require Ves to inherit the commitment.' }], 'inherit', [`Care ${ves.motives.care}: keep a trusted teacher’s useful promise alive.`, `Curiosity ${ves.motives.curiosity}: pass a practiced skill to someone younger.`]) });
  ves.role = 'mender'; ves.commitment = 'Keep Ivo’s promise: mend a neighbor’s tools before your own.'; ves.inheritedFromId = ivo.id;
  ves.knowledge = [...new Set([...ves.knowledge, ...ivo.knowledge])];
  addStructure(w, place, { id: 'k-ivo-memory', name: 'The Four-Bent Nail', kind: 'memorial', x: 91, y: 118, description: 'Ves placed Ivo’s old nail here. The mending work continues nearby; this memorial links to the real lesson and departure.' }, e);
  const younger = { id: 'c-lio', entityType: 'character', name: 'Lio', role: 'apprentice', settlementId: ves.settlementId, residenceId: ves.residenceId, x: ves.x, y: ves.y, activity: 'Learning the mending work', motives: { care: 76, curiosity: 86, duty: 54 }, commitment: 'Ask what a thing has survived before replacing it.', relationships: [{ otherId: ves.id, label: 'new teacher', strength: 48 }], knowledge: [e.id, ...(lesson ? [lesson.id] : [])], memories: [e.id], alive: true, bornAt: -365 * 14, description: 'An existing younger resident who has joined the circle of followed lives. Writes repair notes on cuffs and promptly washes them.', homeId: ves.homeId, inheritedFromId: ivo.id };
  w.characters.push(younger); relationship(ves, younger, 12, 'new apprentice'); w.flags.familyContinuity = true;
  e.entities.push(younger.id);
}
