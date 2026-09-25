/**
 * Additional descriptive questions requested after freezing the primary audit:
 * what changes during days 200–300, and can a populated place stay out of food?
 * This does not alter the primary audit metrics or introduce a pass threshold.
 *
 * node scripts/long-run-supplement.mjs --engine-version 2.0.0 \
 *   --label engine-2.0.0-candidate --out evidence/long-run-supplement.json
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
const outputPath = resolve(options.out || 'evidence/long-run-supplement.json');
const { createWorld, advance } = await import(pathToFileURL(modulePath));
async function sourceHashes(entry, result = {}) {
  const key = relative(dirname(modulePath), entry);
  if (result[key]) return result;
  const source = await readFile(entry, 'utf8');
  result[key] = createHash('sha256').update(source).digest('hex');
  for (const match of source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
    await sourceHashes(resolve(dirname(entry), match[1]), result);
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}
const countBy = values => Object.fromEntries(Object.entries(values.reduce((counts, kind) => {
  counts[kind] = (counts[kind] || 0) + 1;
  return counts;
}, {})).sort(([a], [b]) => a.localeCompare(b)));
const physicalKinds = ['settlement-adapted', 'households-migrated', 'settlement-founded', 'household-birth'];
const nonBirthKinds = physicalKinds.filter(kind => kind !== 'household-birth');
const rows = [];
for (let seed = 1; seed <= 20; seed++) for (const climate of ['temperate', 'dry', 'wet']) {
  let world = createWorld({ tier: 2, density: 'balanced', temperament: 'careful', seed, climate,
    ...(options['engine-version'] ? { engineVersion: options['engine-version'] } : {}) });
  let zeroFoodWorldDays = 0, firstZeroFoodDay = null, longestZeroFoodStreak = 0, streak = 0;
  for (let day = 1; day <= 300; day++) {
    world = advance(world, 1);
    const hungry = world.settlements.filter(s => s.population > 0 && s.food <= 0);
    if (hungry.length) {
      zeroFoodWorldDays++; firstZeroFoodDay ??= day; streak++;
      longestZeroFoodStreak = Math.max(longestZeroFoodStreak, streak);
    } else streak = 0;
  }
  const late = world.events.filter(e => e.tick >= 61 && e.tick <= 300);
  const finalWindow = world.events.filter(e => e.tick >= 200 && e.tick <= 300);
  rows.push({
    seed, climate,
    kinds61to300: countBy(late.map(e => e.kind)),
    kinds200to300: countBy(finalWindow.map(e => e.kind)),
    physicalHouseholdOutcomes61to300: late.filter(e => physicalKinds.includes(e.kind)).length,
    physicalHouseholdOutcomes200to300: finalWindow.filter(e => physicalKinds.includes(e.kind)).length,
    nonBirthHouseholdOutcomes200to300: finalWindow.filter(e => nonBirthKinds.includes(e.kind))
      .map(e => ({ day: e.tick, kind: e.kind, project: e.evidence?.project || null })),
    founding: world.events.filter(e => e.kind === 'settlement-founded')
      .map(e => ({ day: e.tick, source: e.settlementId, destinations: world.settlements.filter(s => s.eventId === e.id).map(s => s.id) })),
    organicZeroFoodAt300: world.settlements.filter(s => s.population > 0 && s.food <= 0)
      .map(s => ({ settlementId: s.id, population: s.population, food: s.food })),
    zeroFoodWorldDays, firstZeroFoodDay, longestZeroFoodStreak,
    unmetFood: world.ecology?.unmetFood ?? null,
  });
}
const summary = {
  kinds200to300: countBy(rows.flatMap(r => Object.entries(r.kinds200to300).flatMap(([kind, n]) => Array(n).fill(kind)))),
  foundingRuns: rows.filter(r => r.founding.length).map(r => ({ seed: r.seed, climate: r.climate, founding: r.founding })),
  worldsWithOrganicZeroFoodAt300: rows.filter(r => r.organicZeroFoodAt300.length).length,
  worldsEverOrganicZeroFood: rows.filter(r => r.zeroFoodWorldDays).length,
  worldsWithoutNonBirthHouseholdOutcomes200to300: rows.filter(r => !r.nonBirthHouseholdOutcomes200to300.length).length,
  zeroFoodRuns: rows.filter(r => r.zeroFoodWorldDays),
  quietestByHouseholdOutcomes: rows.toSorted((a, b) => a.physicalHouseholdOutcomes61to300 - b.physicalHouseholdOutcomes61to300).slice(0, 6),
};
const report = {
  kind: 'Supplementary descriptive engine observations; no quality pass or human-play claim.',
  source: { label: options.label || 'unspecified working tree', engineVersionOption: options['engine-version'] || null, localModuleHashes: await sourceHashes(modulePath) },
  method: {
    relationshipToPrimaryAudit: 'Requested after the primary metric freeze. These slices are additional diagnostics; no primary metric or acceptance threshold was changed.',
    options: { tier: 2, density: 'balanced', temperament: 'careful', seeds: '1–20', climates: ['temperate', 'dry', 'wet'], observationsOnly: true },
    days: 'Advance one day at a time through day 300. Event windows include both endpoints.',
    foodShortage: 'At least one settlement with organic population >0 and food <=0 after that day’s update. Synthetic-only or collective-only occupancy does not count.',
    foodDuration: 'World-days, not settlement-days. A continuous world streak can involve different settlements.',
    physicalHouseholdOutcomeKinds: physicalKinds,
    nonBirthHouseholdOutcomeKinds: nonBirthKinds,
    exclusions: 'Non-birth household outcomes exclude synthetic replication, collective expansion, surveys, pressure/recovery notices, births and power redistribution. Their full counts remain visible; excluding them is not a claim that they have no physical effects.',
    thresholds: null,
  },
  summary, rows,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output: outputPath, worlds: rows.length,
  kinds200to300: summary.kinds200to300,
  foundingRuns: summary.foundingRuns.length,
  worldsWithOrganicZeroFoodAt300: summary.worldsWithOrganicZeroFoodAt300,
  worldsEverOrganicZeroFood: summary.worldsEverOrganicZeroFood,
  worldsWithoutNonBirthHouseholdOutcomes200to300: summary.worldsWithoutNonBirthHouseholdOutcomes200to300,
}, null, 2));
