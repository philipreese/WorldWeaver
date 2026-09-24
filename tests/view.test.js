import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldView } from '../src/view/world-view.js';
import { createWorld, advance, intervene } from '../src/sim/world.js';
import { structureSize } from '../src/view/architecture.js';

// A DOM/Canvas contract harness, not a browser, raster, or device test.
// It exercises user input and verifies that rendering cannot change history.
function fakeCanvas(width=1280,height=760) {
  const listeners=new Map();
  const gradient={addColorStop(){}};
  const ctx=new Proxy({createRadialGradient:()=>gradient,createLinearGradient:()=>gradient}, {get:(target,key)=>target[key]??(()=>{})});
  return {width,height,style:{},dataset:{},listeners,getContext:()=>ctx,getBoundingClientRect:()=>({left:0,top:0,width,height}),
    addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key),hasAttribute:()=>false,setAttribute(){},setPointerCapture(){},releasePointerCapture(){}};
}
globalThis.document={hidden:false,createElement:()=>fakeCanvas(),addEventListener(){},removeEventListener(){}};
globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
globalThis.ResizeObserver=class{observe(){}disconnect(){}};
globalThis.matchMedia=()=>({matches:true});
globalThis.devicePixelRatio=1;

function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);for(const v of Object.values(value))freeze(v);}return value;}
function setup(onSelect=()=>{}){const canvas=fakeCanvas(),view=new WorldView(canvas,{onSelect});view.setWorld(createWorld());view.setReducedMotion(true);return {canvas,view};}
function pointer(canvas,type,id,x,y){canvas.listeners.get(type)({pointerId:id,pointerType:'touch',button:0,clientX:x,clientY:y});}

test('drawing, camera movement, quality and scale leave frozen simulation state untouched',()=>{
  const {view}=setup(),world=freeze(advance(createWorld(),4)),before=JSON.stringify(world);
  view.setWorld(world);view.focus('c-nera','neighborhood');view.drawFrame(600);
  view.setQuality('low');view.pan(83,-29);view.zoomBy(1.3);view.drawFrame(900);
  view.setQuality('high');view.overview();view.drawFrame(1500);
  assert.equal(JSON.stringify(world),before);assert.ok(view.hits.every(hit=>view.index.has(hit.id)));view.destroy();
});

test('touch can inspect a recorded structure while a drag never inspects',()=>{
  const selected=[],{canvas,view}=setup(id=>selected.push(id));view.focus('k-hearth-door','neighborhood');view.drawFrame();
  const hit=view.hits.find(h=>h.id==='k-hearth-door');assert.ok(hit);
  pointer(canvas,'pointerdown',1,hit.x,hit.y);pointer(canvas,'pointerup',1,hit.x,hit.y);
  assert.deepEqual(selected,['k-hearth-door']);
  pointer(canvas,'pointerdown',2,hit.x,hit.y);pointer(canvas,'pointermove',2,hit.x+80,hit.y+20);pointer(canvas,'pointerup',2,hit.x+80,hit.y+20);
  assert.deepEqual(selected,['k-hearth-door']);view.destroy();
});

test('pinch updates the camera without a tap action, and all zoom bounds stay finite',()=>{
  const selected=[],{canvas,view}=setup(id=>selected.push(id));const before=view.target.zoom;
  pointer(canvas,'pointerdown',1,400,330);pointer(canvas,'pointerdown',2,600,330);
  pointer(canvas,'pointermove',2,690,350);pointer(canvas,'pointerup',2,690,350);pointer(canvas,'pointerup',1,400,330);
  assert.ok(view.target.zoom>before);assert.deepEqual(selected,[]);
  view.zoomBy(Infinity);view.zoomBy(NaN);view.zoomBy(-5);assert.ok(Number.isFinite(view.target.zoom));
  view.zoomBy(1e9);assert.ok(view.target.zoom<=6);view.destroy();
});

test('following a person uses actual new positions and panning disengages it',()=>{
  const {view}=setup();view.focus('c-nera','neighborhood');
  const next=advance(view.world,2),person=next.characters.find(c=>c.id==='c-nera'),settlement=next.settlements.find(s=>s.id===person.settlementId);
  view.setWorld(next);view._frame(100);
  assert.equal(view.target.x,settlement.x+person.x*.82);assert.equal(view.target.y,settlement.y+person.y*.62-12);
  assert.equal(view.followId,'c-nera');view.pan(10,0);assert.equal(view.followId,null);view.destroy();
});

test('historical snapshot replacement removes future selectable structures',()=>{
  const {view}=setup();const future=structuredClone(view.world);
  future.tick=10;future.settlements[0].structures.push({id:'future-structure',name:'Future',kind:'home',x:0,y:0,builtAt:10,eventId:'test'});
  view.setWorld(future);view.select('future-structure');assert.equal(view.selectedId,'future-structure');
  view.setWorld(createWorld());view.focus('s-hearth','neighborhood');view.drawFrame();
  assert.ok(!view.index.has('future-structure'));assert.ok(view.hits.every(h=>h.id!=='future-structure'));view.destroy();
});

test('Tier 2 projection preserves history and anchors the power to its recorded structure',()=>{
  const {view}=setup();let world=createWorld({tier:2});
  world=intervene(world,{kind:'open-route',targetId:'r-hearth-lattice'});world=advance(world,42);freeze(world);
  assert.ok(world.power);const before=JSON.stringify(world);view.setWorld(world);view.focus(world.power.id,'neighborhood');view.drawFrame();
  const arch=view.index.get('k-choir-answer'),power=view.index.get(world.power.id);
  assert.equal(power.x,arch.x);assert.equal(power.y,arch.y);assert.equal(JSON.stringify(world),before);
  assert.notDeepEqual(structureSize('ruin','synthetic'),structureSize('ruin'));
  assert.deepEqual(structureSize('ruin','collective'),structureSize('nest'));
  view.destroy();
});
