/** Static Canvas renderer evidence. This is NOT a browser screenshot or an
 * interaction test. Optional dev-only dependency: `npm install --no-save
 * skia-canvas`, or set SKIA_CANVAS_MODULE to an installed module directory. */
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { WorldView } from '../src/view/world-view.js';
import { createWorld, advance } from '../src/sim/world.js';

const require=createRequire(import.meta.url);
let Canvas;
try { ({Canvas}=require(process.env.SKIA_CANVAS_MODULE||'skia-canvas')); }
catch { throw new Error('Static rendering needs the optional skia-canvas development tool. Set SKIA_CANVAS_MODULE to its module directory. The playable game has no runtime dependencies.'); }

function makeCanvas(width=1440,height=900) {
  const canvas=new Canvas(width,height);
  canvas.style={};canvas.dataset={};canvas.clientWidth=width;canvas.clientHeight=height;
  canvas.getBoundingClientRect=()=>({left:0,top:0,width,height});
  canvas.addEventListener=()=>{};canvas.removeEventListener=()=>{};
  canvas.hasAttribute=()=>false;canvas.setAttribute=()=>{};
  return canvas;
}
globalThis.document={hidden:false,createElement:tag=>{if(tag!=='canvas')throw new Error(`Unexpected DOM element: ${tag}`);return makeCanvas();},addEventListener:()=>{},removeEventListener:()=>{}};
globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
globalThis.ResizeObserver=class {observe(){} disconnect(){}};
globalThis.devicePixelRatio=1;
globalThis.matchMedia=()=>({matches:true});

const out=resolve(process.argv[2]||'evidence');await mkdir(out,{recursive:true});
const world=createWorld({tier:1,seed:8417});
const cases=[
  {file:'render-region.png',width:1440,height:900,scale:'region',world},
  {file:'render-neighborhood.png',width:1440,height:900,scale:'neighborhood',focus:'s-hearth',world:advance(world,2)},
  {file:'render-phone.png',width:390,height:680,scale:'neighborhood',focus:'k-hearth-door',world:advance(world,2)},
];
const results=[];
for(const spec of cases){
  const canvas=makeCanvas(spec.width,spec.height),view=new WorldView(canvas);
  view.setWorld(spec.world);view.setReducedMotion(true);
  if(spec.focus)view.focus(spec.focus,spec.scale);else view.overview(true);
  const before=JSON.stringify(spec.world),start=performance.now();view.drawFrame(0);const elapsedMs=performance.now()-start;
  if(JSON.stringify(spec.world)!==before)throw new Error('Renderer mutated its world.');
  await writeFile(resolve(out,spec.file),await canvas.toBuffer('png'));
  results.push({file:spec.file,width:spec.width,height:spec.height,tick:spec.world.tick,scale:spec.scale,focus:spec.focus||null,renderMs:Math.round(elapsedMs*100)/100,view:view.getViewState()});view.destroy();
}
await writeFile(resolve(out,'static-render-report.json'),JSON.stringify({kind:'Static renderer frames; not browser screenshots, app interaction, or device performance measurements.',frames:results},null,2)+'\n');
console.log(`Rendered ${results.length} static frames to ${out}. These are not browser screenshots.`);
