import test from 'node:test';
import assert from 'node:assert/strict';
import { NeighborhoodView } from '../src/view/neighborhood-view.js';
import { WorldView } from '../src/view/world-view.js';
import { DECOR_SLOTS, channelFlow, defaultNeighborhood, reduceNeighborhood } from '../src/neighborhood.js';
import { createWorld } from '../src/sim/world.js';
import { resolveStyleColor } from '../src/customization.js';

// Canvas/DOM contracts only. Static raster inspection and real browser evidence
// are separate; this harness makes no device-performance or visual claims.
let nextFrame = 1;
function canvas(width = 390, height = 310) {
  const bounds = { left: 61, top: 37, width, height }, listeners = new Map();
  const gradient = { addColorStop() {} };
  const context = new Proxy({ createLinearGradient: () => gradient, createRadialGradient: () => gradient, measureText: text => ({ width: String(text).length * 7 }) }, { get: (target, key) => target[key] ?? (() => {}) });
  return { width, height, bounds, listeners, style: {}, dataset: {},
    getContext: () => context, getBoundingClientRect: () => bounds, hasAttribute: () => false, setAttribute() {},
    addEventListener: (name, listener) => listeners.set(name, listener), removeEventListener: name => listeners.delete(name) };
}
globalThis.document = { hidden: false, createElement: () => canvas(), addEventListener() {}, removeEventListener() {} };
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
globalThis.requestAnimationFrame = () => nextFrame++;
globalThis.cancelAnimationFrame = () => {};
globalThis.matchMedia = () => ({ matches: true });
globalThis.devicePixelRatio = 3;
function tap(surface, view, x, y, drag = 0) {
  const p = view.sceneToScreen(x, y), event = { pointerId: 1, pointerType: 'touch', button: 0, clientX: surface.bounds.left + p.x, clientY: surface.bounds.top + p.y };
  surface.listeners.get('pointerdown')(event);
  surface.listeners.get('pointerup')({ ...event, clientX: event.clientX + drag });
}
function setup(mode = 'welcome') {
  const selected = [], surface = canvas(), view = new NeighborhoodView(surface, { onSelect: action => selected.push(action) });
  view.setState({ neighborhood: defaultNeighborhood(), mode, reducedMotion: true }); view.drawFrame();
  return { surface, view, selected };
}

test('courtyard taps keep their correct slot through CSS offsets, capped DPR and resize', () => {
  const { surface, view, selected } = setup('decorate');
  assert.equal(view.dpr, 2);
  for (const slot of DECOR_SLOTS) tap(surface, view, slot.x, slot.y);
  assert.deepEqual(selected, DECOR_SLOTS.map(slot => ({ type: 'slot', slotId: slot.id })));
  assert.ok(view.hits.every(hit => hit.rx >= 22 && hit.ry >= 22));
  selected.length = 0; surface.bounds.width = 820; surface.bounds.height = 530; view.resize(); view.drawFrame();
  for (const slot of DECOR_SLOTS) tap(surface, view, slot.x, slot.y);
  assert.deepEqual(selected, DECOR_SLOTS.map(slot => ({ type: 'slot', slotId: slot.id })));
  tap(surface, view, DECOR_SLOTS[0].x, DECOR_SLOTS[0].y, 30);
  assert.equal(selected.length, 6, 'scrolling is not a placement'); view.destroy();
});

test('all nine spring tiles are individually tappable in a short portrait scene', () => {
  const { surface, view, selected } = setup('water');
  const targets = view.hits.filter(hit => hit.action.type === 'channel');
  assert.equal(targets.length, 9);
  assert.ok(targets.every(hit => hit.rx >= 22 && hit.ry >= 22));
  for (const target of targets) { const p = view.screenToScene(target.x, target.y); tap(surface, view, p.x, p.y); }
  assert.deepEqual(selected.map(action => action.index), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  view.setState({ historical: true }); view.drawFrame();
  const p = view.screenToScene(targets[0].x, targets[0].y); tap(surface, view, p.x, p.y);
  assert.equal(selected.length, 9, 'historical inspection cannot rotate or repair'); view.destroy();
});

test('furnishing, water and fetch projections do not mutate their saved input or advance the world', () => {
  const { view } = setup('companion'); const world = createWorld();
  let neighborhood = reduceNeighborhood(defaultNeighborhood(), { type: 'place', slotId: 'lawn-right', itemId: 'pet-bed' });
  view.setState({ world, neighborhood, mode: 'companion', reducedMotion: false });
  neighborhood = reduceNeighborhood(neighborhood, { type: 'toss', x: .2, y: .6 });
  const before = JSON.stringify({ world, neighborhood }); view.setState({ neighborhood });
  const start = view.fetchStart; assert.notEqual(start, null); for (const delta of [0, 800, 1650, 2300, 3100]) view.drawFrame(start + delta);
  view.setState({ mode: 'water', waterRunning: true, reducedMotion: true }); view.drawFrame();
  assert.equal(JSON.stringify({ world, neighborhood }), before);
  assert.equal(world.tick, 0); assert.equal(neighborhood.companion.tosses, 1); view.destroy();
});

test('loading a saved companion while hidden does not replay its previous throw', () => {
  const { view } = setup('companion'); view.setVisible(false);
  const neighborhood = reduceNeighborhood(defaultNeighborhood(), { type: 'toss', x: .8, y: .3 });
  view.setState({ neighborhood, mode: 'companion', reducedMotion: false });
  assert.equal(view.fetchStart, null); view.setVisible(true); view.drawFrame(900);
  assert.equal(view.fetchStart, null); assert.equal(neighborhood.companion.tosses, 1); view.destroy();
});

test('a restored world displays a connected installed channel without rewriting the practice board', () => {
  const { view } = setup('water'), neighborhood = defaultNeighborhood(), before = JSON.stringify(neighborhood);
  assert.equal(channelFlow(neighborhood.channelTurns).connected, false);
  view.setState({ neighborhood, waterRunning: true }); view.drawFrame();
  assert.equal(channelFlow(view._displayChannelTurns()).connected, true);
  assert.equal(JSON.stringify(neighborhood), before);
  view.setState({ waterRunning: false }); view.drawFrame();
  assert.deepEqual(view._displayChannelTurns(), neighborhood.channelTurns); view.destroy();
});

test('both canvases stop scheduling while hidden and resume when shown', () => {
  for (const View of [NeighborhoodView, WorldView]) {
    const view = new View(canvas()); assert.notEqual(view.frameId, null);
    view.setVisible(false); assert.equal(view.frameId, null); view.invalidate(); assert.equal(view.frameId, null);
    view.setVisible(true); assert.notEqual(view.frameId, null);
    document.hidden = true; view._visibility(); assert.equal(view.frameId, null); view.invalidate(); assert.equal(view.frameId, null);
    document.hidden = false; view._visibility(); assert.notEqual(view.frameId, null);
    view.destroy(); assert.equal(view.frameId, null);
  }
});

test('courtyard trim follows a customizable Hearth home and survives changing activity', () => {
  const { view } = setup(); const world = createWorld();
  assert.equal(world.settlements.flatMap(place => place.structures).find(home => home.id === 'k-hearth-table').kind, 'home');
  const personalization = { version: 1, people: {}, homes: { 'k-hearth-table': { color: 'lilac', decoration: 'none' } } };
  const before = JSON.stringify(personalization);
  view.setState({ world, personalization }); view.drawFrame();
  assert.equal(view._trimColor(), resolveStyleColor('lilac').coat);
  view.setState({ mode: 'decorate' }); view.drawFrame();
  assert.equal(view._trimColor(), resolveStyleColor('lilac').coat);
  assert.equal(JSON.stringify(personalization), before); view.destroy();
});
