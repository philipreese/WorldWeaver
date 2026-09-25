import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultNeighborhood, validateNeighborhood, reduceNeighborhood, channelFlow, channelPorts, DEFAULT_CHANNEL_TURNS, NEIGHBORHOOD_LIMITS } from '../src/neighborhood.js';

const act = (value, type, fields = {}) => reduceNeighborhood(value, { type, ...fields });

test('placing, rotating and swapping preserves furnishings and never mutates the original layout', () => {
  const empty = defaultNeighborhood();
  let arranged = act(empty, 'place', { slotId: 'porch-left', itemId: 'bench' });
  arranged = act(arranged, 'rotate', { slotId: 'porch-left' });
  arranged = act(arranged, 'place', { slotId: 'lawn-right', itemId: 'pet-bed' });
  const previous = arranged;
  arranged = act(arranged, 'move', { fromSlotId: 'porch-left', toSlotId: 'lawn-right' });
  assert.deepEqual(arranged.items['porch-left'], { itemId: 'pet-bed', rotation: 0 });
  assert.deepEqual(arranged.items['lawn-right'], { itemId: 'bench', rotation: 1 });
  assert.deepEqual(previous.items['porch-left'], { itemId: 'bench', rotation: 1 });
  arranged = act(arranged, 'move', { fromSlotId: 'lawn-right', toSlotId: 'garden-left' });
  assert.equal(Object.hasOwn(arranged.items, 'lawn-right'), false);
  assert.equal(arranged.items['garden-left'].rotation, 1);
  assert.deepEqual(act(arranged, 'move', { fromSlotId: 'garden-left', toSlotId: 'garden-left' }), arranged);
  assert.throws(() => act(arranged, 'move', { fromSlotId: 'lawn-right', toSlotId: 'porch-left' }), /Choose a furnishing/);
  assert.throws(() => act(arranged, 'rotate', { slotId: 'lawn-right' }), /Place a furnishing/);
  const removed = act(arranged, 'remove', { slotId: 'garden-left' });
  assert.deepEqual(Object.keys(removed.items), ['porch-left']);
  assert.deepEqual(empty.items, {});
  assert.throws(() => { arranged.items['garden-left'].rotation = 3; }, TypeError);
});

test('companion appearance preserves play, and only a successful throw increments the player counter', () => {
  const initial = defaultNeighborhood();
  const first = act(initial, 'toss', { x: 0.2, y: 0.85 });
  let styled = act(first, 'name', { name: 'Mochi 🦊' });
  styled = act(styled, 'pet-color', { color: 'moss' });
  styled = act(styled, 'pet-accessory', { accessory: 'flower' });
  styled = act(styled, 'visit');
  assert.deepEqual(styled.companion, { name: 'Mochi 🦊', color: 'moss', accessory: 'flower', tosses: 1, lastPlay: { id: 1, x: 0.2, y: 0.85, kind: 'fetch' } });
  assert.equal(styled.visited, true);
  assert.deepEqual(validateNeighborhood(JSON.parse(JSON.stringify(styled))), styled, 'Loading does not replay a throw or increment its count.');
  const next = act(styled, 'toss', { x: 1, y: 0 });
  assert.equal(next.companion.tosses, 2);
  assert.deepEqual(next.companion.lastPlay, { id: 2, x: 1, y: 0, kind: 'fetch' });
  assert.equal(initial.companion.tosses, 0);
  assert.equal(styled.companion.tosses, 1);
  const before = JSON.stringify(styled);
  for (const action of [{ type: 'toss', x: NaN, y: 0 }, { type: 'toss', x: 0, y: Infinity }, { type: 'toss', x: -0.01, y: 0.5 }, { type: 'toss', x: 0.5, y: 1.01 }]) {
    assert.throws(() => reduceNeighborhood(styled, action), /finite position/);
    assert.equal(JSON.stringify(styled), before);
  }
});

test('metadata validation rejects malformed or excessive candidates before producing a replacement', () => {
  const source = defaultNeighborhood();
  const before = JSON.stringify(source);
  const mutations = [
    value => { value.version = 2; },
    value => { value.habitatRestored = true; },
    value => { value.visited = 1; },
    value => { value.items['invented-slot'] = { itemId: 'bench', rotation: 0 }; },
    value => { value.items['porch-left'] = { itemId: 'castle', rotation: 0 }; },
    value => { value.items['porch-left'] = { itemId: 'bench', rotation: 4 }; },
    value => { value.items['porch-left'] = { itemId: 'bench', rotation: 0, population: 42 }; },
    value => { value.items = Array(40).fill({ itemId: 'bench', rotation: 0 }); },
    value => { value.companion.name = ''; },
    value => { value.companion.name = ' Pip'; },
    value => { value.companion.name = 'invisible\u200bname'; },
    value => { value.companion.name = 'x'.repeat(NEIGHBORHOOD_LIMITS.name + 1); },
    value => { value.companion.color = 'unknown'; },
    value => { value.companion.accessory = 'armor'; },
    value => { value.companion.tosses = 1; },
    value => { value.companion.lastPlay = { id: 1, x: 0.5, y: 0.5, kind: 'fetch' }; },
    value => { value.companion.tosses = 1; value.companion.lastPlay = { id: 1, x: NaN, y: 0.5, kind: 'fetch' }; },
    value => { value.companion.tosses = NEIGHBORHOOD_LIMITS.plays + 1; },
    value => { value.channelTurns.push(0); },
    value => { delete value.channelTurns[2]; },
    value => { value.channelTurns[4] = 0.5; },
    value => { value.channelTurns[4] = Infinity; },
    value => { Object.defineProperty(value.items, '__proto__', { value: { polluted: true }, enumerable: true }); },
  ];
  for (const mutate of mutations) {
    const candidate = structuredClone(source);
    mutate(candidate);
    assert.throws(() => validateNeighborhood(candidate));
    assert.equal(JSON.stringify(source), before);
  }
  assert.throws(() => reduceNeighborhood(source, { type: 'visit', world: {} }), /unsupported field/);
  assert.throws(() => reduceNeighborhood(source, { type: 'advance' }), /not supported/);
  assert.throws(() => reduceNeighborhood(source, { type: 'channel-turn', index: 9 }), /integer/);
  const candidate = structuredClone(source);
  const clean = validateNeighborhood(candidate);
  candidate.companion.name = 'Later edit';
  candidate.channelTurns[0] = 3;
  assert.equal(clean.companion.name, 'Pip');
  assert.equal(clean.channelTurns[0], DEFAULT_CHANNEL_TURNS[0]);
});

test('water follows reciprocal ports through two different routes and stays dry beyond an obstruction', () => {
  assert.equal(channelFlow(DEFAULT_CHANNEL_TURNS).connected, false);
  assert.deepEqual(channelFlow(DEFAULT_CHANNEL_TURNS).wetCells, [3, 6]);
  assert.deepEqual(channelFlow(DEFAULT_CHANNEL_TURNS).leaks, [{ index: 6, direction: 'w' }]);
  const upper = [1, 1, 2, 3, 0, 0, 3, 1, 3];
  const lower = [1, 0, 2, 2, 0, 1, 0, 1, 3];
  assert.deepEqual(channelFlow(upper), { connected: true, wetCells: [0, 1, 2, 3, 5], leaks: [] });
  assert.deepEqual(channelFlow(lower), { connected: true, wetCells: [3, 5, 6, 7, 8], leaks: [] });
  const blockedUpper = [...upper];
  blockedUpper[1] = 0;
  assert.deepEqual(channelFlow(blockedUpper), { connected: false, wetCells: [0, 3], leaks: [{ index: 0, direction: 'e' }] });
  const badOutlet = [...lower];
  badOutlet[5] = 0;
  assert.deepEqual(channelFlow(badOutlet), { connected: false, wetCells: [3, 6, 7, 8], leaks: [{ index: 8, direction: 'n' }] });
  assert.deepEqual(channelPorts(3, upper), ['w', 'n']);
  assert.deepEqual(channelPorts(3, lower), ['s', 'w']);
});

test('solving the channel is a reversible preview; four turns undo a rotation regardless of click count', () => {
  const source = defaultNeighborhood();
  let solved = act(source, 'channel-turn', { index: 3 });
  solved = act(solved, 'channel-turn', { index: 1 });
  assert.equal(channelFlow(solved.channelTurns).connected, true, 'Two deliberate turns solve the upper path.');
  assert.equal(solved.visited, false);
  assert.deepEqual(solved.companion, source.companion);
  assert.deepEqual(solved.items, source.items);
  let cycled = solved;
  for (let turn = 0; turn < 4; turn++) cycled = act(cycled, 'channel-turn', { index: 0 });
  assert.deepEqual(cycled, solved);
  let wrong = source;
  for (let turn = 0; turn < 100; turn++) wrong = act(wrong, 'channel-turn', { index: 4 });
  assert.equal(channelFlow(wrong.channelTurns).connected, false, 'Unrelated clicks cannot satisfy connectivity.');
  assert.equal(Object.hasOwn(solved, 'habitatRestored'), false);
});
