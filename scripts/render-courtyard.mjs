/** Static native-Canvas evidence, not browser screenshots or device tests.
 * Optional dev tool: @napi-rs/canvas (or skia-canvas via CANVAS_MODULE).
 * The playable game itself has no runtime dependencies. */
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NeighborhoodView } from '../src/view/neighborhood-view.js';
import { defaultNeighborhood, reduceNeighborhood } from '../src/neighborhood.js';

const require = createRequire(import.meta.url);
let raster;
try { raster = require(process.env.CANVAS_MODULE || '@napi-rs/canvas'); }
catch { throw new Error('Static rendering needs an optional native Canvas tool. Set CANVAS_MODULE to an installed @napi-rs/canvas or skia-canvas module.'); }
function makeCanvas(width = 1000, height = 760) {
  const canvas = raster.createCanvas ? raster.createCanvas(width, height) : new raster.Canvas(width, height);
  canvas.style = {}; canvas.dataset = {}; canvas.clientWidth = width; canvas.clientHeight = height;
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width, height });
  canvas.addEventListener = () => {}; canvas.removeEventListener = () => {}; canvas.setAttribute = () => {};
  return canvas;
}
globalThis.document = { hidden: false, createElement: () => makeCanvas(), addEventListener() {}, removeEventListener() {} };
globalThis.requestAnimationFrame = () => 1; globalThis.cancelAnimationFrame = () => {};
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
globalThis.devicePixelRatio = 1;

let furnished = defaultNeighborhood();
for (const [slotId, itemId] of [['porch-left', 'planter'], ['porch-right', 'bench'], ['garden-left', 'birdbath'], ['garden-right', 'lantern'], ['lawn-left', 'rug'], ['lawn-right', 'pet-bed']])
  furnished = reduceNeighborhood(furnished, { type: 'place', slotId, itemId });
furnished = reduceNeighborhood(furnished, { type: 'pet-accessory', accessory: 'scarf' });
let alternate = reduceNeighborhood(furnished, { type: 'place', slotId: 'garden-right', itemId: 'wind-chime' });
alternate = reduceNeighborhood(alternate, { type: 'place', slotId: 'lawn-left', itemId: 'cushions' });
alternate = reduceNeighborhood(alternate, { type: 'rotate', slotId: 'porch-right' });
alternate = reduceNeighborhood(alternate, { type: 'pet-color', color: 'plum' });
alternate = reduceNeighborhood(alternate, { type: 'pet-accessory', accessory: 'flower' });

const out = resolve(process.argv[2] || 'evidence'); await mkdir(out, { recursive: true });
const cases = [
  { file: 'courtyard-first-visit.webp', width: 1200, height: 840, mode: 'welcome', neighborhood: defaultNeighborhood() },
  { file: 'courtyard-furnished.webp', width: 1200, height: 840, mode: 'welcome', neighborhood: furnished },
  { file: 'courtyard-phone-decorate.webp', width: 390, height: 310, mode: 'decorate', neighborhood: alternate, selectedSlotId: 'porch-right' },
  { file: 'courtyard-phone-companion.webp', width: 390, height: 310, mode: 'companion', neighborhood: alternate },
  { file: 'courtyard-phone-spring-preview.webp', width: 390, height: 310, mode: 'water', neighborhood: furnished },
  { file: 'courtyard-phone-spring-restored.webp', width: 390, height: 310, mode: 'water', neighborhood: furnished, waterRunning: true },
];
const frames = [];
for (const spec of cases) {
  const canvas = makeCanvas(spec.width, spec.height), view = new NeighborhoodView(canvas);
  const before = JSON.stringify(spec.neighborhood);
  view.setState({ ...spec, reducedMotion: true });
  const started = performance.now(); view.drawFrame(); const firstRenderMs = performance.now() - started;
  if (JSON.stringify(spec.neighborhood) !== before) throw new Error('Static renderer mutated saved metadata.');
  const bytes = raster.createCanvas ? canvas.toBuffer('image/webp') : await canvas.toBuffer('webp', { quality: .9 });
  await writeFile(resolve(out, spec.file), bytes);
  frames.push({ file: spec.file, width: spec.width, height: spec.height, mode: spec.mode, waterRunning: Boolean(spec.waterRunning), firstRenderMs: Math.round(firstRenderMs * 100) / 100, camera: view.camera });
  view.destroy();
}
await writeFile(resolve(out, 'courtyard-static-render-report.json'), `${JSON.stringify({ kind: 'Static native Canvas frames. Not browser screenshots, app interaction, or device performance measurements.', frames }, null, 2)}\n`);
console.log(`Rendered ${frames.length} courtyard static frames to ${out}. These are not browser screenshots.`);
