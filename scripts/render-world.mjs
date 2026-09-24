/** Static Canvas renderer evidence. This is NOT a browser screenshot or an
 * interaction test. Optional dev-only dependency: `npm install --no-save
 * skia-canvas`, or set SKIA_CANVAS_MODULE to an installed module directory. */
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { WorldView } from '../src/view/world-view.js';
import { createWorld as createVersionedWorld, advance, intervene, getInterventions } from '../src/sim/world.js';
// Preserve the original prototype's published static evidence. Current v2
// topology and interaction are covered by the generated-place renderer tests.
const createWorld = options => createVersionedWorld({ ...options, engineVersion: '1.0.0' });

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
const tier1=createWorld({tier:1,seed:8417});
const world=advance(createWorld({tier:2,seed:8417}),2);
const scenarioCommands=[{atTick:0,kind:'open-route',targetId:'r-hearth-lattice'}];
let scenario=intervene(createWorld({tier:2,seed:8417}),scenarioCommands[0]);
let day24,day42;
while(scenario.tick<42){
  scenario=advance(scenario);
  const refuge=getInterventions(scenario).find(i=>i.kind==='offer-refuge'&&i.available);
  if(refuge){const command={atTick:scenario.tick,kind:refuge.kind,targetId:refuge.targetId};scenarioCommands.push(command);scenario=intervene(scenario,command);}
  if(scenario.tick===24)day24=scenario;
  if(scenario.tick===42)day42=scenario;
}
const cases=[
  {file:'render-region.webp',width:1440,height:900,scale:'region',world},
  {file:'render-neighborhood.webp',width:1440,height:900,scale:'neighborhood',focus:'s-hearth',world},
  {file:'render-phone.webp',width:390,height:680,scale:'neighborhood',focus:'k-hearth-door',world},
  {file:'render-tier1-region.webp',width:1440,height:900,scale:'region',world:tier1},
  {file:'render-tier1-neighborhood.webp',width:1440,height:900,scale:'neighborhood',focus:'s-hearth',world:advance(tier1,2)},
  {file:'render-tier2-day24-region.webp',width:1440,height:900,scale:'region',world:day24},
  {file:'render-tier2-day24-lattice.webp',width:1440,height:900,scale:'neighborhood',focus:'s-lattice',world:day24},
  {file:'render-tier2-day24-choir.webp',width:1440,height:900,scale:'neighborhood',focus:'s-choir',world:day24},
  {file:'render-tier2-day42-hearth.webp',width:1440,height:900,scale:'neighborhood',focus:'s-hearth',world:day42},
  {file:'render-tier2-day42-power.webp',width:1440,height:900,scale:'neighborhood',focus:'p-undersong',world:day42},
];
const results=[];
for(const spec of cases){
  const canvas=makeCanvas(spec.width,spec.height),view=new WorldView(canvas);
  view.setWorld(spec.world);view.setReducedMotion(true);
  if(spec.focus)view.focus(spec.focus,spec.scale);else view.overview(true);
  const before=JSON.stringify(spec.world),start=performance.now();view.drawFrame(0);const elapsedMs=performance.now()-start;
  if(JSON.stringify(spec.world)!==before)throw new Error('Renderer mutated its world.');
  await writeFile(resolve(out,spec.file),await canvas.toBuffer('webp', {quality: .9}));
  results.push({file:spec.file,width:spec.width,height:spec.height,tier:spec.world.tier,tick:spec.world.tick,scale:spec.scale,focus:spec.focus||null,renderMs:Math.round(elapsedMs*100)/100,view:view.getViewState()});view.destroy();
}
const stateSummary=w=>({tick:w.tick,settlements:w.settlements.map(s=>({id:s.id,population:s.population,synthetics:s.synthetics,collective:s.collective,energy:s.energy,habitat:s.habitat,structures:s.structures.length})),power:w.power?{id:w.power.id,emergedAt:w.power.emergedAt,lastActAt:w.power.lastActAt,strength:w.power.strength}:null,powerActs:w.flags.powerActs,institution:w.institutions.find(i=>i.id==='i-confluence')?.status});
await writeFile(resolve(out,'static-render-report.json'),JSON.stringify({kind:'Static renderer frames; not browser screenshots, app interaction, or device performance measurements.',scenario:{seed:8417,tier:2,commands:scenarioCommands,checkpoints:[stateSummary(day24),stateSummary(day42)]},frames:results},null,2)+'\n');
console.log(`Rendered ${results.length} static frames to ${out}. These are not browser screenshots.`);
