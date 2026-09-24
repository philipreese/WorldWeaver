/**
 * Descriptive, observation-only audit. The metric definitions were fixed before
 * changing the engine in response to the long-run review. This is not a pass/fail
 * test, and raw sequence diversity is not evidence of an interesting simulation.
 *
 * node scripts/long-run-audit.mjs --module /path/to/immutable/src/sim/world.js \
 *   --label <commit-or-engine> --out evidence/long-run-baseline.json
 * Optional: --engine-version <value> forwards that createWorld option.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i];
  if (!['--module', '--label', '--out', '--engine-version'].includes(key) || !process.argv[i + 1]) {
    throw new Error('Expected --module PATH, --label TEXT, --out PATH, or --engine-version VALUE.');
  }
  options[key.slice(2)] = process.argv[i + 1];
}
const modulePath = resolve(options.module || 'src/sim/world.js');
const outputPath = resolve(options.out || 'evidence/long-run-current.json');
const { createWorld, advance } = await import(pathToFileURL(modulePath));
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
async function sourceHashes(entry, result = {}) {
  const key = relative(dirname(modulePath), entry);
  if (result[key]) return result;
  const source = await readFile(entry, 'utf8');
  result[key] = hash(source);
  for (const match of source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
    await sourceHashes(resolve(dirname(entry), match[1]), result);
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}
const countBy = (values, key = value => value) => {
  const counts = {};
  for (const value of values) {
    const name = key(value);
    counts[name] = (counts[name] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
};
const excludedLateKinds = ['power-redistribution', 'settlement-growth'];
const climates = ['temperate', 'dry', 'wet'];
const fixedOptions = { tier: 2, density: 'balanced', temperament: 'careful', ...(options['engine-version'] ? { engineVersion: options['engine-version'] } : {}) };
const metricSpecification = {
  version: 1,
  frozenAgainstCommit: '845e54ae3d65782aa6bd1f02184781db994cf9b7',
  design: 'Observation only; no player intervention or state mutation. Seeds 1–20 crossed with three climates; a separate seed 8417 run reaches day 400.',
  fixedOptions: { tier: 2, density: 'balanced', temperament: 'careful' },
  sampledSeeds: Array.from({ length: 20 }, (_, i) => i + 1),
  climates,
  endDay: 300,
  lateWindow: { firstDay: 61, lastDay: 300 },
  rawEventSequence: 'Ordered event kinds including repeats and opening events; excludes tick, text, titles, numbers, names and entity IDs.',
  structuralSignature: 'Final settlements: multiset of structure kind/form/abandoned-status, present life forms, and institution statuses; exact unlabeled undirected route graph with open/passable labels. Resource quantities, dates, coordinates, names and entity IDs are excluded. Structural counts are retained.',
  decisionSignature: 'Ordered event kind, alternatives with availability, and chosen alternative. Free prose, dates and actor IDs excluded; embedded entity IDs/names and numeric tokens in alternatives replaced with type placeholders.',
  combinedSignature: 'Structural signature plus decision signature; raw event repetition is deliberately not included.',
  lateSubstantiveProxy: 'All events dated day 61–300 except the two explicitly excluded repetitive kinds; this is a broad mechanical proxy, not a judgment of narrative interest.',
  excludedLateKinds,
  topologyChanges: 'New settlement and route identities absent at creation; opening hollow-departure is already in the initial state and is not counted as a new settlement.',
  thresholds: null,
  thresholdPolicy: 'No post-hoc diversity threshold or quality pass claim. Report the measured distribution and inspect causal state changes separately.',
};

function permutations(values) {
  if (values.length < 2) return [values];
  return values.flatMap((value, i) => permutations(values.filter((_, j) => i !== j)).map(rest => [value, ...rest]));
}

function structuralSignature(world) {
  const profiles = world.settlements.map(s => ({
    forms: [s.population > 0 && 'organic', s.synthetics > 0 && 'synthetic', s.collective > 0 && 'collective'].filter(Boolean),
    structures: countBy(s.structures || [], b => `${b.kind}/${b.form || 'unspecified'}/${b.abandonedAt == null ? 'present' : 'abandoned'}`),
    institutions: countBy(world.institutions.filter(i => i.settlementId === s.id), i => i.status || 'unspecified'),
  }));
  const byProfile = new Map();
  profiles.forEach((profile, i) => {
    const key = JSON.stringify(profile);
    byProfile.set(key, [...(byProfile.get(key) || []), i]);
  });
  const sortedGroups = [...byProfile].sort(([a], [b]) => a.localeCompare(b));
  const idToIndex = new Map(world.settlements.map((s, i) => [s.id, i]));
  const routeEdges = world.routes.map(r => ({ from: idToIndex.get(r.from), to: idToIndex.get(r.to), open: !!r.open, passable: !!r.passable }));
  if (routeEdges.some(e => e.from === undefined || e.to === undefined)) throw new Error('Route points outside settlement graph.');
  let best = null;
  const search = (groupIndex, order) => {
    if (groupIndex === sortedGroups.length) {
      const position = new Map(order.map((value, i) => [value, i]));
      const edges = routeEdges.map(e => {
        const ends = [position.get(e.from), position.get(e.to)].sort((a, b) => a - b);
        return [...ends, e.open, e.passable];
      }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      const serialized = JSON.stringify(edges);
      if (best === null || serialized < best) best = serialized;
      return;
    }
    for (const p of permutations(sortedGroups[groupIndex][1])) search(groupIndex + 1, [...order, ...p]);
  };
  search(0, []);
  return { settlements: sortedGroups.flatMap(([profile, members]) => members.map(() => JSON.parse(profile))), routes: JSON.parse(best || '[]') };
}

function choiceNormalizer(world) {
  const entities = [
    ...world.settlements, ...world.characters, ...world.routes, ...world.institutions,
    ...world.cultures, ...world.regions, ...world.settlements.flatMap(s => s.structures),
    ...(world.sites || []), ...(world.power ? [world.power] : []),
  ];
  const replacements = entities.flatMap(e => [e.id, e.name].filter(Boolean).map(token => [token, `<${e.entityType || 'entity'}>`])).sort((a, b) => b[0].length - a[0].length);
  return value => {
    let normalized = String(value);
    for (const [token, replacement] of replacements) normalized = normalized.replaceAll(token, replacement);
    return normalized.replace(/\d+(?:\.\d+)?/g, '#');
  };
}

function decisionSignature(world) {
  const normalize = choiceNormalizer(world);
  return world.events.filter(e => e.decision).map(e => ({
    kind: e.kind,
    alternatives: e.decision.alternatives.map(a => ({ id: normalize(a.id), available: !!a.available })).sort((a, b) => a.id.localeCompare(b.id)),
    chosen: normalize(e.decision.chosen),
  }));
}

const signatureCatalog = { rawSequences: {}, structures: {}, decisions: {}, combined: {} };
function register(category, value) {
  const digest = hash(value);
  signatureCatalog[category][digest] ??= value;
  return digest;
}
function run(seed, climate, days, registerSignatures = true) {
  const initial = createWorld({ ...fixedOptions, seed, climate });
  const world = advance(initial, days);
  const rawSequence = world.events.map(e => e.kind);
  const structure = structuralSignature(world);
  const decisions = decisionSignature(world);
  const late = world.events.filter(e => e.tick >= 61 && e.tick <= 300);
  const substantive = late.filter(e => !excludedLateKinds.includes(e.kind));
  const newSettlements = world.settlements.filter(s => !initial.settlements.some(old => old.id === s.id));
  const newRoutes = world.routes.filter(r => !initial.routes.some(old => old.id === r.id));
  const row = {
    seed, climate, day: world.tick,
    eventCount: world.events.length,
    eventKindCounts: countBy(world.events, e => e.kind),
    lateWindow: {
      eventCount: late.length,
      eventKindCounts: countBy(late, e => e.kind),
      excludedCount: late.length - substantive.length,
      substantiveProxyCount: substantive.length,
      substantiveKinds: countBy(substantive, e => e.kind),
      substantiveEvents: substantive.map(e => ({ day: e.tick, kind: e.kind })),
    },
    finalCounts: {
      settlements: world.settlements.length,
      occupiedSettlements: world.settlements.filter(s => s.population || s.synthetics || s.collective).length,
      newSettlements: newSettlements.length,
      routes: world.routes.length,
      newRoutes: newRoutes.length,
      structures: world.settlements.reduce((n, s) => n + s.structures.length, 0),
      newNamedCharacters: world.characters.filter(c => !initial.characters.some(old => old.id === c.id)).length,
      organicPopulation: world.settlements.reduce((n, s) => n + s.population, 0),
      synthetics: world.settlements.reduce((n, s) => n + s.synthetics, 0),
      collective: world.settlements.reduce((n, s) => n + s.collective, 0),
    },
    decisions: decisions.length,
    rawSequenceHash: registerSignatures ? register('rawSequences', rawSequence) : hash(rawSequence),
    structureHash: registerSignatures ? register('structures', structure) : hash(structure),
    decisionHash: registerSignatures ? register('decisions', decisions) : hash(decisions),
    combinedHash: registerSignatures ? register('combined', { structure, decisions }) : hash({ structure, decisions }),
  };
  return { row, world, rawSequence, structure, decisions };
}

const runs = [];
for (let seed = 1; seed <= 20; seed++) for (const climate of climates) runs.push(run(seed, climate, 300).row);
const distribution = values => ({ min: Math.min(...values), max: Math.max(...values), median: [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)], mean: values.reduce((sum, n) => sum + n, 0) / values.length, histogram: countBy(values) });
const summarize = rows => ({
  runs: rows.length,
  distinctRawSequences: new Set(rows.map(r => r.rawSequenceHash)).size,
  distinctStructures: new Set(rows.map(r => r.structureHash)).size,
  distinctDecisionSequences: new Set(rows.map(r => r.decisionHash)).size,
  distinctCombinedSignatures: new Set(rows.map(r => r.combinedHash)).size,
  totalEvents: distribution(rows.map(r => r.eventCount)),
  lateSubstantiveProxy: distribution(rows.map(r => r.lateWindow.substantiveProxyCount)),
  lateSubstantiveKinds: countBy(rows.flatMap(r => r.lateWindow.substantiveEvents), e => e.kind),
  runsWithNewSettlements: rows.filter(r => r.finalCounts.newSettlements > 0).length,
  runsWithNewRoutes: rows.filter(r => r.finalCounts.newRoutes > 0).length,
  runsWithNewNamedCharacters: rows.filter(r => r.finalCounts.newNamedCharacters > 0).length,
  rawSequenceFrequencies: countBy(rows, r => r.rawSequenceHash),
  combinedFrequencies: countBy(rows, r => r.combinedHash),
});
const representative = run(8417, 'temperate', 400, false);
const evidence = {
  kind: 'Deterministic engine audit; no browser or human playtesting; no quality pass claim.',
  source: { label: options.label || 'unspecified working tree', moduleSha256: hash(await readFile(modulePath, 'utf8')), localModuleHashes: await sourceHashes(modulePath), reportedWorldVersion: representative.world.version, engineVersionOption: options['engine-version'] || null },
  metricSpecification,
  summary: summarize(runs),
  byClimate: Object.fromEntries(climates.map(c => [c, summarize(runs.filter(r => r.climate === c))])),
  representative8417: {
    ...representative.row,
    timeline: representative.world.events.map(e => ({ day: e.tick, kind: e.kind, title: e.title })),
    afterDay60Kinds: countBy(representative.world.events.filter(e => e.tick > 60), e => e.kind),
    finalStructure: representative.structure,
    normalizedDecisions: representative.decisions,
  },
  runs,
  signatureCatalog,
  limitations: [
    'Twenty consecutive small integer seeds are a fixed sample, not independent ecological starting conditions; an engine can map several seeds to the same effective initial state.',
    'Sequence differences may only reflect ordering or repetition. Distinct hashes alone do not establish emergence or replay value.',
    'State-based rules still use an authored event vocabulary. A generic event kind is not itself evidence that actors, targets and outcomes were selected from state.',
    'The late substantive proxy excludes settlement-growth even when that event builds housing and represents aggregate births; those events remain visible in the full counts.',
    'This audit does not determine whether players find the world engaging, understandable, educational or surprising.',
  ],
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ output: outputPath, source: evidence.source, summary: evidence.summary, byClimate: evidence.byClimate, representative8417: { eventCount: representative.row.eventCount, afterDay60Kinds: evidence.representative8417.afterDay60Kinds } }, null, 2));
