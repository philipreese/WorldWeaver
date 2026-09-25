import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DECOR_SLOTS, PET_COLORS, CHANNEL_TILES, DEFAULT_CHANNEL_TURNS, channelFlow, defaultNeighborhood } from '../neighborhood.js';
import { resolveStyleColor } from '../customization.js';

const MODES = new Set(['welcome', 'decorate', 'companion', 'water']);
const PRIMITIVES = new Set(['box', 'sphere', 'ico', 'cylinder', 'cone', 'torus', 'arch', 'gable']);
const INSTALLED_TURNS = Object.freeze(DEFAULT_CHANNEL_TURNS.map((turn, i) => (turn + ([5, 6].includes(i) ? 1 : 0)) % 4));
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const smooth = value => value * value * (3 - 2 * value);
const canonicalPoint = (x, y) => new THREE.Vector3((x - 500) * .018, .09, (y - 440) * .020);
const number = (value, label, low = -200, high = 200) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high) throw new Error(`Invalid courtyard asset ${label}.`);
};
function vector(value, label, low = -200, high = 200) {
  if (!Array.isArray(value) || value.length !== 3) throw new Error(`Invalid courtyard asset ${label}.`);
  value.forEach(item => number(item, label, low, high));
}

/** The JSON is a bounded scene description, never executable code or a URL loader. */
export function validateCourtyardThreeAssets(value) {
  if (!value || value.schemaVersion !== 1 || !value.materials || !value.models || !Array.isArray(value.placements)) throw new Error('Unsupported courtyard 3D asset format.');
  if (Object.keys(value.materials).length > 100 || Object.keys(value.models).length > 100 || value.placements.length > 800) throw new Error('Courtyard 3D assets exceed the scene budget.');
  for (const [name, material] of Object.entries(value.materials)) {
    if (!/^[a-zA-Z][a-zA-Z0-9-]{0,40}$/.test(name) || !/^#[0-9a-f]{6}$/i.test(material.color)) throw new Error('Invalid courtyard material.');
    if (material.emissive && !/^#[0-9a-f]{6}$/i.test(material.emissive)) throw new Error('Invalid courtyard emissive color.');
    for (const key of ['roughness', 'metalness', 'opacity']) if (material[key] !== undefined) number(material[key], key, 0, 1);
    if (material.emissiveIntensity !== undefined) number(material.emissiveIntensity, 'emissive intensity', 0, 5);
  }
  let visitedNodes = 0;
  const modelStack = new Set(), checkedModels = new Set();
  function checkNode(node, depth = 0) {
    if (!node || typeof node !== 'object' || depth > 15 || ++visitedNodes > 7000) throw new Error('Courtyard scene groups are too large or deeply nested.');
    if ([Boolean(node.model), Boolean(node.primitive), Array.isArray(node.children)].filter(Boolean).length !== 1) throw new Error('A courtyard node must be one model, primitive or group.');
    if (node.position) vector(node.position, 'position');
    if (node.rotation) vector(node.rotation, 'rotation', -360, 360);
    if (node.scale) vector(node.scale, 'scale', .001, 200);
    if (node.name !== undefined && (typeof node.name !== 'string' || node.name.length > 80)) throw new Error('Invalid courtyard node name.');
    if (node.model) checkModel(node.model, depth + 1);
    if (node.children) { if (node.children.length > 400) throw new Error('Courtyard group exceeds its node budget.'); node.children.forEach(child => checkNode(child, depth + 1)); }
    if (node.primitive) {
      if (!PRIMITIVES.has(node.primitive) || !Object.hasOwn(value.materials, node.material)) throw new Error('Unknown courtyard primitive or material.');
      if (node.args) {
        if (!Array.isArray(node.args) || node.args.length > 5) throw new Error('Invalid primitive arguments.'); node.args.forEach(arg => number(arg, 'primitive argument', .001, 64));
        // Geometry detail grows rapidly (exponentially for an icosahedron).
        // Reject an excessive request before Three.js allocates its buffers.
        if (node.primitive === 'ico' && (node.args[1] ?? 0) > 2) throw new Error('Courtyard icosahedron exceeds its geometry budget.');
        if (node.primitive === 'sphere' && ((node.args[1] ?? 12) > 32 || (node.args[2] ?? 8) > 24)) throw new Error('Courtyard sphere exceeds its geometry budget.');
        if (node.primitive === 'cylinder' && ((node.args[3] ?? 10) > 32 || (node.args[4] ?? 1) > 4)) throw new Error('Courtyard cylinder exceeds its geometry budget.');
        if (node.primitive === 'cone' && ((node.args[2] ?? 10) > 32 || (node.args[3] ?? 1) > 4)) throw new Error('Courtyard cone exceeds its geometry budget.');
        if (node.primitive === 'torus' && ((node.args[2] ?? 6) > 16 || (node.args[3] ?? 28) > 48)) throw new Error('Courtyard torus exceeds its geometry budget.');
      }
    }
  }
  function checkModel(id, depth) {
    if (!Object.hasOwn(value.models, id) || modelStack.has(id)) throw new Error('Unknown or circular courtyard model reference.');
    if (checkedModels.has(id)) return;
    modelStack.add(id); checkNode(value.models[id], depth); modelStack.delete(id); checkedModels.add(id);
  }
  for (const id of Object.keys(value.models)) checkModel(id, 0);
  value.placements.forEach(item => checkNode(item));
  // Reused references must be cheap after expansion too. Counting each named
  // model once during validation would otherwise admit an exponential graph.
  const expandedModels = new Map(), expandedLimit = 12000;
  function expandedModel(id) { if (!expandedModels.has(id)) expandedModels.set(id, expandedNode(value.models[id])); return expandedModels.get(id); }
  function expandedNode(node) {
    let total = 1;
    if (node.model) total += expandedModel(node.model);
    else if (node.children) for (const child of node.children) { total += expandedNode(child); if (total > expandedLimit) break; }
    if (total > expandedLimit) throw new Error('Courtyard expanded scene exceeds its instance budget.');
    return total;
  }
  let expandedScene = value.placements.reduce((sum, item) => sum + expandedNode(item), 0);
  const decorCounts = ['bench', 'planter', 'lantern', 'rug', 'cushions', 'birdbath', 'pet-bed', 'wind-chime'].filter(id => value.models[id]).map(expandedModel);
  expandedScene += Math.max(0, ...decorCounts) * DECOR_SLOTS.length + (value.models.glimmerfox ? expandedModel('glimmerfox') : 0);
  if (expandedScene > expandedLimit) throw new Error('Courtyard expanded scene exceeds its instance budget.');
  for (const required of ['house', 'glimmerfox', 'bench', 'planter', 'lantern', 'rug', 'cushions', 'birdbath', 'pet-bed', 'wind-chime']) if (!value.models[required]) throw new Error(`Missing courtyard model ${required}.`);
  if (!value.terrain || !value.lighting || !value.spring || !value.companion || !value.cameras) throw new Error('Incomplete courtyard environment.');
  vector(value.terrain.center, 'ground position'); number(value.terrain.radius, 'ground radius', 1, 20); number(value.terrain.depth, 'ground depth', .01, 3); number(value.terrain.flattenZ, 'ground shape', .2, 1.5); number(value.terrain.waterLevel, 'water level', -5, 0);
  for (const token of [value.terrain.surface, value.terrain.edge]) if (!value.materials[token]) throw new Error('Unknown ground material.');
  for (const key of ['background', 'fog', 'sunColor', 'skyColor', 'groundColor']) if (!/^#[0-9a-f]{6}$/i.test(value.lighting[key])) throw new Error('Invalid courtyard lighting color.');
  for (const key of ['sunIntensity', 'hemisphereIntensity', 'exposure']) number(value.lighting[key], key, .1, 6);
  number(value.lighting.fogNear, 'fog start', 10, 80); number(value.lighting.fogFar, 'fog end', 20, 150); vector(value.lighting.sunPosition, 'sun position');
  for (const mode of MODES) { if (!value.cameras[mode]) throw new Error('Missing courtyard camera preset.'); vector(value.cameras[mode].position, 'camera position'); vector(value.cameras[mode].target, 'camera target'); }
  vector(value.spring.boardOrigin, 'spring position'); number(value.spring.tileSize, 'channel size', .4, 2); number(value.spring.tileGap, 'channel gap', 0, .2);
  for (const key of ['sourcePath', 'outletPath']) { if (!Array.isArray(value.spring[key]) || value.spring[key].length < 2 || value.spring[key].length > 12) throw new Error('Invalid spring path.'); value.spring[key].forEach(point => vector(point, 'spring path')); }
  vector(value.spring.pondCenter, 'pond position'); vector(value.spring.pondScale, 'pond scale', .01, 5); vector(value.companion.home, 'companion position'); number(value.companion.scale, 'companion scale', .3, 3);
  return value;
}

function gableGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-.5, 0, -.5, .5, 0, -.5, 0, 1, -.5, -.5, 0, .5, .5, 0, .5, 0, 1, .5], 3));
  geometry.setIndex([0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4, 0, 1, 4, 0, 4, 3]); geometry.computeVertexNormals();
  return geometry.toNonIndexed();
}

class AssetKit {
  constructor(assets) {
    this.assets = assets; this.geometries = new Map(); this.materials = new Map(); this.ownedGeometries = new Set();
    for (const [key, definition] of Object.entries(assets.materials)) this.materials.set(key, new THREE.MeshStandardMaterial({ ...definition }));
  }
  material(id) { const material = this.materials.get(id); if (!material) throw new Error(`Unknown courtyard material ${id}.`); return material; }
  own(geometry) { this.ownedGeometries.add(geometry); return geometry; }
  geometry(type, args) {
    const key = `${type}:${JSON.stringify(args || [])}`; if (this.geometries.has(key)) return this.geometries.get(key);
    let geometry;
    if (type === 'box') geometry = new THREE.BoxGeometry(...(args || [1, 1, 1]));
    else if (type === 'sphere') geometry = new THREE.SphereGeometry(...(args || [1, 12, 8]));
    else if (type === 'ico') geometry = new THREE.IcosahedronGeometry(...(args || [1, 1]));
    else if (type === 'cylinder') geometry = new THREE.CylinderGeometry(...(args || [1, 1, 1, 10]));
    else if (type === 'cone') geometry = new THREE.ConeGeometry(...(args || [1, 1, 10]));
    else if (type === 'torus') geometry = new THREE.TorusGeometry(...(args || [1, .065, 6, 28]));
    else if (type === 'arch') geometry = new THREE.TorusGeometry(1, .14, 6, 24, Math.PI);
    else if (type === 'gable') geometry = gableGeometry();
    else throw new Error('Unsupported courtyard primitive.');
    this.geometries.set(key, geometry); return this.own(geometry);
  }
  mesh(type, material, scale = [1, 1, 1], position = [0, 0, 0], args) {
    const mesh = new THREE.Mesh(this.geometry(type, args), this.material(material)); mesh.scale.fromArray(scale); mesh.position.fromArray(position);
    mesh.castShadow = !mesh.material.transparent; mesh.receiveShadow = true; return mesh;
  }
  applyTransform(object, node) {
    if (node.position) object.position.fromArray(node.position);
    if (node.rotation) object.rotation.set(...node.rotation.map(THREE.MathUtils.degToRad));
    if (node.scale) object.scale.fromArray(node.scale);
    if (node.name) object.name = node.name;
  }
  makeNode(node) {
    let object;
    if (node.primitive) object = this.mesh(node.primitive, node.material, [1, 1, 1], [0, 0, 0], node.args);
    else { object = new THREE.Group(); if (node.model) object.add(this.makeNode(this.assets.models[node.model])); else node.children.forEach(child => object.add(this.makeNode(child))); }
    this.applyTransform(object, node); return object;
  }
  model(id) { return this.makeNode(this.assets.models[id]); }
  addStatic(scene) {
    const buckets = new Map(), transform = new THREE.Object3D();
    const visit = (node, parentMatrix) => {
      transform.position.set(0, 0, 0); transform.rotation.set(0, 0, 0); transform.scale.set(1, 1, 1); this.applyTransform(transform, node); transform.updateMatrix();
      const matrix = parentMatrix.clone().multiply(transform.matrix);
      if (node.model) visit(this.assets.models[node.model], matrix);
      else if (node.children) node.children.forEach(child => visit(child, matrix));
      else {
        const key = `${node.primitive}:${JSON.stringify(node.args || [])}:${node.material}`;
        if (!buckets.has(key)) buckets.set(key, { geometry: this.geometry(node.primitive, node.args), material: this.material(node.material), matrices: [] });
        buckets.get(key).matrices.push(matrix);
      }
    };
    this.assets.placements.forEach(node => visit(node, new THREE.Matrix4()));
    for (const bucket of buckets.values()) {
      const mesh = new THREE.InstancedMesh(bucket.geometry, bucket.material, bucket.matrices.length);
      bucket.matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix)); mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = !bucket.material.transparent; mesh.receiveShadow = true; mesh.computeBoundingSphere(); scene.add(mesh);
    }
    return buckets.size;
  }
  tube(points, radius, material, segments = 18) {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    const geometry = this.own(new THREE.TubeGeometry(curve, segments, radius, 6, false));
    const mesh = new THREE.Mesh(geometry, this.material(material)); mesh.receiveShadow = true; return mesh;
  }
  dispose() { this.ownedGeometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose()); this.ownedGeometries.clear(); this.materials.clear(); this.geometries.clear(); }
}

/** Builds GPU-independent geometry so the asset budget and references can be
 * checked under Node. Only NeighborhoodThreeView creates a WebGL context. */
export function buildCourtyardThreeScene(input) {
  const assets = validateCourtyardThreeAssets(input), kit = new AssetKit(assets), scene = new THREE.Scene(), lighting = assets.lighting;
  scene.background = new THREE.Color(lighting.background); scene.fog = new THREE.Fog(lighting.fog, lighting.fogNear, lighting.fogFar);
  const terrain = assets.terrain;
  const ground = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(terrain.radius, terrain.radius * .965, terrain.depth, 64)), [kit.material(terrain.edge), kit.material(terrain.surface), kit.material(terrain.edge)]);
  ground.position.fromArray(terrain.center); ground.scale.z = terrain.flattenZ; ground.receiveShadow = true; ground.castShadow = true; scene.add(ground);
  const cliff = kit.mesh('cylinder', 'earthEdge', [8.75, .9, 6.74], [0, -.94, 0], [.97, .90, 1, 28]); cliff.receiveShadow = true; scene.add(cliff);
  const river = kit.mesh('cylinder', 'river', [95, .05, 95], [0, terrain.waterLevel, 0], [1, 1, 1, 64]); river.castShadow = false; scene.add(river);
  const staticBatches = kit.addStatic(scene);
  const hemisphere = new THREE.HemisphereLight(lighting.skyColor, lighting.groundColor, lighting.hemisphereIntensity); scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(lighting.sunColor, lighting.sunIntensity); sun.position.fromArray(lighting.sunPosition); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -13; sun.shadow.camera.right = 13; sun.shadow.camera.top = 13; sun.shadow.camera.bottom = -13; sun.shadow.camera.near = .5; sun.shadow.camera.far = 45; sun.shadow.bias = -.00045; sun.shadow.normalBias = .06; scene.add(sun);
  const porchLight = new THREE.PointLight('#ffd198', 9, 5.5, 2); porchLight.position.set(-4.1, 1.7, -1.14); scene.add(porchLight);
  const sideLight = new THREE.PointLight('#ffd498', 7, 4.5, 2); sideLight.position.set(-.88, 1.9, -3.4); scene.add(sideLight);
  const moon = kit.mesh('sphere', 'moon', [1.1, 1.1, 1.1], [-9, 15, -25]); moon.castShadow = false; scene.add(moon);

  const spring = new THREE.Group(); spring.name = 'spring'; scene.add(spring);
  const a = assets.spring, span = 3 * a.tileSize + 2 * a.tileGap;
  spring.add(kit.mesh('box', 'stoneDark', [span + .25, .22, span + .25], [a.boardOrigin[0] + span / 2, .12, a.boardOrigin[2] + span / 2]));
  const half = (a.tileSize + a.tileGap) / 2;
  const straightPoints = [[0, 0, -half], [0, 0, half]];
  const elbowPoints = [[0, 0, -half], [0, 0, -.18], [.18, 0, 0], [half, 0, 0]];
  const geometries = {};
  for (const [kind, points] of [['straight', straightPoints], ['elbow', elbowPoints]]) {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    geometries[`${kind}-channel`] = kit.own(new THREE.TubeGeometry(curve, 10, .087, 6, false));
    geometries[`${kind}-water`] = kit.own(new THREE.TubeGeometry(curve, 10, .054, 6, false));
  }
  const tiles = [];
  for (let index = 0; index < 9; index++) {
    const x = a.boardOrigin[0] + (index % 3) * (a.tileSize + a.tileGap) + a.tileSize / 2;
    const z = a.boardOrigin[2] + Math.floor(index / 3) * (a.tileSize + a.tileGap) + a.tileSize / 2;
    const slab = kit.mesh('box', index % 2 ? 'paverLight' : 'stonePale', [a.tileSize, .14, a.tileSize], [x, a.boardOrigin[1], z]); spring.add(slab);
    const channels = new THREE.Group(); channels.position.set(x, a.boardOrigin[1] + .10, z); spring.add(channels);
    const kind = CHANNEL_TILES[index].kind, pipe = new THREE.Mesh(geometries[`${kind}-channel`], kit.material('channel'));
    const water = new THREE.Mesh(geometries[`${kind}-water`], kit.material('waterLight')); water.position.y = .042; channels.add(pipe, water);
    tiles.push({ slab, channels, water, center: new THREE.Vector3(x, .40, z) });
  }
  const source = kit.tube(a.sourcePath, .105, 'waterLight'); spring.add(kit.tube(a.sourcePath, .165, 'stoneDark'), source);
  const outlet = kit.tube(a.outletPath, .12, 'water'); spring.add(kit.tube(a.outletPath, .19, 'stoneDark'), outlet);
  const pond = kit.mesh('cylinder', 'water', a.pondScale, a.pondCenter, [1, 1, 1, 48]); pond.castShadow = false; scene.add(pond);
  const basin = kit.mesh('sphere', 'stoneDark', [a.pondScale[0] + .07, .09, a.pondScale[2] + .04], [a.pondCenter[0], -.015, a.pondCenter[2]]); scene.add(basin);
  const ripples = [];
  for (let i = 0; i < 3; i++) { const ring = kit.mesh('torus', 'waterLight', [.4, .4, .4], [a.pondCenter[0], a.pondCenter[1] + .04, a.pondCenter[2]], [1, .012, 3, 28]); ring.rotation.x = -Math.PI / 2; ring.castShadow = false; scene.add(ring); ripples.push(ring); }
  const pet = kit.model('glimmerfox'); pet.position.fromArray(assets.companion.home); pet.scale.setScalar(assets.companion.scale); scene.add(pet);
  const toy = kit.mesh('sphere', 'fabricRose', [.13, .13, .13]); toy.visible = false; scene.add(toy);
  const decorations = new THREE.Group(); scene.add(decorations);
  const slotMarkers = new THREE.Group(); scene.add(slotMarkers);
  const pickGroup = new THREE.Group(); pickGroup.visible = false; scene.add(pickGroup);
  const hitMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }); kit.materials.set('__hit', hitMaterial);
  const hit = (geometry, position, scale, action, modes) => { const mesh = new THREE.Mesh(geometry, hitMaterial); mesh.position.copy(position); mesh.scale.set(...scale); mesh.userData = { action, modes }; pickGroup.add(mesh); return mesh; };
  const picks = [];
  for (const slot of DECOR_SLOTS) {
    const point = canonicalPoint(slot.x, slot.y); point.y = .07;
    const ring = new THREE.Mesh(kit.own(new THREE.RingGeometry(.53, .59, 32)), kit.material('marker')); ring.rotation.x = -Math.PI / 2; ring.position.copy(point); ring.position.y = .1; ring.name = slot.id; slotMarkers.add(ring);
    picks.push(hit(kit.geometry('cylinder'), new THREE.Vector3(point.x, .61, point.z), [.65, 1.25, .65], { type: 'slot', slotId: slot.id }, ['decorate']));
  }
  tiles.forEach((tile, index) => picks.push(hit(kit.geometry('box'), tile.center, [a.tileSize + .04, .8, a.tileSize + .04], { type: 'channel', index }, ['water'])));
  picks.push(hit(kit.geometry('box'), new THREE.Vector3(-3.4, 2.2, -3.4), [4.6, 4.4, 4.0], { type: 'house' }, ['welcome']));
  picks.push(hit(kit.geometry('box'), new THREE.Vector3(a.boardOrigin[0] + span / 2, .4, a.boardOrigin[2] + span / 2), [span, .9, span], { type: 'channel', index: 4 }, ['welcome']));
  const petPick = hit(kit.geometry('sphere'), pet.position.clone().add(new THREE.Vector3(0, .85, .2)), [.72, .94, .95], { type: 'pet' }, ['companion', 'welcome']); picks.push(petPick);
  scene.updateMatrixWorld(true);
  return { assets, scene, kit, staticBatches, sun, tiles, source, outlet, pond, ripples, pet, toy, decorations, slotMarkers, pickGroup, picks, petPick, dispose() { scene.clear(); kit.dispose(); sun.shadow.map?.dispose(); } };
}

/** A disposable 3D projection of exactly the same saved courtyard choices.
 * Protected invariant: camera/rendering/animation never advance world time,
 * repair habitat, increment play counts, or write any save metadata. */
export class NeighborhoodThreeView {
  constructor(canvas, { onSelect = () => {}, assets } = {}) {
    validateCourtyardThreeAssets(assets);
    this.canvas = canvas; this.onSelect = onSelect; this.listeners = []; this.visible = true; this.destroyed = false; this.frameId = null; this.dirty = true; this.lastFrame = 0; this.hasState = false; this.fetchStart = null; this.fetchTarget = null; this.down = new Map(); this.dragged = false; this.textures = new Set(); this.labelMaterials = new Set(); this.frameCosts = [];
    this.state = { world: null, neighborhood: defaultNeighborhood(), mode: 'welcome', historical: false, waterRunning: false, reducedMotion: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false };
    // Requesting WebGL on a canvas already bound to 2D must fail here, allowing
    // the caller to replace it with a fresh canvas before choosing a fallback.
    try { this.renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: true, powerPreference: 'low-power' }); }
    catch (error) { throw new Error('The 3D courtyard could not start WebGL 2. The illustrated courtyard is still available.', { cause: error }); }
    try {
      this.model = buildCourtyardThreeScene(assets); this.scene = this.model.scene; this.camera = new THREE.PerspectiveCamera(41, 1, .1, 120); this.camera.name = 'courtyard-camera';
      this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = assets.lighting.exposure;
      this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.shadowMap.autoUpdate = false; this.renderer.shadowMap.needsUpdate = true;
      this.controls = new OrbitControls(this.camera, canvas); this.controls.enableDamping = !this.state.reducedMotion; this.controls.dampingFactor = .12; this.controls.enablePan = false; this.controls.minDistance = 4; this.controls.maxDistance = 42; this.controls.minPolarAngle = .22; this.controls.maxPolarAngle = Math.PI * .44; this.controls.rotateSpeed = .68; this.controls.zoomSpeed = .85;
      this.controls.addEventListener('change', () => this.invalidate());
      this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2(); this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.08);
      this._bind('pointerdown', event => this._pointerDown(event)); this._bind('pointermove', event => this._pointerMove(event)); this._bind('pointerup', event => this._pointerUp(event)); this._bind('pointercancel', event => { this.down.delete(event.pointerId); this.dragged = true; });
      this._bind('webglcontextlost', event => { event.preventDefault(); this.contextLost = true; this._stop(); canvas.dataset.renderStatus = 'context-lost'; });
      this._bind('webglcontextrestored', () => { this.contextLost = false; canvas.dataset.renderStatus = 'ready'; this.invalidate(); });
      canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Three-dimensional Hearth courtyard. Drag to orbit and pinch to zoom. Courtyard activities have matching buttons beside the scene.');
      this._resize = () => this.resize(); this.resizeObserver = globalThis.ResizeObserver ? new ResizeObserver(this._resize) : null; this.resizeObserver?.observe(canvas); if (!this.resizeObserver) globalThis.addEventListener?.('resize', this._resize);
      this._visibility = () => { if (globalThis.document?.hidden) this._stop(); else this.invalidate(); }; globalThis.document?.addEventListener('visibilitychange', this._visibility);
      this._createLabels(); this.resize(); this.resetCamera(); this._applyState();
    } catch (error) { this.destroy(); throw new Error('The 3D courtyard assets could not be prepared. The illustrated courtyard is still available.', { cause: error }); }
  }
  _bind(name, listener) { this.canvas.addEventListener(name, listener); this.listeners.push([name, listener]); }
  setState(next = {}) {
    const before = this.state, incoming = next.neighborhood?.companion?.lastPlay, prior = before.neighborhood?.companion?.lastPlay;
    const mode = MODES.has(next.mode) ? next.mode : before.mode;
    if (this.hasState && this.visible && mode === 'companion' && !(next.historical ?? before.historical) && incoming && incoming.id !== prior?.id) {
      this.fetchStart = globalThis.performance?.now?.() || 0; this.fetchTarget = canonicalPoint(470 + incoming.x * 320, 477 + incoming.y * 169);
    }
    this.state = { ...before, ...next, mode }; this.hasState = true;
    if (this.state.historical || this.state.reducedMotion) this.fetchStart = null;
    this.controls.enableDamping = !this.state.reducedMotion;
    this._applyState(); if (mode !== before.mode) this.resetCamera(); this.invalidate();
  }
  _applyState() {
    const n = this.state.neighborhood || defaultNeighborhood(), model = this.model;
    const color = PET_COLORS.find(item => item.id === n.companion.color) || PET_COLORS[0];
    for (const [material, token] of [['petCoat', 'coat'], ['petShade', 'shade'], ['petAccent', 'accent']]) model.kit.material(material).color.set(color[token]);
    model.kit.material('trim').color.set(resolveStyleColor(this.state.personalization?.homes?.['k-hearth-table']?.color)?.coat || model.assets.materials.trim.color);
    for (const name of ['scarf', 'bow', 'flower']) { const part = model.pet.getObjectByName(`pet-${name}`); if (part) part.visible = n.companion.accessory === name; }
    const itemKey = JSON.stringify(n.items);
    if (itemKey !== this.itemKey) {
      model.decorations.clear();
      for (const slot of DECOR_SLOTS) if (n.items[slot.id]) { const item = n.items[slot.id], group = model.kit.model(item.itemId); group.position.copy(canonicalPoint(slot.x, slot.y)); group.rotation.y = -item.rotation * Math.PI / 2; model.decorations.add(group); }
      this.itemKey = itemKey;
    }
    model.slotMarkers.visible = this.state.mode === 'decorate';
    model.slotMarkers.children.forEach(marker => { if (!marker.isSprite) marker.scale.setScalar(marker.name === this.state.selectedSlotId ? 1.16 : 1); });
    const turns = this.state.waterRunning && !channelFlow(n.channelTurns).connected ? INSTALLED_TURNS : n.channelTurns;
    const flow = channelFlow(turns), wet = new Set(flow.wetCells);
    model.tiles.forEach((tile, index) => { tile.channels.rotation.y = -turns[index] * Math.PI / 2; tile.water.visible = wet.has(index); });
    model.source.visible = true; model.outlet.visible = Boolean(this.state.waterRunning); model.pond.visible = Boolean(this.state.waterRunning); model.ripples.forEach(ring => { ring.visible = Boolean(this.state.waterRunning); });
    if (n.companion.name !== this.petName) { this._updatePetLabel(n.companion.name); this.petName = n.companion.name; }
    this._animate(0, true); this.scene.updateMatrixWorld(true); this.renderer.shadowMap.needsUpdate = true;
  }
  _label(text, scale) {
    const surface = globalThis.document?.createElement?.('canvas'); if (!surface?.getContext) return null;
    surface.width = 256; surface.height = 80; const context = surface.getContext('2d'); if (!context?.fillText) return null;
    context.font = '600 32px system-ui, sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.beginPath(); context.roundRect(7, 9, 242, 61, 28); context.fillStyle = '#254b45dd'; context.fill(); context.strokeStyle = '#ded4a47a'; context.lineWidth = 2; context.stroke(); context.fillStyle = '#fff0ce'; context.fillText(text, 128, 41, 225);
    const texture = new THREE.CanvasTexture(surface); texture.colorSpace = THREE.SRGBColorSpace; this.textures.add(texture);
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }); this.labelMaterials.add(material);
    const sprite = new THREE.Sprite(material); sprite.scale.set(scale, scale * .3125, 1); sprite.renderOrder = 5; return sprite;
  }
  _createLabels() {
    for (let index = 0; index < DECOR_SLOTS.length; index++) { const slot = DECOR_SLOTS[index], sprite = this._label(String(index + 1), .55); if (!sprite) continue; sprite.position.copy(canonicalPoint(slot.x, slot.y)); sprite.position.y = .29; this.model.slotMarkers.add(sprite); }
  }
  _updatePetLabel(name) {
    if (this.petLabel) { const material = this.petLabel.material; this.scene.remove(this.petLabel); this.textures.delete(material.map); material.map?.dispose(); this.labelMaterials.delete(material); material.dispose(); }
    this.petLabel = this._label(name, Math.min(2.8, Math.max(1.02, .16 * name.length + .54))); if (this.petLabel) this.scene.add(this.petLabel);
  }
  resize() {
    if (this.destroyed || !this.renderer) return;
    const rect = this.canvas.getBoundingClientRect(); this.width = Math.max(1, rect.width || this.canvas.clientWidth || 900); this.height = Math.max(1, rect.height || this.canvas.clientHeight || 600);
    this.dpr = Math.min(1.75, Math.max(1, globalThis.devicePixelRatio || 1)); this.renderer.setPixelRatio(this.dpr); this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height; this.camera.updateProjectionMatrix(); this.invalidate();
  }
  resetCamera() {
    const preset = this.model.assets.cameras[this.state.mode] || this.model.assets.cameras.welcome;
    this.camera.position.fromArray(preset.position); this.controls.target.fromArray(preset.target);
    // Narrow displays get a little room around the same diorama rather than
    // cutting off the home. Activity cameras stay close enough for the task.
    if (this.width / this.height < 1.1 && ['welcome', 'decorate'].includes(this.state.mode)) this.camera.position.sub(this.controls.target).multiplyScalar(1.12).add(this.controls.target);
    this.camera.lookAt(this.controls.target); this.controls.update(); this.controls.saveState(); this.invalidate();
  }
  setVisible(value) { this.visible = Boolean(value); if (this.controls) this.controls.enabled = this.visible; if (this.visible) { this.resize(); this.invalidate(); } else { this.fetchStart = null; this.down.clear(); this._stop(); } }
  _stop() { if (this.frameId !== null) globalThis.cancelAnimationFrame?.(this.frameId); this.frameId = null; }
  invalidate() { this.dirty = true; this._schedule(); }
  _schedule() { if (!this.destroyed && this.visible && !this.contextLost && !globalThis.document?.hidden && this.frameId === null && globalThis.requestAnimationFrame) this.frameId = requestAnimationFrame(time => this._frame(time)); }
  _frame(time) {
    this.frameId = null; if (this.destroyed || !this.visible || this.contextLost || globalThis.document?.hidden) return;
    if (this.dirty || time - this.lastFrame >= 32) { this.lastFrame = time; this.drawFrame(time); this.dirty = false; }
    if (!this.state.reducedMotion) this._schedule();
  }
  _animate(time, syncOnly = false) {
    const model = this.model, n = this.state.neighborhood, home = new THREE.Vector3(...model.assets.companion.home), reduced = this.state.reducedMotion;
    let running = false, carrying = Boolean(n.companion.lastPlay), direction = 0;
    model.toy.visible = false; model.pet.position.copy(home);
    if (this.fetchStart !== null && this.fetchTarget && !reduced && !syncOnly) {
      const elapsed = Math.max(0, time - this.fetchStart); let fraction = 0;
      if (elapsed < 400) { carrying = false; model.toy.visible = true; model.toy.position.copy(home).lerp(this.fetchTarget, elapsed / 400); model.toy.position.y += .22 + Math.sin(elapsed / 400 * Math.PI) * 1.25; }
      else if (elapsed < 1480) { fraction = smooth((elapsed - 400) / 1080); running = true; carrying = false; model.toy.visible = true; model.toy.position.copy(this.fetchTarget).y = .2; }
      else if (elapsed < 1770) { fraction = 1; carrying = true; }
      else if (elapsed < 2900) { fraction = 1 - smooth((elapsed - 1770) / 1130); running = true; carrying = true; }
      else this.fetchStart = null;
      model.pet.position.copy(home).lerp(this.fetchTarget, fraction);
      direction = Math.atan2(this.fetchTarget.x - home.x, this.fetchTarget.z - home.z) + (elapsed >= 1770 ? Math.PI : 0);
    }
    model.pet.rotation.y = running ? direction : .25;
    if (running && !reduced) model.pet.position.y += Math.abs(Math.sin(time * .023)) * .1;
    model.pet.getObjectByName('pet-toy').visible = carrying;
    const tail = model.pet.getObjectByName('pet-tail'); if (tail) tail.rotation.z = reduced ? .1 : Math.sin(time * (running ? .016 : .005)) * .18;
    model.pet.traverse(part => { if (part.name.startsWith('pet-leg-')) part.rotation.x = running && !reduced ? Math.sin(time * .023 + (part.position.x > 0 ? 0 : Math.PI)) * .3 : 0; });
    model.petPick.position.copy(model.pet.position).add(new THREE.Vector3(0, .85, .15));
    if (this.petLabel) { this.petLabel.position.copy(model.pet.position).add(new THREE.Vector3(0, 2.05, 0)); this.petLabel.visible = this.state.mode !== 'water'; }
    model.ripples.forEach((ring, index) => { const phase = reduced ? .25 + index * .20 : (time * .00025 + index / 3) % 1; ring.scale.set(.18 + phase * .89, .13 + phase * .62, 1); });
  }
  drawFrame(time = 0) {
    if (this.destroyed || this.contextLost || !this.renderer) return;
    const started = globalThis.performance?.now?.() || 0; this.controls.update();
    if (this.fetchStart !== null) this.renderer.shadowMap.needsUpdate = true;
    this._animate(time); this.renderer.render(this.scene, this.camera);
    const elapsed = (globalThis.performance?.now?.() || started) - started; this.frameCosts.push(elapsed); if (this.frameCosts.length > 60) this.frameCosts.shift();
    const info = this.renderer.info.render;
    Object.assign(this.canvas.dataset, { renderMode: this.state.mode, renderer: 'three', renderMs: elapsed.toFixed(2), renderDrawCalls: String(info.calls), renderTriangles: String(info.triangles), renderDpr: String(this.dpr), renderStatus: 'ready' });
  }
  _pointerDown(event) {
    if (!this.visible || event.button > 0 && event.pointerType !== 'touch') return;
    if (!this.down.size) this.dragged = false; this.down.set(event.pointerId, { x: event.clientX, y: event.clientY }); if (this.down.size > 1) this.dragged = true;
  }
  _pointerMove(event) { const start = this.down.get(event.pointerId); if (start && Math.hypot(start.x - event.clientX, start.y - event.clientY) > 8) this.dragged = true; }
  _pointerUp(event) {
    const tracked = this.down.has(event.pointerId); this.down.delete(event.pointerId);
    if (!tracked || this.dragged || this.down.size || this.state.historical || !this.visible) return;
    const rect = this.canvas.getBoundingClientRect(); this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.scene.updateMatrixWorld(true); this.camera.updateMatrixWorld(true); this.raycaster.setFromCamera(this.pointer, this.camera);
    const candidates = this.model.picks.filter(pick => pick.userData.modes.includes(this.state.mode));
    const hit = this.raycaster.intersectObjects(candidates, false)[0];
    if (hit) { this.onSelect({ ...hit.object.userData.action }); return; }
    if (this.state.mode === 'companion') {
      const point = this.raycaster.ray.intersectPlane(this.groundPlane, new THREE.Vector3());
      if (!point) return; const x = point.x / .018 + 500, y = point.z / .020 + 440;
      if (((x - 632) / 177) ** 2 + ((y - 557) / 93) ** 2 < 1.15) this.onSelect({ type: 'lawn', x: clamp((x - 470) / 320, 0, 1), y: clamp((y - 477) / 169, 0, 1) });
    }
  }
  sceneToScreen(x, y, height = .1) { const point = canonicalPoint(x, y); point.y = height; point.project(this.camera); return { x: (point.x + 1) * this.width / 2, y: (1 - point.y) * this.height / 2 }; }
  getViewState() { return { renderer: 'three', mode: this.state.mode, camera: this.camera.position.toArray(), target: this.controls.target.toArray(), dpr: this.dpr, drawCalls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles }; }
  destroy() {
    if (this.destroyed) return; this.destroyed = true; this._stop(); this.resizeObserver?.disconnect(); globalThis.removeEventListener?.('resize', this._resize); globalThis.document?.removeEventListener?.('visibilitychange', this._visibility);
    this.listeners?.forEach(([name, listener]) => this.canvas.removeEventListener(name, listener)); this.controls?.dispose(); this.textures?.forEach(texture => texture.dispose()); this.labelMaterials?.forEach(material => material.dispose()); this.model?.dispose(); this.renderer?.dispose(); this.renderer?.forceContextLoss(); this.down?.clear();
  }
}
