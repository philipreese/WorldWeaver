import test from 'node:test';
import assert from 'node:assert/strict';
import { GUIDE_STEP_IDS } from '../src/customization.js';
import { getGuideStep, getCuriosityPrompt } from '../src/guide.js';
import { createWorld, advance, intervene, getInterventions, getEntity } from '../src/sim/world.js';
import { createHistory, applyCommand, currentWorld, worldAt, forkHistory } from '../src/persistence/history.js';

const doneBefore = step => ({ version: 1, dismissed: false, completed: GUIDE_STEP_IDS.slice(0, GUIDE_STEP_IDS.indexOf(step)) });
const opening = (engineVersion = '2.0.0') => advance(createWorld({ seed: 8417, tier: 2, engineVersion }), 2);

test('an unfinished guide starts with a small optional meeting, without changing world or progress', () => {
  const world = opening();
  const guide = { version: 1, dismissed: false, completed: [] };
  const before = structuredClone({ world, guide });
  const card = getGuideStep(world);
  assert.equal(card.id, 'meet');
  assert.equal(card.action, 'inspect');
  assert.equal(card.targetId, 'c-nera');
  assert.equal(card.chapter, 'Meet the neighbors');
  assert.deepEqual(getGuideStep(world, guide), card);
  assert.deepEqual({ world, guide }, before);
});

test('six steps are presented in three chapters without inferred completion', () => {
  const world = advance(opening(), 2);
  const expected = ['Meet the neighbors', 'Meet the neighbors', 'Notice what changes', 'Notice what changes', 'Try another possibility', 'Try another possibility'];
  for (const [index, id] of GUIDE_STEP_IDS.entries()) {
    const card = getGuideStep(world, doneBefore(id));
    assert.equal(card.id, id);
    assert.equal(card.chapter, expected[index]);
  }
  assert.equal(getGuideStep(world, { completed: [...GUIDE_STEP_IDS] }), null);
  assert.equal(getGuideStep(world, { dismissed: true }), null);
  assert.equal(getGuideStep(world, { dismissed: false }).id, 'meet');
});

test('watch offers one allowed day, then the actual decision rather than claiming it was seen', () => {
  const before = opening();
  const guide = doneBefore('watch');
  const next = getGuideStep(before, guide);
  assert.equal(next.action, 'advance');
  assert.equal(next.days, 1);
  assert.equal(before.tick, 2);
  const world = advance(before, 2);
  const card = getGuideStep(world, guide);
  assert.equal(card.id, 'watch');
  assert.equal(card.action, 'event');
  assert.equal(card.label, 'See what changed');
  assert.equal(world.events.find(event => event.id === card.eventId).kind, 'seed-decision');
  assert.deepEqual(guide.completed, ['meet', 'style']);
});

test('why points at a recorded choice and cannot reveal a future decision in an old snapshot', () => {
  const world = advance(opening(), 2);
  const card = getGuideStep(world, doneBefore('why'));
  assert.equal(card.openExplanation, true);
  assert.equal(card.action, 'event');
  assert.ok(world.events.find(event => event.id === card.eventId)?.decision);
  const past = opening();
  past.events.push(world.events.find(event => event.kind === 'seed-decision'));
  const historical = getGuideStep(past, { ...doneBefore('why'), context: { historical: true } });
  assert.equal(historical.action, 'inspect');
  assert.equal(historical.readOnly, true);
  assert.equal(historical.eventId, undefined);
});

test('historical style, advancement and intervention prompts remain read-only', () => {
  const world = opening();
  for (const id of ['style', 'watch', 'possibility']) {
    const card = getGuideStep(world, { ...doneBefore(id), context: { historical: true } });
    assert.equal(card.id, id);
    assert.equal(card.action, 'inspect');
    assert.equal(card.readOnly, true);
    assert.match(card.text, /Return to present/);
    assert.ok(getEntity(world, card.targetId));
  }
});

test('possibility cards select only currently available changes and locate their dialog', () => {
  let world = opening();
  for (let index = 0; index < 3; index++) {
    const card = getGuideStep(world, doneBefore('possibility'));
    const actual = getInterventions(world).find(option => option.id === card.interventionId);
    assert.equal(card.action, 'possibilities');
    assert.equal(actual.available, true);
    assert.equal(card.targetId, actual.targetId);
    assert.ok(world.settlements.some(place => place.id === card.settlementId));
    world = intervene(world, { kind: actual.kind, targetId: actual.targetId });
  }
  const card = getGuideStep(world, doneBefore('possibility'));
  assert.equal(card.action, 'event');
  assert.ok(world.events.some(event => event.id === card.eventId));
  assert.equal(card.interventionId, undefined);
});

test('branch guidance only visits a bounded earlier day, including a full branch archive', () => {
  const world = advance(opening(), 2);
  const before = structuredClone(world);
  const card = getGuideStep(world, doneBefore('branch'));
  assert.equal(card.action, 'timeline');
  assert.equal(card.tick, 2);
  assert.equal(card.comparisonOnly, false);
  const limited = getGuideStep(world, { ...doneBefore('branch'), context: { branchLimitReached: true } });
  assert.equal(limited.action, 'timeline');
  assert.equal(limited.comparisonOnly, true);
  assert.match(limited.text, /no room for another branch/);
  const firstDay = getGuideStep(createWorld(), doneBefore('branch'));
  assert.equal(firstDay.tick, 0);
  assert.equal(firstDay.comparisonOnly, true);
  assert.deepEqual(world, before);
});

test('the suggested earlier day precedes a path opened on day one or two', () => {
  for (const openingDay of [1, 2]) {
    let history = applyCommand(createHistory({ seed: 8417, tier: 2 }), { type: 'advance', days: openingDay });
    history = applyCommand(history, { type: 'intervene', intervention: { kind: 'open-route', targetId: 'r-hearth-lattice' } });
    history = applyCommand(history, { type: 'advance', days: 4 - openingDay });
    const source = currentWorld(history);
    const card = getGuideStep(source, doneBefore('branch'));
    assert.equal(card.tick, openingDay - 1);
    assert.equal(getEntity(worldAt(history, openingDay), 'r-hearth-lattice').open, true, 'The opening day already includes the intervention.');
    assert.equal(getEntity(worldAt(history, card.tick), 'r-hearth-lattice').open, false);
    const branch = applyCommand(forkHistory(history, card.tick), { type: 'advance', days: 4 - card.tick });
    assert.equal(currentWorld(branch).flags.archiveResolved, 'raise');
    assert.equal(source.flags.archiveResolved, 'exchange');
    assert.deepEqual(currentWorld(history), source);
  }
});

test('legacy v1: curiosity prompts come from existing records and never spoil a future power', () => {
  const world = opening('1.0.0');
  const lesson = getCuriosityPrompt(world);
  assert.match(lesson.text, /bent nail/);
  assert.equal(world.events.find(event => event.id === lesson.eventId).kind, 'mending-lesson');
  const connected = intervene(world, { kind: 'open-route', targetId: 'r-hearth-lattice' });
  const path = getCuriosityPrompt(connected);
  assert.match(path.text, /newly opened path/);
  assert.equal(path.targetId, 'r-hearth-lattice');
  const future = advance(connected, 58);
  const power = getCuriosityPrompt(future);
  assert.equal(power.targetId, 'p-undersong');
  assert.ok(future.events.some(event => event.id === power.eventId));
  const pastWithFutureRecord = structuredClone(world);
  pastWithFutureRecord.events.push(future.events.find(event => event.kind === 'power-emerged'));
  pastWithFutureRecord.power = future.power;
  assert.deepEqual(getCuriosityPrompt(pastWithFutureRecord), lesson);
});

test('legacy v1: mixed-neighbor curiosity requires actual different forms at the same place', () => {
  let world = advance(intervene(opening('1.0.0'), { kind: 'open-route', targetId: 'r-hearth-lattice' }), 2);
  world = intervene(world, { kind: 'offer-refuge', targetId: 's-hearth' });
  world = advance(world, 1);
  const prompt = getCuriosityPrompt(world);
  assert.equal(prompt.text, 'Can neighbors need different things?');
  assert.equal(prompt.targetId, 's-hearth');
  assert.equal(world.events.find(event => event.id === prompt.eventId).kind, 'mixed-refuge-settled');
});


test('v2 guidance follows actual availability and recorded changes across climates and later worlds', () => {
  for (const climate of ['temperate', 'dry', 'wet']) {
    const beginning = createWorld({ tier: 2, seed: 8417, climate });
    for (const day of [0, 30, 300]) {
      const world = advance(beginning, day);
      const before = JSON.stringify(world);
      const guide = getGuideStep(world, doneBefore('possibility'));
      if (guide.action === 'possibilities') {
        const option = getInterventions(world).find(item => item.id === guide.interventionId);
        assert.ok(option?.available, `${climate}, day ${day}: only feasible help can be offered.`);
        assert.equal(option.targetId, guide.targetId);
        assert.ok(getEntity(world, guide.targetId));
      } else if (guide.action === 'event') {
        assert.ok(world.events.some(event => event.id === guide.eventId && event.tick <= world.tick));
      } else assert.ok(getEntity(world, guide.targetId));
      if (!getInterventions(world).some(item => item.kind === 'offer-refuge' && item.available)) {
        assert.notEqual(guide.interventionKind, 'offer-refuge');
      }
      const curiosity = getCuriosityPrompt(world);
      if (curiosity) {
        assert.ok(getEntity(world, curiosity.targetId));
        assert.ok(world.events.some(event => event.id === curiosity.eventId && event.tick <= world.tick));
        if (!world.power) assert.notEqual(curiosity.targetId, 'p-undersong');
      }
      assert.equal(JSON.stringify(world), before);
    }
  }
});
