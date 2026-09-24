/**
 * Reusable household ecology. No character, settlement, seed, or story flag selects
 * an outcome. Geography, known routes, reserves, labor, and carrying space do.
 *
 * Protected invariant: moving households transfers existing people and supplies;
 * only recorded birth decisions add people. Decisions copy their BEFORE state,
 * and production, consumption, waste, and construction have explicit accounts.
 * The aggregate households are not substitutes for individual character agency.
 */
const LIMITS = Object.freeze({ settlements: 10, inventory: 100, plots: 7, homes: 12 });
const RESOURCES = ['food', 'materials', 'energy'];
const round = n => Math.round(n * 1000) / 1000;
const bounded = (n, low, high) => Math.max(low, Math.min(high, n));
const copy = value => structuredClone(value);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const residentCount = (w, s) => w.characters.filter(c => c.alive && (c.residenceId || c.settlementId) === s.id).length;
const reserve = s => Object.fromEntries(RESOURCES.map(key => [key, s[key]]));
const inventory = s => ({ population: s.population, housingCapacity: s.housingCapacity, habitat: s.habitat, ...reserve(s) });

function noise(seed, slot, field) {
  let x = (seed ^ Math.imul(slot + 1, 0x9e3779b1) ^ Math.imul(field + 1, 0x85ebca77)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

function profile(w, x, y, slot) {
  const wetness = w.config.climate === 'dry' ? -0.2 : w.config.climate === 'wet' ? 0.16 : 0;
  const water = round(bounded(0.28 + noise(w.seed, slot, 1) * 0.65 + wetness, 0.12, 1));
  return {
    id: `site-${slot + 1}`, x: round(x), y: round(y),
    soil: round(0.3 + noise(w.seed, slot, 2) * 0.7), water,
    solar: round(0.25 + noise(w.seed, slot, 3) * 0.65 - wetness * 0.5),
    arablePlots: 2 + Math.floor(noise(w.seed, slot, 4) * 6),
    buildingLots: 3 + Math.floor(noise(w.seed, slot, 5) * 7),
    roughness: round(0.15 + noise(w.seed, slot, 6) * 0.8),
    seasonOffset: round(noise(w.seed, slot, 7) * Math.PI * 2),
    settlementId: null,
  };
}

function attach(s, site) {
  site.settlementId = s.id;
  // Existing buildings remain real, even if their founders chose crowded ground.
  site.buildingLots = Math.max(site.buildingLots, Math.ceil(s.housingCapacity / 8));
  s.ecology = {
    siteId: site.id, plots: Math.min(site.arablePlots, Math.max(1, Math.ceil(s.population / 16))),
    soilCondition: 0.9, waterworks: 0, pressure: 0, laborDebt: 0,
    nourishment: 0, births: 0, arrivals: 0, departures: 0,
    birthProgress: 0, knownSites: [], lastDecisionId: null, pressureEventId: null,
    pressureEpisode: 0, flow: null, built: 0,
    initialGardenCount: s.structures.filter(b => b.kind === 'garden').length,
  };
}

export function initializeEcology(w, api) {
  if (w.ecology) return;
  const sites = w.settlements.map((s, index) => profile(w, s.x, s.y, index));
  // Rejection only determines geography. No later decision reads the seed.
  for (let attempt = 0; sites.length < LIMITS.settlements && attempt < 512; attempt++) {
    const x = 130 + noise(w.seed, attempt + 50, 0) * 940;
    const y = 105 + noise(w.seed, attempt + 50, 1) * 590;
    if (sites.some(site => distance(site, { x, y }) < 195)) continue;
    sites.push(profile(w, x, y, sites.length));
  }
  w.ecology = {
    version: 1, sites, limits: { ...LIMITS }, initialPopulation: w.settlements.reduce((n, s) => n + s.population, 0),
    births: 0, production: { food: 0, materials: 0, energy: 0 },
    consumed: { food: 0, materials: 0, energy: 0 }, waste: { food: 0, materials: 0, energy: 0 },
    costs: { food: 0, materials: 0, energy: 0 }, unmetFood: 0,
  };
  for (let index = 0; index < w.settlements.length; index++) attach(w.settlements[index], sites[index]);
  const e = api.addEvent(w, {
    kind: 'habitat-survey', category: 'civilizational', severity: 1,
    title: 'The ground beneath each home',
    text: 'The households measure their own growing ground, water, and building space. Unvisited ground remains unknown to them.',
    entities: w.settlements.map(s => s.id), settlementId: w.settlements[0].id,
    causes: w.events.length ? [w.events[0].id] : [],
    observed: w.settlements.map(s => {
      const site = sites.find(v => v.id === s.ecology.siteId);
      return `${s.name}: soil ${site.soil}, water ${site.water}, ${site.arablePlots} growing plots, ${site.buildingLots} building lots.`;
    }),
    evidence: { rule: 'local-survey', sites: sites.filter(site => site.settlementId).map(copy) },
  });
  for (const s of w.settlements) s.ecology.lastDecisionId = e.id;
}

/** Current-day material budget; exported to support interventions and honest tests. */
export function ecologyBudget(w, s, population = s.population) {
  const site = w.ecology.sites.find(v => v.id === s.ecology.siteId);
  const season = 1 + 0.33 * Math.sin(w.tick * Math.PI * 2 / 120 + site.seasonOffset);
  const water = bounded(site.water + s.ecology.waterworks * 0.13, 0.12, 1.1);
  const labor = bounded(population / Math.max(1, s.ecology.plots * 5), 0, 1);
  const health = 0.65 + s.habitat * 0.0035;
  const perPlot = (0.5 + site.soil * 0.55) * (0.4 + water * 0.75) * s.ecology.soilCondition * health;
  const gardens = s.structures.filter(b => b.kind === 'garden' && !b.ecologyBuilt && b.abandonedAt == null);
  const annotatedYield = gardens.reduce((sum, garden) => sum + (garden.foodProduction || 0), 0);
  const unannotated = Math.max(0, gardens.filter(garden => !garden.foodProduction).length - s.ecology.initialGardenCount);
  const organicMeanFood = population ? round((0.15 + s.ecology.plots * perPlot * labor + annotatedYield + unannotated * 0.35)) : 0;
  // Collective nutrient flows are applied by the life-form module after this
  // module. They still share the pantry and must enter household forecasts.
  const otherFoodFlow = s.collective > 0 ? round(s.collective * 0.018 - (s.habitat < 50 ? 0.8 : 0)) : 0;
  const meanFood = round(organicMeanFood + otherFoodFlow);
  const demand = round(population * 0.033);
  return {
    food: round(organicMeanFood * season), meanFood, organicMeanFood, otherFoodFlow, foodDemand: demand, foodBalance: round(meanFood - demand),
    materials: population ? round(0.12 + Math.min(population, 40) * 0.006 + s.knowledge * 0.002) : 0,
    energy: population ? round(site.solar * 0.23) : 0,
    reserveDays: demand ? round(s.food / demand) : 0,
    housingSlack: s.housingCapacity - population,
    growingSpace: site.arablePlots - s.ecology.plots,
    buildingSpace: Math.max(0, site.buildingLots * 8 - s.housingCapacity),
    season: round(season), water: round(water), perPlot: round(perPlot),
  };
}

function resourceFlows(w, s) {
  const before = reserve(s), budget = ecologyBudget(w, s);
  const produced = { food: budget.food, materials: budget.materials, energy: budget.energy };
  const consumed = { food: Math.min(before.food + produced.food, budget.foodDemand), materials: 0, energy: 0 };
  const wasted = {};
  for (const key of RESOURCES) {
    const available = round(before[key] + produced[key] - consumed[key]);
    wasted[key] = round(Math.max(0, available - LIMITS.inventory));
    s[key] = round(bounded(available, 0, LIMITS.inventory));
    for (const [total, amount] of [['production', produced[key]], ['consumed', consumed[key]], ['waste', wasted[key]]]) {
      w.ecology[total][key] = round(w.ecology[total][key] + amount);
    }
  }
  const unmetFood = round(budget.foodDemand - consumed.food);
  w.ecology.unmetFood = round(w.ecology.unmetFood + unmetFood);
  s.ecology.nourishment = round(bounded(s.ecology.nourishment + (unmetFood > 0 ? -2 : 0.25), -30, 30));
  const site = w.ecology.sites.find(v => v.id === s.ecology.siteId);
  // Fallow land recovers. Crowded cultivation slowly wears soil; a smaller
  // household can therefore return later for an actual material reason.
  const load = s.population / Math.max(1, site.arablePlots * 14);
  s.ecology.soilCondition = round(bounded(s.ecology.soilCondition + 0.0013 - load * 0.0014 + s.ecology.waterworks * 0.00015, 0.45, 1));
  const targetHabitat = 30 + site.water * 55;
  s.habitat = round(bounded(s.habitat + (targetHabitat - s.habitat) * 0.001, 0, 100));
  s.ecology.laborDebt = round(Math.max(0, s.ecology.laborDebt - Math.max(0.15, s.population * 0.015)));
  s.ecology.flow = { tick: w.tick, before, produced, consumed, wasted, unmetFood, after: reserve(s), budget };
}

function pay(w, s, costs) {
  for (const key of RESOURCES) {
    const amount = costs[key] || 0;
    if (s[key] + 1e-8 < amount) throw new Error(`Unfunded household decision: ${key}.`);
    s[key] = round(s[key] - amount);
    w.ecology.costs[key] = round(w.ecology.costs[key] + amount);
  }
}

function canPay(s, costs) { return RESOURCES.every(key => s[key] >= (costs[key] || 0)); }

function travelPaths(w, origin) {
  const paths = new Map([[origin.id, { distance: 0, routes: [] }]]);
  const queue = [origin.id];
  while (queue.length) {
    const current = queue.shift(), path = paths.get(current);
    for (const route of w.routes) {
      if (!route.open || route.passable === false || (route.from !== current && route.to !== current)) continue;
      const next = route.from === current ? route.to : route.from;
      const a = w.settlements.find(s => s.id === current), b = w.settlements.find(s => s.id === next);
      if (!a || !b) continue;
      const length = path.distance + distance(a, b);
      if (paths.has(next) && paths.get(next).distance <= length) continue;
      paths.set(next, { distance: length, routes: [...path.routes, route.id] }); queue.push(next);
    }
  }
  return paths;
}

function context(w, s, alternatives, chosen, api, extra = {}) {
  const budget = ecologyBudget(w, s);
  const known = [
    `${s.population} residents occupy ${s.housingCapacity} sleeping places.`,
    `Food ${s.food}; daily need ${budget.foodDemand}; average harvest ${budget.meanFood}; reserve ${budget.reserveDays} days.`,
    `Materials ${s.materials}; energy ${s.energy}; habitat ${s.habitat}.`,
    `${budget.growingSpace} unused growing plots and ${budget.buildingSpace} possible sleeping places remain on measured ground.`,
    `Accumulated pressure ${s.ecology.pressure}; remaining work burden ${s.ecology.laborDebt}.`,
  ];
  const actor = { id: s.id, commitment: 'Keep the existing households fed and housed without promising supplies that do not exist.' };
  const decision = api.decision ? api.decision(actor, known, alternatives.map(({ score, ...value }) => value), chosen,
    ['Protect food reserves and viable homes.', 'Prefer a workable local repair to the cost and uncertainty of moving.']) : {
      actorId: s.id, known, alternatives: alternatives.map(({ score, ...value }) => value), chosen,
      motives: ['Protect food reserves and viable homes.'],
    };
  return { decision, evidence: { rule: 'household-provisioning', before: inventory(s), budget, pressure: s.ecology.pressure, ...copy(extra) } };
}

function trace(w, s, api, details, snapshot) {
  const event = api.addEvent(w, {
    category: 'civilizational', family: 'recovery', severity: 2,
    settlementId: s.id, entities: [s.id], causes: [...new Set([s.ecology.pressureEventId, s.ecology.lastDecisionId].filter(Boolean))],
    ...details, ...snapshot,
  });
  s.ecology.lastDecisionId = event.id;
  return event;
}

function updatePressure(w, s, api) {
  if (!s.population) return;
  const budget = ecologyBudget(w, s);
  const projected = s.food + Math.min(0, budget.foodBalance) * 16;
  const stressed = projected < budget.foodDemand * 18 || budget.housingSlack < 0;
  s.ecology.pressure = round(bounded(s.ecology.pressure + (stressed ? 1 : -0.65), 0, 24));
  if (s.ecology.pressure >= 5 && !s.ecology.pressureEventId) {
    s.ecology.pressureEpisode++;
    const event = trace(w, s, api, {
      kind: 'provisioning-pressure', title: `${s.name} counts the stores twice`,
      text: `${s.name} has less room or food than its households can comfortably rely on. They compare the ground they can improve with homes they can reach.`,
      observed: [`Food reserve: ${budget.reserveDays} days at current population.`, `Average harvest minus daily need: ${budget.foodBalance}.`, `Housing places minus residents: ${budget.housingSlack}.`],
      evidence: { rule: 'sustained-shortfall', before: inventory(s), budget: copy(budget), pressure: s.ecology.pressure },
    });
    s.ecology.pressureEventId = event.id;
    api.openThread?.(w, { id: `t-provision-${s.ecology.siteId}-${s.ecology.pressureEpisode}`, title: `Enough for ${s.name}?`, summary: 'Follow the households as they compare repairing their growing ground, sharing another home, and settling surveyed ground.', entityIds: [s.id] }, event);
  } else if (!stressed && s.ecology.pressure === 0 && s.ecology.pressureEventId) {
    const event = trace(w, s, api, { kind: 'provisioning-recovered', title: `${s.name} has room to breathe`, text: `The households at ${s.name} can meet their measured needs again. The buildings, paths, and decisions that got them here remain.`, observed: [`Food reserve: ${budget.reserveDays} days.`, `Housing slack: ${budget.housingSlack}.`], evidence: { rule: 'recovered-provisioning', before: inventory(s), budget: copy(budget) } });
    api.resolveThread?.(w, `t-provision-${s.ecology.siteId}-${s.ecology.pressureEpisode}`, event, 'The measured food and housing pressure has eased.');
    s.ecology.pressureEventId = null;
  }
}

function adaptation(w, s) {
  const b = ecologyBudget(w, s), site = w.ecology.sites.find(v => v.id === s.ecology.siteId);
  const choices = [];
  const foodNeed = Math.max(0, b.foodDemand * 1.2 - b.meanFood);
  const farms = { food: 2, materials: 13, energy: 1 };
  choices.push({ id: 'cultivate', label: 'Prepare another growing plot', available: s.ecology.plots < site.arablePlots && canPay(s, farms) && s.population >= (s.ecology.plots + 1) * 3,
    reason: `${site.arablePlots - s.ecology.plots} growing plots remain; costs 13 materials, 2 food, and 1 energy.`, costs: farms, score: foodNeed > 0 ? 7 + foodNeed * 8 : -1 });
  const water = { food: 3, materials: 18, energy: 2 };
  choices.push({ id: 'irrigate', label: 'Catch and retain more local water', available: s.ecology.waterworks < 2 && site.water < 0.75 && canPay(s, water),
    reason: `Water ${site.water}; ${2 - s.ecology.waterworks} catchments remain possible; costs 18 materials, 3 food, and 2 energy.`, costs: water, score: foodNeed > 0 ? 5 + foodNeed * 4 : -1 });
  const home = { food: 3, materials: 18, energy: 1 };
  choices.push({ id: 'house', label: 'Build another shared home', available: b.buildingSpace >= 8 && canPay(s, home),
    reason: `${b.buildingSpace} possible sleeping places remain; costs 18 materials, 3 food, and 1 energy.`, costs: home,
    score: b.housingSlack < 0 ? 24 : b.housingSlack < 3 && b.foodBalance > 0.15 && b.reserveDays > 25 ? 8 : -1 });
  return choices;
}

function alternatives(w, s) {
  const sourceBudget = ecologyBudget(w, s);
  const focalResidents = residentCount(w, s);
  const amount = Math.min(6, focalResidents === 0 && s.population <= 6 ? s.population : Math.max(2, Math.ceil(s.population * 0.12)), s.population - focalResidents);
  const entries = [{ id: 'stay', label: 'Keep using the current homes and stores', available: true, reason: 'No move or building work is required.', score: 0 }, ...adaptation(w, s)];
  const paths = travelPaths(w, s);
  for (const destination of w.settlements) {
    if (destination.id === s.id) continue;
    const movingAmount = Math.min(amount, Math.max(0, destination.housingCapacity - destination.population));
    const path = paths.get(destination.id), budget = ecologyBudget(w, destination, destination.population + Math.max(0, movingAmount));
    // An empty place's latent rooms/plots become usable only after paying for
    // ALL of that capacity. One repaired doorway cannot reactivate a whole town.
    const restoration = round(8 + destination.ecology.plots * 4 + Math.max(0, destination.housingCapacity - 8) / 4);
    const costs = { food: round(Math.max(0, movingAmount) * 0.65 + (path?.distance || 0) / 350), materials: destination.population ? 1 : restoration, energy: 0 };
    const cargo = { food: round(Math.min(8, Math.max(0, LIMITS.inventory - destination.food), Math.max(0, movingAmount) * 1.2)), materials: 0, energy: 0 };
    const destinationCanSupport = budget.foodBalance >= 0.02 || destination.food + cargo.food + Math.min(0, budget.foodBalance) * 40 >= budget.foodDemand * 20;
    const available = !!path && movingAmount >= 1 && destination.habitat >= 38 && destination.population + movingAmount <= destination.housingCapacity
      && destination.food + cargo.food <= LIMITS.inventory && destinationCanSupport && canPay(s, { food: costs.food + cargo.food, materials: costs.materials });
    entries.push({ id: `migrate:${destination.id}`, action: 'migrate', destinationId: destination.id, amount: movingAmount, costs, cargo, routes: path?.routes || [],
      label: `Share the homes at ${destination.name}`, available,
      reason: !path ? 'No usable chain of routes reaches these homes.' : `After arrival: ${budget.housingSlack} sleeping places free and ${budget.foodBalance} average food surplus; travel costs ${costs.food} food and ${costs.materials} materials; carry ${cargo.food} food.`,
      score: s.ecology.pressure >= 7 && (sourceBudget.foodBalance < 0 || sourceBudget.housingSlack < 0) ? 9 + Math.min(6, Math.max(0, -sourceBudget.foodBalance) * 8) - (path?.distance || 0) / 400 : -1 });
  }
  for (const surveyed of s.ecology.knownSites) {
    const site = w.ecology.sites.find(v => v.id === surveyed.siteId);
    if (!site || site.settlementId) continue;
    const estimate = siteBudget(site, amount), length = distance(s, site);
    const costs = { food: round(5 + length / 150), materials: round(18 + site.roughness * 8), energy: 2 };
    const cargo = { food: 10, materials: 6, energy: 4 };
    entries.push({ id: `found:${site.id}`, action: 'found', siteId: site.id, amount, costs, cargo, surveyEventId: surveyed.eventId,
      label: 'Start a home on surveyed ground', available: amount >= 3 && w.settlements.length < LIMITS.settlements && length <= 590 && estimate.foodBalance > 0.09 && estimate.habitat >= 40 && canPay(s, Object.fromEntries(RESOURCES.map(key => [key, costs[key] + cargo[key]]))),
      reason: `Surveyed ground at ${site.x}, ${site.y}: ${estimate.foodBalance} average food surplus for ${amount}; ${round(length)} travel distance; costs ${costs.food} food, ${costs.materials} materials, 2 energy plus a carried reserve.`,
      score: s.ecology.pressure >= 7 ? 8 + Math.min(7, Math.max(0, -sourceBudget.foodBalance) * 8) + estimate.foodBalance * 2 - length / 450 : -1 });
  }
  return entries;
}

function siteBudget(site, population) {
  const habitat = 30 + site.water * 55;
  const meanFood = (0.15 + (0.5 + site.soil * 0.55) * (0.4 + site.water * 0.75) * 0.9 * (0.65 + habitat * 0.0035) * bounded(population / 5, 0, 1));
  return { foodBalance: round(meanFood - population * 0.033), habitat: round(habitat) };
}

function survey(w, s, api, entries) {
  if (s.ecology.pressure < 5 || s.ecology.laborDebt > 0 || s.food < 4 || s.materials < 2) return false;
  const known = new Set(s.ecology.knownSites.map(v => v.siteId));
  const site = w.ecology.sites.filter(v => !v.settlementId && !known.has(v.id) && distance(s, v) <= 590)
    .sort((a, b) => distance(s, a) - distance(s, b))[0];
  if (!site) return false;
  const costs = { food: round(1 + distance(s, site) / 350), materials: 1, energy: 0 };
  if (!canPay(s, costs)) return false;
  const choice = { id: 'survey', label: 'Survey the nearest unvisited ground', available: true, reason: 'A walkable local landscape can be inspected; its soil and water are not known yet.', costs };
  const snapshot = context(w, s, [...entries, choice], choice.id, api, { costs, destination: { x: site.x, y: site.y } });
  pay(w, s, costs); s.ecology.laborDebt += 3;
  snapshot.evidence.after = inventory(s);
  snapshot.evidence.measured = copy(site);
  const e = trace(w, s, api, { kind: 'site-surveyed', family: 'discovery', title: `${s.name} looks beyond the roofs`,
    text: `Households from ${s.name} inspect unused ground and return with measurements. A possible home has become a known choice, not a promised one.`,
    observed: [`Surveyed coordinates: ${site.x}, ${site.y}.`, `Soil ${site.soil}; water ${site.water}; ${site.arablePlots} growing plots; ${site.buildingLots} building lots.`, `The survey used ${costs.food} food and 1 material.`] }, snapshot);
  s.ecology.knownSites.push({ siteId: site.id, eventId: e.id });
  return true;
}

function build(w, s, choice, entries, api) {
  const snapshot = context(w, s, entries, choice.id, api, { costs: choice.costs, project: choice.id });
  pay(w, s, choice.costs); s.ecology.built++;
  let kind, name;
  if (choice.id === 'cultivate') { s.ecology.plots++; kind = 'garden'; name = 'Household Growing Beds'; }
  else if (choice.id === 'irrigate') { s.ecology.waterworks++; kind = 'conduit'; name = 'Rain Catchment'; }
  else { s.housingCapacity += 8; kind = 'home'; name = 'Shared Household Rooms'; }
  s.ecology.laborDebt += 6;
  snapshot.evidence.after = inventory(s); snapshot.evidence.afterBudget = ecologyBudget(w, s);
  const event = trace(w, s, api, { kind: 'settlement-adapted', category: 'infrastructural', title: `${s.name} makes better use of its ground`,
    text: `${s.name} spends its own reserves on ${name.toLowerCase()}. The new work remains usable without another instruction.`,
    observed: [`Built ${name}.`, ...RESOURCES.map(key => `${key}: ${snapshot.evidence.before[key]} → ${s[key]}.`), `Sleeping places: ${snapshot.evidence.before.housingCapacity} → ${s.housingCapacity}.`, `Average daily food: ${snapshot.evidence.budget.meanFood} → ${snapshot.evidence.afterBudget.meanFood}.`] }, snapshot);
  api.addStructure(w, s, { id: `k-ecology-${s.ecology.siteId}-${s.ecology.built}`, name, kind, ecologyBuilt: true, x: -110 + (s.ecology.built % 4) * 65, y: 140 + Math.floor(s.ecology.built / 4) * 18, description: `Households built these ${name.toLowerCase()} using their recorded reserves. The work changes local capacity or production.` }, event);
}

function transfer(w, source, destination, choice) {
  pay(w, source, choice.costs);
  for (const key of RESOURCES) {
    if (source[key] < choice.cargo[key] || destination[key] + choice.cargo[key] > LIMITS.inventory) throw new Error('Household cargo cannot be conserved.');
    source[key] = round(source[key] - choice.cargo[key]); destination[key] = round(destination[key] + choice.cargo[key]);
  }
  source.population -= choice.amount; destination.population += choice.amount;
  source.ecology.departures += choice.amount; destination.ecology.arrivals += choice.amount;
  source.ecology.laborDebt += 5; destination.ecology.laborDebt += 8;
  source.ecology.pressure = Math.max(0, source.ecology.pressure - 6);
}

function move(w, s, choice, entries, api) {
  const destination = w.settlements.find(v => v.id === choice.destinationId);
  const reoccupying = destination.population === 0;
  const snapshot = context(w, s, entries, choice.id, api, { destinationBefore: inventory(destination), costs: choice.costs, cargo: choice.cargo, amount: choice.amount, routes: choice.routes });
  transfer(w, s, destination, choice);
  snapshot.evidence.after = inventory(s); snapshot.evidence.destinationAfter = inventory(destination); snapshot.evidence.populationDelta = 0;
  const event = trace(w, s, api, { kind: 'households-migrated', title: `Households move from ${s.name} to ${destination.name}`,
    text: `${choice.amount} existing residents leave ${s.name} for available homes and growing ground at ${destination.name}. They carry their own food along the recorded open route. The familiar people you follow have stayed in their homes.`,
    entities: [s.id, destination.id, ...choice.routes],
    causes: [...new Set([s.ecology.pressureEventId, s.ecology.lastDecisionId, destination.ecology.lastDecisionId,
      ...w.routes.filter(r => choice.routes.includes(r.id)).map(r => r.history.at(-1))].filter(Boolean))],
    observed: [`${s.name} population: ${snapshot.evidence.before.population} → ${s.population}.`, `${destination.name} population: ${snapshot.evidence.destinationBefore.population} → ${destination.population}.`, `The journey consumed ${choice.costs.food} food and ${choice.costs.materials} materials; ${choice.cargo.food} food moved with the households.`, ...(reoccupying ? [`All ${destination.housingCapacity} sleeping places and ${destination.ecology.plots} growing plots were repaired using ${choice.costs.materials} materials.`] : []), 'Total population is unchanged.'] }, snapshot);
  destination.ecology.lastDecisionId = event.id;
  for (const route of w.routes.filter(r => choice.routes.includes(r.id))) route.history.push(event.id);
  if (reoccupying) {
    for (const kind of ['home', 'garden']) {
      const buildings = destination.structures.filter(b => b.kind === kind || b.formerKind === kind);
      if (buildings.length) {
        for (const building of buildings) {
          building.kind = kind; delete building.abandonedAt; building.restoredAt = w.tick;
          building.restoredByEventId = event.id; event.entities.push(building.id);
        }
      } else {
        api.addStructure(w, destination, { id: `k-${destination.ecology.siteId}-reoccupied-${kind}`, name: kind === 'home' ? 'Reopened Household Rooms' : 'Reopened Growing Beds', kind, ecologyBuilt: true, x: kind === 'home' ? -25 : 40, y: 35, description: 'Returning households made this ground usable again with carried repair supplies.' }, event);
      }
    }
  }
  abandonEmptySource(w, s, api, event);
}

function abandonEmptySource(w, s, api, event) {
  if (s.population === 0) {
    for (const building of s.structures.filter(b => !b.form && ['home', 'garden', 'workshop', 'archive'].includes(b.kind))) {
      building.formerKind = building.kind; building.kind = 'ruin'; building.abandonedAt = w.tick;
      building.abandonedByEventId = event.id; event.entities.push(building.id);
    }
    event.observed.push('The emptied organic homes and work sites remain as abandoned structures.');
  }
  if (s.population === 0 && s.ecology.pressureEventId) {
    api.resolveThread?.(w, `t-provision-${s.ecology.siteId}-${s.ecology.pressureEpisode}`, event, 'All households moved to viable homes. Their former buildings and the route remain.');
    s.ecology.pressureEventId = null; s.ecology.pressure = 0;
  }
}

function found(w, s, choice, entries, api) {
  const site = w.ecology.sites.find(v => v.id === choice.siteId);
  const nearestRegion = [...w.regions].sort((a, b) => distance(a, site) - distance(b, site))[0];
  const snapshot = context(w, s, entries, choice.id, api, { costs: choice.costs, cargo: choice.cargo, amount: choice.amount, surveyEventId: choice.surveyEventId, site: copy(site), populationDelta: 0 });
  const destination = { id: `s-grown-${site.id}`, entityType: 'settlement', name: `Newstead ${w.settlements.length - 3}`, regionId: nearestRegion.id,
    x: site.x, y: site.y, habitat: siteBudget(site, choice.amount).habitat, food: 0, materials: 0, energy: 0, population: 0,
    synthetics: 0, collective: 0, knowledge: s.knowledge, cultureId: s.cultureId, institutionId: null, housingCapacity: 8, structures: [], foundedAt: w.tick };
  attach(destination, site); destination.ecology.knownSites = copy(s.ecology.knownSites);
  w.settlements.push(destination);
  transfer(w, s, destination, choice);
  const newRoute = { id: `r-grown-${site.id}`, entityType: 'route', name: `${s.name}–${destination.name} path`, from: s.id, to: destination.id, open: true, passable: true, terrain: 'A surveyed walking path cleared while the households established their home.', history: [] };
  w.routes.push(newRoute);
  const culture = w.cultures.find(v => v.id === s.cultureId);
  if (culture && !culture.settlementIds.includes(destination.id)) culture.settlementIds.push(destination.id);
  snapshot.evidence.after = inventory(s); snapshot.evidence.destinationAfter = inventory(destination);
  const event = trace(w, s, api, { kind: 'settlement-founded', title: `A new home takes root beyond ${s.name}`,
    text: `${choice.amount} residents of ${s.name} carry supplies to surveyed ground. They build ${destination.name}, prepare its first growing plot, and clear a walking path back. This place now faces the same needs and choices as every other household.`,
    entities: [s.id, destination.id, newRoute.id], causes: [...new Set([s.ecology.pressureEventId, s.ecology.lastDecisionId, choice.surveyEventId].filter(Boolean))],
    observed: [`${s.name} population: ${snapshot.evidence.before.population} → ${s.population}; ${destination.name}: 0 → ${destination.population}.`, `Building and travel consumed ${choice.costs.food} food, ${choice.costs.materials} materials, and 2 energy.`, 'Carried reserves: 10 food, 6 materials, 4 energy.', 'A home with eight sleeping places, a growing plot, and a route now exist.', 'No residents were created by the move.'] }, snapshot);
  destination.ecology.lastDecisionId = event.id; destination.eventId = event.id; newRoute.history.push(event.id);
  for (const [suffix, kind, name, x, y] of [['home', 'home', 'First Shared Rooms', -30, 20], ['garden', 'garden', 'First Growing Plot', 50, 40]]) {
    api.addStructure(w, destination, { id: `k-${site.id}-${suffix}`, kind, name, ecologyBuilt: true, x, y, description: `Built by the founding households using supplies carried from ${s.name}.` }, event);
  }
  abandonEmptySource(w, s, api, event);
}

function births(w, s, api) {
  const b = ecologyBudget(w, s);
  // This is household population, not generated focal biographies. A birth needs
  // sustained nourishment, a spare sleeping place, and production for the child.
  const feasible = s.population >= 5 && b.housingSlack > 0 && b.foodBalance >= 0.12 && b.reserveDays >= 26 && s.ecology.nourishment >= 12 && s.ecology.laborDebt === 0;
  s.ecology.birthProgress = round(Math.max(0, s.ecology.birthProgress + (feasible ? s.population * 0.0007 : -0.006)));
  if (!feasible || s.ecology.birthProgress < 1 || s.food < 3) return;
  const costs = { food: 3, materials: 0, energy: 0 }, before = inventory(s);
  pay(w, s, costs); s.population++; s.ecology.birthProgress -= 1; s.ecology.births++; w.ecology.births++;
  trace(w, s, api, { kind: 'household-birth', family: 'relationships', severity: 1, title: `A first morning at ${s.name}`,
    text: `A child is born among the households at ${s.name}. A spare sleeping place and sustained food production support the larger household.`,
    observed: [`Organic population: ${before.population} → ${s.population}.`, 'Household food reserve spent on care: 3.', `Average daily food surplus before the birth: ${b.foodBalance}.`],
    evidence: { rule: 'supported-household-birth', before, after: inventory(s), budget: copy(b), costs, populationDelta: 1 } });
}

export function evolveEcology(w, api) {
  if (!w.ecology) throw new Error('The ecological survey must precede household decisions.');
  // Everyone's harvest is measured before anyone considers a destination. Newly
  // founded homes enter the same loop next day, without receiving a second yield.
  const established = [...w.settlements];
  for (const s of established) resourceFlows(w, s);
  for (const s of established) {
    updatePressure(w, s, api);
    if (!s.population) continue;
    if (s.ecology.laborDebt === 0) {
      const entries = alternatives(w, s);
      const chosen = entries.filter(a => a.available).reduce((best, a) => a.score > best.score ? a : best, entries[0]);
      if (chosen.score > 0 && (s.ecology.pressure >= 7 || chosen.id === 'house')) {
        if (chosen.action === 'migrate') move(w, s, chosen, entries, api);
        else if (chosen.action === 'found') found(w, s, chosen, entries, api);
        else build(w, s, chosen, entries, api);
      } else if (chosen.score <= 0 && s.ecology.pressure >= 7) survey(w, s, api, entries);
    }
    births(w, s, api);
  }
}
