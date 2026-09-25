import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { buildCourtyardThreeScene, NeighborhoodThreeView, validateCourtyardThreeAssets } from '../src/view/neighborhood-three-view.js';
import { defaultNeighborhood, reduceNeighborhood, channelFlow } from '../src/neighborhood.js';
import { resolveStyleColor } from '../src/customization.js';

const assets = JSON.parse(readFileSync(new URL('../public/assets/courtyard-three.json', import.meta.url), 'utf8'));
const freeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

// This exercises the actual Three.js geometry and state projection under Node;
// it does not pretend to test WebGL shaders, raster quality or phone performance.
function headlessView() {
  const view = Object.create(NeighborhoodThreeView.prototype);
  view.model = buildCourtyardThreeScene(assets); view.scene = view.model.scene;
  view.state = { neighborhood: defaultNeighborhood(), mode: 'welcome', waterRunning: false, historical: false, reducedMotion: true };
  view.controls = {}; view.renderer = { shadowMap: {} }; view.visible = false; view.destroyed = false; view.frameId = null; view.hasState = false; view.fetchStart = null;
  view.resetCamera = () => {}; view._updatePetLabel = () => {};
  return view;
}

test('the JSON builds reusable geometry within the static draw-call budget', () => {
  const before = JSON.stringify(assets), model = buildCourtyardThreeScene(freeze(assets));
  let instances = 0;
  model.scene.traverse(object => { if (object.isInstancedMesh) { instances += object.count; for (const value of object.instanceMatrix.array) assert.ok(Number.isFinite(value)); } });
  assert.ok(instances > 1000, 'foliage, tiles and house details come from reusable asset nodes');
  assert.ok(model.staticBatches <= 64, 'static details must remain batched');
  assert.equal(model.tiles.length, 9); assert.equal(JSON.stringify(assets), before); model.dispose();
});

test('unsupported, circular and excessive geometry assets fail before WebGL allocation', () => {
  assert.throws(() => validateCourtyardThreeAssets({}), /format/);
  const circular = structuredClone(assets); circular.models.house = { model: 'house' };
  assert.throws(() => validateCourtyardThreeAssets(circular), /circular/);
  const unknown = structuredClone(assets); unknown.placements.push({ model: 'missing' });
  assert.throws(() => validateCourtyardThreeAssets(unknown), /Unknown/);
  const massive = structuredClone(assets); massive.models.house = { primitive: 'ico', material: 'stone', args: [1, 15] };
  assert.throws(() => validateCourtyardThreeAssets(massive), /geometry budget/);
  const nonfinite = structuredClone(assets); nonfinite.placements[0].position[1] = Infinity;
  assert.throws(() => validateCourtyardThreeAssets(nonfinite), /position/);
  const exponential = structuredClone(assets); exponential.models['budget-base'] = { primitive: 'box', material: 'grass' };
  for (let level = 1; level <= 3; level++) exponential.models[`budget-${level}`] = { children: Array.from({ length: 400 }, () => ({ model: level === 1 ? 'budget-base' : `budget-${level - 1}` })) };
  exponential.placements = [{ model: 'budget-3' }];
  assert.throws(() => validateCourtyardThreeAssets(exponential), /instance budget/);
});

test('restored-world channel projection and appearance changes preserve frozen saved choices', () => {
  const view = headlessView();
  let neighborhood = reduceNeighborhood(defaultNeighborhood(), { type: 'place', slotId: 'porch-right', itemId: 'bench' });
  neighborhood = reduceNeighborhood(neighborhood, { type: 'pet-color', color: 'plum' });
  const personalization = freeze({ version: 1, people: {}, homes: { 'k-hearth-table': { color: 'jade', decoration: 'none' } } });
  const before = JSON.stringify({ neighborhood, personalization });
  view.setState({ neighborhood, personalization, mode: 'water', waterRunning: true });
  const renderedTurns = view.model.tiles.map(tile => (Math.round(-tile.channels.rotation.y / (Math.PI / 2)) + 4) % 4);
  assert.equal(channelFlow(renderedTurns).connected, true);
  assert.equal(channelFlow(neighborhood.channelTurns).connected, false);
  assert.equal(view.model.pond.visible, true);
  assert.equal(view.model.kit.material('trim').color.getHexString(), resolveStyleColor('jade').coat.slice(1));
  assert.equal(JSON.stringify({ neighborhood, personalization }), before);
  view.setState({ waterRunning: false }); assert.equal(view.model.pond.visible, false);
  assert.deepEqual(view.model.tiles.map(tile => (Math.round(-tile.channels.rotation.y / (Math.PI / 2)) + 4) % 4), neighborhood.channelTurns);
  view.model.dispose();
});

test('loading a saved companion stays still; new visible throws animate without changing metadata', () => {
  const view = headlessView();
  const loaded = reduceNeighborhood(defaultNeighborhood(), { type: 'toss', x: .2, y: .5 });
  view.setState({ neighborhood: loaded, mode: 'companion', reducedMotion: false });
  assert.equal(view.fetchStart, null);
  view.visible = true; view.setState({ neighborhood: loaded }); assert.equal(view.fetchStart, null);
  const played = reduceNeighborhood(loaded, { type: 'toss', x: .8, y: .8 }), before = JSON.stringify(played);
  view.setState({ neighborhood: played }); assert.notEqual(view.fetchStart, null);
  const start = view.fetchStart; for (const elapsed of [0, 250, 980, 1550, 2300, 3000]) view._animate(start + elapsed);
  assert.equal(JSON.stringify(played), before); assert.equal(played.companion.tosses, 2);
  assert.deepEqual(view.model.pet.position.toArray(), assets.companion.home);
  view.model.dispose();
});

test('raycasts distinguish all nine tiles and GPU-independent resources dispose once', () => {
  const model = buildCourtyardThreeScene(assets), candidates = model.picks.filter(item => item.userData.modes.includes('water'));
  model.scene.updateMatrixWorld(true);
  for (const [index, tile] of model.tiles.entries()) {
    const ray = new THREE.Raycaster(tile.center.clone().add(new THREE.Vector3(0, 5, 0)), new THREE.Vector3(0, -1, 0));
    assert.equal(ray.intersectObjects(candidates, false)[0].object.userData.action.index, index);
  }
  const geometry = model.kit.geometry('sphere'); const material = model.kit.material('petCoat'); let geometryDisposals = 0, materialDisposals = 0;
  geometry.addEventListener('dispose', () => geometryDisposals++); material.addEventListener('dispose', () => materialDisposals++);
  model.dispose(); model.dispose();
  assert.equal(geometryDisposals, 1); assert.equal(materialDisposals, 1);
});

function drawableView(onError) {
  const view = headlessView();
  view.canvas = { dataset: {} }; view.onError = onError;
  view.failed = false; view.hasRendered = false; view.frameCosts = []; view.dpr = 1.25;
  view.controls = { update() {}, enabled: true }; view.resize = () => {};
  view.renderer = {
    shadowMap: {}, info: { render: { calls: 12, triangles: 240 } },
    getContext: () => ({ isContextLost: () => false, drawingBufferWidth: 390, drawingBufferHeight: 320, readPixels: (_x, _y, _w, _h, _format, _type, pixels) => pixels.set([36, 62, 48, 255]) }), render() {},
  };
  return view;
}

test('first visible frame failure reports once and stops without waiting for an animation frame', async () => {
  const failures = [], view = drawableView(error => failures.push(error.message));
  const savedBefore = JSON.stringify(view.state.neighborhood); let attempts = 0;
  view.renderer.render = () => { attempts++; throw new Error('GPU draw failed'); };
  view.setVisible(true);
  assert.equal(attempts, 1, 'show must attempt an actual frame immediately');
  assert.equal(view.hasRendered, false); assert.equal(view.canvas.dataset.renderStatus, 'failed');
  assert.equal(view.controls.enabled, false); assert.equal(view.frameId, null);
  view._frame(40); view._fail(new Error('Duplicate failure'));
  await Promise.resolve();
  assert.deepEqual(failures, ['GPU draw failed']); assert.equal(attempts, 1);
  assert.equal(JSON.stringify(view.state.neighborhood), savedBefore); view.model.dispose();
});

test('losing the context after a good frame triggers recovery instead of leaving 3D selected', async () => {
  const failures = [], view = drawableView(error => failures.push(error.message));
  view.setVisible(true); assert.equal(view.hasRendered, true);
  assert.equal(view.canvas.dataset.renderStatus, 'ready');
  let prevented = false;
  view._contextLost({ preventDefault() { prevented = true; } });
  await Promise.resolve();
  assert.equal(prevented, true); assert.equal(view.failed, true);
  assert.equal(view.canvas.dataset.renderStatus, 'failed'); assert.equal(failures.length, 1);
  assert.match(failures[0], /graphics context/); view.model.dispose();
});

test('silent shader and empty-frame failures cannot report a ready 3D scene', async () => {
  for (const kind of ['shader', 'empty', 'lost', 'black', 'white']) {
    const failures = [], view = drawableView(error => failures.push(error.message));
    if (kind === 'shader') view.shaderError = new Error('Materials failed');
    if (kind === 'empty') view.renderer.info.render.calls = 0;
    if (kind === 'lost') view.renderer.getContext = () => ({ isContextLost: () => true });
    if (kind === 'black' || kind === 'white') {
      const context = view.renderer.getContext();
      context.readPixels = (_x, _y, _w, _h, _format, _type, pixels) => pixels.fill(kind === 'black' ? 0 : 255);
      view.renderer.getContext = () => context;
    }
    view.setVisible(true); await Promise.resolve();
    assert.equal(view.hasRendered, false, kind); assert.equal(failures.length, 1, kind);
    assert.equal(view.canvas.dataset.renderStatus, 'failed', kind); view.model.dispose();
  }
});

test('hidden and repeated resize notifications do not allocate desktop buffers on a phone', t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'devicePixelRatio');
  Object.defineProperty(globalThis, 'devicePixelRatio', { value: 3, configurable: true });
  t.after(() => descriptor ? Object.defineProperty(globalThis, 'devicePixelRatio', descriptor) : delete globalThis.devicePixelRatio);
  const view = Object.create(NeighborhoodThreeView.prototype), allocations = [];
  let rect = { width: 0, height: 0 };
  Object.assign(view, { compact: true, canvas: { getBoundingClientRect: () => rect }, renderer: { setDrawingBufferSize: (...size) => allocations.push(size) }, camera: new THREE.PerspectiveCamera(), invalidate() {} });
  view.resize(); view.resize();
  rect = { width: 390, height: 320 }; view.resize(); view.resize();
  assert.deepEqual(allocations, [[1, 1, 1.25], [390, 320, 1.25]]);
  assert.equal(view.camera.aspect, 390 / 320);
});
