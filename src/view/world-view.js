import { createLandscape, ellipse, polygon, random } from './landscape.js';
import { drawStructure, drawCharacter, structureSize } from './architecture.js';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const TAU=Math.PI*2;
const hash=text=>[...text].reduce((s,c)=>Math.imul(s,31)+c.charCodeAt(0)|0,1)>>>0;
const local=(settlement,object)=>({x:settlement.x+(object.x||0)*.82,y:settlement.y+(object.y||0)*.62});

/** Canvas is a projection only. No render, camera, animation, quality, or input
 * path advances or mutates the world. Every selectable object is a modeled ID. */
export class WorldView {
  constructor(canvas,{onSelect=()=>{},onScaleChange=()=>{},onPerformance=()=>{}}={}) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});
    this.onSelect=onSelect;this.onScaleChange=onScaleChange;this.onPerformance=onPerformance;
    this.world=null;this.selectedId=null;this.hoverId=null;this.followId=null;
    this.quality='auto';this.effectiveQuality='high';this.reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
    this.width=1;this.height=1;this.dpr=1;this.scale='region';
    this.camera={x:600,y:390,zoom:1};this.target={...this.camera};
    this.index=new Map();this.people=new Map();this.hits=[];this.pointers=new Map();
    this.frameId=null;this.lastFrame=0;this.lastMeasure=0;this.frameCount=0;this.frameCosts=[];
    this.destroyed=false;this.dirty=true;this.background=null;this.landscape=null;
    this._listeners=[];this._lastPointer=null;this._gestureDistance=0;this._dragged=false;
    this._bind('pointerdown',event=>this._pointerDown(event));
    this._bind('pointermove',event=>this._pointerMove(event));
    this._bind('pointerup',event=>this._pointerUp(event));
    this._bind('pointercancel',event=>this._pointerCancel(event));
    this._bind('pointerleave',()=>{if(!this.pointers.size){this.hoverId=null;this.invalidate();}});
    this._bind('wheel',event=>this._wheel(event),{passive:false});
    this._bind('dblclick',event=>{const p=this._pointer(event),hit=this._hitAt(p);if(hit)this.focus(hit.id,'neighborhood');});
    this._bind('keydown',event=>this._key(event));
    canvas.style.touchAction='none';
    if(!canvas.hasAttribute('tabindex'))canvas.tabIndex=0;
    if(!canvas.hasAttribute('aria-label'))canvas.setAttribute('aria-label','The Quiet Basin. Drag to explore; use the scale controls to visit a settlement. An accessible list of people and places is available in the journal.');
    this._resize=()=>this.resize();
    this.resizeObserver=globalThis.ResizeObserver?new ResizeObserver(this._resize):null;
    this.resizeObserver?.observe(canvas);
    if(!this.resizeObserver)globalThis.addEventListener?.('resize',this._resize);
    this._visibility=()=>{if(document.hidden){if(this.frameId!==null)cancelAnimationFrame(this.frameId);this.frameId=null;}else{this.lastFrame=0;this.invalidate();}};
    document.addEventListener('visibilitychange',this._visibility);
    this.resize();this.overview(true);
  }

  _bind(name,fn,options) {this.canvas.addEventListener(name,fn,options);this._listeners.push([name,fn,options]);}

  resize() {
    const rect=this.canvas.getBoundingClientRect();
    const previousFit=this._fit();
    this.width=Math.max(1,rect.width||this.canvas.clientWidth||1200);this.height=Math.max(1,rect.height||this.canvas.clientHeight||800);
    this.dpr=Math.min(globalThis.devicePixelRatio||1,this.effectiveQuality==='low'?1.25:2);
    this.canvas.width=Math.round(this.width*this.dpr);this.canvas.height=Math.round(this.height*this.dpr);
    this.background=null;
    if(this.scale==='region'&&previousFit>0){this.target.zoom=this._fit();if(this.reducedMotion)this.camera.zoom=this.target.zoom;}
    this.invalidate();
  }

  _fit() {return clamp(Math.min(this.width/1250,this.height/880),.23,1.4);}
  _anchor() {return {x:this.width*.5,y:this.height*(this.width<700?.35:.49)};}
  _zoomFor(scale) {
    if(scale==='region')return this._fit();
    if(scale==='settlement')return clamp(Math.min(this.width/430,this.height/330),.82,2.15);
    return clamp(Math.min(this.width/195,this.height/185),1.8,4.5);
  }

  setWorld(world) {
    if(!world||!Array.isArray(world.settlements))return;
    const historyJump=this.world&&(world.tick<this.world.tick||world.seed!==this.world.seed||world.tick-this.world.tick>8);
    this.world=world;this.index.clear();
    for(const region of world.regions||[])this.index.set(region.id,{entity:region,type:'region',x:region.x,y:region.y});
    for(const settlement of world.settlements){
      this.index.set(settlement.id,{entity:settlement,type:'settlement',x:settlement.x,y:settlement.y});
      for(const structure of settlement.structures||[])this.index.set(structure.id,{entity:structure,type:'structure',settlement,...local(settlement,structure)});
    }
    for(const character of world.characters||[]){
      const settlement=world.settlements.find(s=>s.id===character.settlementId);if(!settlement)continue;
      const point=local(settlement,character);this.index.set(character.id,{entity:character,type:'character',settlement,...point});
      const prior=this.people.get(character.id);
      this.people.set(character.id,{x:historyJump||this.reducedMotion||!prior?point.x:prior.x,y:historyJump||this.reducedMotion||!prior?point.y:prior.y,tx:point.x,ty:point.y});
    }
    for(const id of this.people.keys())if(!this.index.has(id))this.people.delete(id);
    for(const route of world.routes||[]){
      const from=this.index.get(route.from),to=this.index.get(route.to);if(from&&to)this.index.set(route.id,{entity:route,type:'route',x:(from.x+to.x)/2,y:(from.y+to.y)/2});
    }
    for(const culture of world.cultures||[]){const s=this.index.get(culture.settlementIds?.[0]);if(s)this.index.set(culture.id,{entity:culture,type:'culture',x:s.x,y:s.y});}
    for(const institution of world.institutions||[]){const s=this.index.get(institution.settlementId);if(s)this.index.set(institution.id,{entity:institution,type:'institution',x:s.x,y:s.y});}
    if(world.power){
      const s=this.index.get(world.power.settlementId),arch=this.index.get('k-choir-answer');
      if(s)this.index.set(world.power.id,{entity:world.power,type:'power',x:arch?.x??s.x+55,y:arch?.y??s.y-28});
    }
    if(this.followId&&!this.index.has(this.followId))this.followId=null;
    if(this.selectedId&&!this.index.has(this.selectedId))this.selectedId=null;
    this.invalidate();
  }

  select(entityId) {this.selectedId=this.index.has(entityId)?entityId:null;this.invalidate();}

  focus(entityId,scale='settlement') {
    const object=this.index.get(entityId);if(!object)return;
    this.selectedId=entityId;this.followId=object.type==='character'?entityId:null;
    this.target={x:object.x,y:object.y-12,zoom:this._zoomFor(scale)};
    this._setScaleName(scale);if(this.reducedMotion)this.camera={...this.target};this.invalidate();
  }

  overview(immediate=false) {
    this.followId=null;this.target={x:610,y:390,zoom:this._fit()};
    this._setScaleName('region');if(immediate||this.reducedMotion)this.camera={...this.target};this.invalidate();
  }

  setScale(scale) {
    if(!['region','settlement','neighborhood'].includes(scale))return;
    if(scale==='region'){this.overview();return;}
    let object=this.index.get(this.selectedId);
    if(!object||object.type==='region'||object.type==='route')object=this._nearestSettlement();
    if(object)this.focus(object.entity.id,scale);
    else {this.target.zoom=this._zoomFor(scale);this._setScaleName(scale);this.invalidate();}
  }

  zoomBy(factor) {
    if(!Number.isFinite(factor)||factor<=0)return;
    this.target.zoom=clamp(this.target.zoom*factor,this._fit()*.65,6);this._scaleFromZoom();this.invalidate();
  }

  pan(dx,dy) {
    if(!Number.isFinite(dx)||!Number.isFinite(dy))return;
    this.followId=null;this.target.x=clamp(this.target.x-dx/this.target.zoom,-180,1380);this.target.y=clamp(this.target.y-dy/this.target.zoom,-120,930);
    if(this.reducedMotion)this.camera={...this.target};this.invalidate();
  }

  setQuality(quality) {
    if(!['auto','low','high'].includes(quality))return;
    this.quality=quality;this.effectiveQuality=quality==='low'?'low':'high';this.landscape=null;this.resize();
  }

  setReducedMotion(value) {
    this.reducedMotion=Boolean(value);if(value){this.camera={...this.target};for(const p of this.people.values()){p.x=p.tx;p.y=p.ty;}}this.invalidate();
  }

  _setScaleName(scale) {if(this.scale!==scale){this.scale=scale;this.onScaleChange(scale);}}
  _scaleFromZoom() {this._setScaleName(this.target.zoom<this._zoomFor('settlement')*.72?'region':this.target.zoom<this._zoomFor('neighborhood')*.78?'settlement':'neighborhood');}
  _nearestSettlement() {let best=null,d=Infinity;for(const s of this.world?.settlements||[]){const n=distance(s,this.target);if(n<d){d=n;best=this.index.get(s.id);}}return best;}

  worldToScreen(x,y) {const a=this._anchor();return {x:(x-this.camera.x)*this.camera.zoom+a.x,y:(y-this.camera.y)*this.camera.zoom+a.y};}
  screenToWorld(x,y) {const a=this._anchor();return {x:(x-a.x)/this.camera.zoom+this.camera.x,y:(y-a.y)/this.camera.zoom+this.camera.y};}
  _pointer(event) {const r=this.canvas.getBoundingClientRect();return{x:event.clientX-r.left,y:event.clientY-r.top};}

  _pointerDown(event) {
    if(event.button!==undefined&&event.button!==0&&event.pointerType!=='touch')return;
    const point=this._pointer(event);this.pointers.set(event.pointerId,point);
    this.canvas.setPointerCapture?.(event.pointerId);
    if(this.pointers.size===1){this._lastPointer=point;this._downPointer=point;this._dragged=false;}
    else{this._dragged=true;const [a,b]=[...this.pointers.values()];this._gestureDistance=distance(a,b);}
  }

  _pointerMove(event) {
    const point=this._pointer(event);
    if(!this.pointers.has(event.pointerId)){
      if(event.pointerType!=='touch'){const hit=this._hitAt(point);const id=hit?.id||null;if(id!==this.hoverId){this.hoverId=id;this.canvas.style.cursor=id?'pointer':'grab';this.invalidate();}}
      return;
    }
    const oldPoint=this.pointers.get(event.pointerId);this.pointers.set(event.pointerId,point);
    if(this.pointers.size>1){
      const [a,b]=[...this.pointers.values()],d=distance(a,b),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
      if(this._gestureDistance>0)this._zoomAt(d/this._gestureDistance,mid);
      this._gestureDistance=d;this.pan((point.x-oldPoint.x)/2,(point.y-oldPoint.y)/2);this.camera={...this.target};this._dragged=true;
    }else{
      if(distance(point,this._downPointer||point)>6)this._dragged=true;
      if(this._dragged){this.pan(point.x-oldPoint.x,point.y-oldPoint.y);this.camera={...this.target};this.canvas.style.cursor='grabbing';}
    }
    this._lastPointer=point;this.invalidate();
  }

  _pointerUp(event) {
    const point=this._pointer(event),wasTracking=this.pointers.has(event.pointerId);this.pointers.delete(event.pointerId);
    this.canvas.releasePointerCapture?.(event.pointerId);
    if(wasTracking&&!this._dragged&&!this.pointers.size){const hit=this._hitAt(point);if(hit){this.select(hit.id);this.onSelect(hit.id);}}
    if(this.pointers.size===1){this._lastPointer=[...this.pointers.values()][0];this._downPointer=this._lastPointer;this._dragged=true;}
    if(!this.pointers.size){this._gestureDistance=0;this.canvas.style.cursor='grab';}
  }
  _pointerCancel(event) {this.pointers.delete(event.pointerId);this._dragged=true;this._gestureDistance=0;}

  _zoomAt(factor,point) {
    const before=this.screenToWorld(point.x,point.y),anchor=this._anchor();
    this.followId=null;this.target.zoom=clamp(this.target.zoom*factor,this._fit()*.65,6);
    this.target.x=before.x-(point.x-anchor.x)/this.target.zoom;this.target.y=before.y-(point.y-anchor.y)/this.target.zoom;
    this._scaleFromZoom();this.invalidate();
  }
  _wheel(event) {event.preventDefault();this._zoomAt(Math.exp(-clamp(event.deltaY,-180,180)*.0024),this._pointer(event));}
  _key(event) {
    if(event.key==='+'||event.key==='='){event.preventDefault();this.zoomBy(1.3);}
    else if(event.key==='-'){event.preventDefault();this.zoomBy(1/1.3);}
    else if(event.key==='0'){event.preventDefault();this.overview();}
    else if(event.key.startsWith('Arrow')){event.preventDefault();this.pan(event.key==='ArrowLeft'?65:event.key==='ArrowRight'?-65:0,event.key==='ArrowUp'?65:event.key==='ArrowDown'?-65:0);}
  }

  _hitAt(point) {
    let best=null,bestScore=Infinity;
    for(const hit of this.hits){
      const dx=(point.x-hit.x)/hit.rx,dy=(point.y-hit.y)/hit.ry,d=dx*dx+dy*dy;
      if(d<=1){const score=d+(hit.priority||0);if(score<bestScore){best=hit;bestScore=score;}}
    }
    return best;
  }
  _hit(id,x,y,rx,ry=rx,priority=0) {const p=this.worldToScreen(x,y);this.hits.push({id,...p,rx:Math.max(22,rx*this.camera.zoom),ry:Math.max(22,ry*this.camera.zoom),priority});}

  invalidate() {
    this.dirty=true;
    if(!this.destroyed&&this.frameId===null&&!document.hidden)this.frameId=requestAnimationFrame(time=>this._frame(time));
  }

  _frame(time) {
    this.frameId=null;if(this.destroyed||document.hidden)return;
    const minFrame=this.effectiveQuality==='low'?32:15;
    if(time-this.lastFrame<minFrame&&!this.dirty){this.frameId=requestAnimationFrame(t=>this._frame(t));return;}
    const dt=clamp(time-(this.lastFrame||time-16),1,70);this.lastFrame=time;
    const interpolation=this.reducedMotion?1:1-Math.exp(-dt/105);
    let changing=false;
    if(this.followId){const person=this.people.get(this.followId);if(person){this.target.x=person.x;this.target.y=person.y-12;}}
    for(const key of ['x','y','zoom']){const delta=this.target[key]-this.camera[key];if(Math.abs(delta)>(key==='zoom'?.0005:.03)){this.camera[key]+=delta*interpolation;changing=true;}else this.camera[key]=this.target[key];}
    for(const p of this.people.values()){if(Math.abs(p.tx-p.x)+Math.abs(p.ty-p.y)>.05){const lerp=this.reducedMotion?1:1-Math.exp(-dt/340);p.x+=(p.tx-p.x)*lerp;p.y+=(p.ty-p.y)*lerp;changing=true;}else{p.x=p.tx;p.y=p.ty;}}
    const start=performance.now();this.drawFrame(time);const cost=performance.now()-start;
    this.frameCosts.push(cost);if(this.frameCosts.length>60)this.frameCosts.shift();this.frameCount++;
    if(time-this.lastMeasure>1500){
      const average=this.frameCosts.reduce((a,b)=>a+b,0)/Math.max(1,this.frameCosts.length);
      const fps=this.lastMeasure?this.frameCount*1000/(time-this.lastMeasure):0;
      this.canvas.dataset.renderMs=average.toFixed(2);this.canvas.dataset.renderFps=fps.toFixed(1);this.canvas.dataset.renderQuality=this.effectiveQuality;
      this.onPerformance({fps,renderMs:average,quality:this.effectiveQuality,dpr:this.dpr});
      if(this.quality==='auto'&&average>23&&this.frameCosts.length===60&&this.effectiveQuality!=='low'){this.effectiveQuality='low';this.landscape=null;this.resize();}
      this.lastMeasure=time;this.frameCount=0;
    }
    this.dirty=false;
    if(!this.reducedMotion||changing)this.frameId=requestAnimationFrame(t=>this._frame(t));
  }

  // Public, time-independent projection entry for static renderer verification.
  // `time` affects decorative light only; supplied world state is never modified.
  drawFrame(time=0) {
    const ctx=this.ctx,{width,height,dpr}=this;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    if(!this.background){const g=ctx.createLinearGradient(0,0,width*.65,height);g.addColorStop(0,'#081e2b');g.addColorStop(.5,'#112e37');g.addColorStop(1,'#173e45');this.background=g;}
    ctx.fillStyle=this.background;ctx.fillRect(0,0,width,height);
    this.hits=[];if(!this.world)return;
    const anchor=this._anchor(),zoom=this.camera.zoom;
    ctx.save();ctx.translate(anchor.x,anchor.y);ctx.scale(zoom,zoom);ctx.translate(-this.camera.x,-this.camera.y);
    if(!this.landscape)this.landscape=createLandscape(this.effectiveQuality);
    const l=this.landscape;ctx.drawImage(l.canvas,l.x,l.y,l.width,l.height);
    this._drawRoutes(ctx);
    for(const settlement of this.world.settlements)this._drawGround(ctx,settlement);
    this._drawPower(ctx,time);
    const objects=[];
    for(const settlement of this.world.settlements)for(const s of settlement.structures||[]){const p=local(settlement,s);objects.push({type:'structure',entity:s,settlement,...p});}
    for(const c of this.world.characters||[])if(c.alive!==false){const p=this.people.get(c.id);if(p)objects.push({type:'character',entity:c,x:p.x,y:p.y-1,position:p});}
    objects.sort((a,b)=>a.y-b.y);
    for(const object of objects){
      const p=this.worldToScreen(object.x,object.y);if(p.x<-170||p.x>width+170||p.y<-60||p.y>height+330)continue;
      if(object.type==='structure'){
        drawStructure(ctx,object.entity,object.x,object.y,object.entity.id===this.selectedId,object.settlement);
        const [w,h]=structureSize(object.entity.kind,object.entity.form);if(this.scale!=='region')this._hit(object.entity.id,object.x,object.y-h*.34,w*.55,h*.6,.4);
      }else{
        if(zoom>.65){const moving=distance(object.position,{x:object.position.tx,y:object.position.ty})>1;drawCharacter(ctx,object.entity,object.x,object.y,this.selectedId===object.entity.id,time,moving,this.reducedMotion);}
        if(this.scale==='neighborhood')this._hit(object.entity.id,object.x,object.y-5,9,12,-.5);
      }
    }
    const tracked=this.index.get(this.selectedId),position=this.people.get(this.selectedId);
    if(tracked?.type==='character'&&tracked.entity.alive!==false&&position&&this.scale!=='region'){
      // Keep the tracked inhabitant readable behind a foreground roof or canopy.
      // This translucent selection silhouette stays at their modeled position.
      ctx.save();ctx.globalAlpha=.8;drawCharacter(ctx,tracked.entity,position.x,position.y-1,true,time,false,true);ctx.restore();
    }
    this._drawAtmosphere(ctx,time);
    ctx.restore();
    this._drawLabels(ctx);
    this._drawVignette(ctx);
  }

  _drawRoutes(ctx) {
    for(const route of this.world.routes||[]){
      const from=this.index.get(route.from),to=this.index.get(route.to);if(!from||!to)continue;
      const bend=((hash(route.id)%3)-1)*28,mx=(from.x+to.x)/2+bend,my=(from.y+to.y)/2-35;
      ctx.beginPath();ctx.moveTo(from.x,from.y+17);ctx.quadraticCurveTo(mx,my,to.x,to.y+17);
      ctx.strokeStyle=route.open?'#102b327f':'#76909044';ctx.lineWidth=route.open?6:1;ctx.setLineDash(route.open?[]:[3,7]);ctx.stroke();
      if(route.open){ctx.strokeStyle=route.id===this.selectedId?'#ffe5ac':'#bdba8677';ctx.lineWidth=1.5;ctx.stroke();ctx.strokeStyle='#e2cb9677';ctx.lineWidth=.65;ctx.setLineDash([1,10]);ctx.stroke();}
      ctx.setLineDash([]);
      if(route.open&&this.world.flags?.sharedNetwork&&(route.id==='r-hearth-lattice'||route.id==='r-hearth-choir')){
        ctx.strokeStyle=route.id==='r-hearth-lattice'?'#9adcd77a':'#b7d99b79';ctx.lineWidth=2.1;ctx.stroke();
        ctx.strokeStyle=this.world.power?.active?'#ddedbc94':'#dae1b644';ctx.lineWidth=.65;ctx.stroke();
      }
      const x=from.x*.25+mx*.5+to.x*.25,y=(from.y+17)*.25+my*.5+(to.y+17)*.25;
      if(this.scale==='region'){
        ellipse(ctx,x,y,9,5,'#153541','#7b9e9188',.7);
        ctx.strokeStyle=route.open?'#e5ce93':'#89a39c';ctx.lineWidth=1;
        ctx.beginPath();if(route.open){ctx.moveTo(x-3,y);ctx.lineTo(x+3,y);}else{ctx.moveTo(x-2,y-2);ctx.lineTo(x+2,y+2);ctx.moveTo(x-2,y+2);ctx.lineTo(x+2,y-2);}ctx.stroke();
        this._hit(route.id,x,y,15,12,.2);
      }
    }
  }

  _drawGround(ctx,s) {
    const radius=86+Math.min(24,(s.population||0)*.3);
    ellipse(ctx,s.x,s.y+6,radius,60,'#85926e0c','#a4b59810',1);
    const structures=s.structures||[];
    for(const structure of structures){
      const p=local(s,structure);ctx.beginPath();ctx.moveTo(s.x,s.y+10);ctx.quadraticCurveTo(s.x+(p.x-s.x)*.6,p.y+12,p.x,p.y+7);
      ctx.strokeStyle=structure.abandonedAt!=null?'#75826e25':'#b7b98a33';ctx.lineWidth=3.5;ctx.stroke();ctx.strokeStyle='#172f332e';ctx.lineWidth=.6;ctx.stroke();
    }
    const rand=random(hash(s.id));
    // Pinprick illumination stands in for aggregate occupancy, never named people.
    const occupied=Math.min(38,Math.ceil((s.population||0)/3));
    for(let i=0;i<occupied;i++){const a=rand()*TAU,r=20+rand()*72;const x=s.x+Math.cos(a)*r,y=s.y+Math.sin(a)*r*.5;ellipse(ctx,x,y,.6+rand()*.55,.6,'#f6d09380');}
    if(s.synthetics>0)this._drawSyntheticOccupation(ctx,s);
    if(s.collective>0)this._drawCollectiveOccupation(ctx,s);
    if(this.world.power?.active&&this.world.flags?.sharedNetwork&&s.id!=='s-hollow'){
      const energy=clamp((s.energy||0)/100,0,1),g=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,110);
      g.addColorStop(0,`rgba(190,217,156,${energy*.045})`);g.addColorStop(1,'rgba(190,217,156,0)');ellipse(ctx,s.x,s.y,110,65,g);
    }
    if(this.scale==='region')this._hit(s.id,s.x,s.y,84,68,1);
  }

  _drawSyntheticOccupation(ctx,s) {
    const hubs=s.structures.filter(b=>b.form==='synthetic'&&b.abandonedAt==null&&b.kind!=='conduit');
    if(!hubs.length)return;
    const count=Math.min(60,s.synthetics),dim=(s.syntheticIntegrity??88)<50;
    // Aggregate bodies have no invented names, memories, activities, or choices.
    // Their visible count comes from state; their staging around arrays is decorative.
    for(let i=0;i<count;i++){
      const hub=local(s,hubs[i%hubs.length]),slot=Math.floor(i/hubs.length);
      const x=hub.x-12+(slot%4)*8,y=hub.y+12+Math.floor(slot/4)*8-(slot%4)*2;
      ctx.beginPath();ctx.moveTo(hub.x,hub.y+4);ctx.lineTo(x,y);ctx.strokeStyle=dim?'#699a9e55':'#a9e3df60';ctx.lineWidth=.65;ctx.stroke();
      ellipse(ctx,x+1,y+1,3.7,1.7,'#08232e99');
      polygon(ctx,[[x-2,y-2],[x-2.2,y-7],[x,y-9],[x+2.2,y-7],[x+2,y-2],[x,y]],dim?'#5c838c':'#80bdc3','#c8f3df88',.5);
      ctx.beginPath();ctx.moveTo(x,y-7);ctx.lineTo(x,y-2);ctx.strokeStyle=dim?'#91aaa7':'#dcffe9';ctx.lineWidth=.65;ctx.stroke();
      if(this.scale==='neighborhood')this._hit(s.id,x,y-3,7,9,1.1);
    }
  }

  _drawCollectiveOccupation(ctx,s) {
    const rooms=s.structures.filter(b=>b.form==='collective'&&b.abandonedAt==null&&b.kind==='nest');
    if(!rooms.length)return;
    const centers=rooms.map(b=>local(s,b)),dry=(s.collectiveHydration??s.habitat)<50;
    const pigment=dry?'#858763':'#aed28f';
    for(let i=0;i<centers.length;i++){
      const p=centers[i];ellipse(ctx,p.x,p.y+8,37,23,dry?'#84806415':'#86b8781e',dry?'#9b967a33':'#b7d9993f',.6);
      if(i){const a=centers[i-1];ctx.beginPath();ctx.moveTo(a.x,a.y+8);ctx.bezierCurveTo(a.x-12,a.y+34,p.x-10,p.y+22,p.x,p.y+8);ctx.strokeStyle=dry?'#928b6466':'#acd390a0';ctx.lineWidth=2;ctx.stroke();ctx.strokeStyle='#223f3eaa';ctx.lineWidth=.6;ctx.stroke();}
    }
    for(let i=0;i<Math.min(90,s.collective);i++){
      const center=centers[i%centers.length],a=i*2.399,r=19+Math.floor(i/centers.length)*1.4;
      const x=center.x+Math.cos(a)*r,y=center.y+Math.sin(a)*r*.52+12;
      ctx.beginPath();ctx.moveTo(center.x,center.y+8);ctx.quadraticCurveTo(x-7,y+5,x,y);ctx.strokeStyle=dry?'#91916a77':'#acd49083';ctx.lineWidth=.8;ctx.stroke();
      ellipse(ctx,x,y,3.4,1.7,pigment,dry?'#b7b58a55':'#d5edb7aa',.4);ellipse(ctx,x-.5,y-.3,1,.6,dry?'#c6c196':'#e5f4bd');
    }
  }

  _drawPower(ctx,time) {
    const power=this.world.power;if(!power)return;
    const point=this.index.get(power.id);if(!point)return;
    const {x,y}=point,active=power.active!==false;
    const pulse=this.reducedMotion?1:.9+Math.sin(time*.0009)*.1;
    const strength=clamp((power.strength||36)/100,.2,1);
    ctx.save();ctx.globalAlpha=active?.8:.25;
    const g=ctx.createRadialGradient(x,y-22,0,x,y-22,75);g.addColorStop(0,`rgba(173,219,167,${(.18+strength*.15)*pulse})`);g.addColorStop(1,'rgba(118,219,188,0)');ellipse(ctx,x,y-22,76,85,g);
    ellipse(ctx,x,y+5,35,17,'#a3c7a017','#d5e8b798',.8);
    if(active){ellipse(ctx,x,y+5,43+strength*12,21+strength*5,null,'#c4e6ba58',.7);ellipse(ctx,x,y+5,58+strength*14,29+strength*7,null,'#a9dcd334',.6);}
    for(let i=0;i<5;i++){
      const phase=i/5*TAU+.3,px=x+Math.cos(phase)*29,py=y+Math.sin(phase)*12;
      ctx.beginPath();ctx.moveTo(px,py);ctx.bezierCurveTo(px+Math.cos(phase)*12,py-32,x+Math.cos(phase)*5,y-77,x,y-72);
      ctx.strokeStyle=i%2?'#b0e4d6ac':'#e6d9acbd';ctx.lineWidth=.7;ctx.stroke();
      ellipse(ctx,px,py,2,1,'#c7e6b1');
    }
    ellipse(ctx,x,y-61,3,7,active?'#e5eed0':'#7e9e92');ctx.restore();
    this._hit(power.id,x,y-31,35,49,-.1);
  }

  _drawAtmosphere(ctx,time) {
    if(this.effectiveQuality==='low')return;
    const drift=this.reducedMotion?0:Math.sin(time*.000025)*8;
    const clouds=[[277+drift,342,190,20],[764-drift,587,230,27],[535+drift*.5,34,170,14],[1116,434,120,18]];
    for(const [x,y,rx,ry] of clouds){const g=ctx.createRadialGradient(x,y,1,x,y,rx);g.addColorStop(0,'#c0d8bd0a');g.addColorStop(1,'#c0d8bd00');ellipse(ctx,x,y,rx,ry,g);}
    if(this.scale==='region'){
      ctx.strokeStyle='#bfcdb755';ctx.lineWidth=.8;
      for(let i=0;i<5;i++){const x=722+i*8+drift*.8,y=264+Math.sin(i)*5;ctx.beginPath();ctx.moveTo(x-3,y);ctx.quadraticCurveTo(x-1,y-2,x,y);ctx.quadraticCurveTo(x+1,y-2,x+3,y);ctx.stroke();}
    }
  }

  _label(ctx,text,x,y,{size=12,color='#eadfc4',align='center',font='sans-serif',weight='400',shadow=true}={}) {
    ctx.save();ctx.font=`${weight} ${size}px ${font}`;ctx.textAlign=align;ctx.textBaseline='middle';
    if(shadow){ctx.shadowColor='#061923';ctx.shadowBlur=8;ctx.shadowOffsetY=1;}
    ctx.fillStyle=color;ctx.fillText(text,x,y);ctx.restore();
  }

  _drawLabels(ctx) {
    if(this.scale==='region'){
      const regionLabels=[['REED BASIN',258,637],['GLASS REACH',995,494],['ASH FOLD',595,43]];
      for(const [text,x,y]of regionLabels){const p=this.worldToScreen(x,y);this._label(ctx,text,p.x,p.y,{size:this.width<700?9:11,color:'#a4beb091',weight:'500'});}
    }
    for(const s of this.world.settlements){
      const isSelected=this.selectedId===s.id;
      if(this.scale==='region'||(this.scale==='settlement'&&isSelected)){
        const p=this.worldToScreen(s.x,s.y+77);
        const total=(s.population||0)+(s.synthetics||0)+(s.collective||0);
        if(p.x<-120||p.x>this.width+120||p.y<0||p.y>this.height)continue;
        const labelWidth=Math.max(78,Math.min(190,s.name.length*8.5+24));
        ctx.save();ctx.fillStyle='#0d2832da';ctx.strokeStyle=isSelected?'#d9c28c99':'#849d8444';ctx.lineWidth=.8;
        ctx.beginPath();ctx.roundRect(p.x-labelWidth/2,p.y-17,labelWidth,42,5);ctx.fill();ctx.stroke();ctx.restore();
        this._label(ctx,s.name,p.x,p.y-3,{size:this.width<700?13:15,font:'Georgia,serif',color:isSelected?'#ffe7b5':'#eee3c8'});
        const forms=[s.population>0,s.synthetics>0,s.collective>0].filter(Boolean).length;
        const occupancy=total===0?'A QUIET TRACE':forms===3?'THREE FORMS TOGETHER':forms===2?'A SHARED SETTLEMENT':s.synthetics>0?'SYNTHETIC SETTLEMENT':s.collective>0?'COLLECTIVE GROWTH':`${s.population||0} INHABITANTS`;
        this._label(ctx,occupancy,p.x,p.y+13,{size:8,color:'#b6c0a7',weight:'500'});
        this.hits.push({id:s.id,x:p.x,y:p.y+3,rx:labelWidth/2+5,ry:23,priority:-1});
      }
    }
    if(this.scale==='neighborhood'){
      const occupiedLabels=[];
      const people=[...(this.world.characters||[])].sort((a,b)=>(b.id===this.selectedId?1:0)-(a.id===this.selectedId?1:0));
      for(const c of people){
        if(c.alive===false)continue;const position=this.people.get(c.id);if(!position)continue;
        const base=this.worldToScreen(position.x,position.y-17),selected=c.id===this.selectedId;
        let p={...base};
        if(p.x<20||p.x>this.width-20||p.y<15||p.y>this.height-20)continue;
        const width=c.name.length*(selected?8:7)+12;
        for(const offset of [0,-18,-36,-54,18,36,-72]){
          const candidate={left:base.x-width/2,right:base.x+width/2,top:base.y+offset-8,bottom:base.y+offset+8};
          if(candidate.top<10||occupiedLabels.some(r=>candidate.left<r.right&&candidate.right>r.left&&candidate.top<r.bottom&&candidate.bottom>r.top))continue;
          p.y=base.y+offset;occupiedLabels.push(candidate);break;
        }
        if(Math.abs(p.y-base.y)>4){ctx.beginPath();ctx.moveTo(base.x,base.y+6);ctx.lineTo(p.x,p.y+8);ctx.strokeStyle='#cad2b77a';ctx.lineWidth=.6;ctx.stroke();}
        this._label(ctx,c.name,p.x,p.y,{size:selected?13:11,color:selected?'#ffe7b3':'#ede4ce',weight:selected?'600':'400'});
        if(selected||this.hoverId===c.id){
          const activity=c.activity||c.role||'';
          this._label(ctx,activity.length>52?`${activity.slice(0,49)}…`:activity,p.x,p.y+17,{size:10,color:'#bed0bc'});
        }
        this.hits.push({id:c.id,x:p.x,y:p.y,rx:Math.max(22,c.name.length*3.8),ry:12,priority:-.7});
      }
    }
    const inspectId=this.hoverId||this.selectedId,object=this.index.get(inspectId);
    if(object?.type==='structure'&&this.scale!=='region'){
      const [,h]=structureSize(object.entity.kind,object.entity.form),p=this.worldToScreen(object.x,object.y-h-9);
      this._label(ctx,object.entity.name,p.x,p.y,{size:13,color:'#f2e5c1',font:'Georgia,serif'});
      const abandoned=object.entity.abandonedAt!=null;
      this._label(ctx,abandoned?`A surviving trace · day ${object.entity.abandonedAt}`:`Recorded since day ${object.entity.builtAt??0}`,p.x,p.y+17,{size:9,color:'#aabda9'});
    }
    if(this.world.power&&this.scale!=='region'){
      const power=this.index.get(this.world.power.id);if(power){const p=this.worldToScreen(power.x,power.y-87);this._label(ctx,this.world.power.name,p.x,p.y,{size:11,color:'#d6e6bb',font:'Georgia,serif'});}
    }
  }

  _drawVignette(ctx) {
    const w=this.width,h=this.height;
    const g=ctx.createRadialGradient(w*.5,h*.48,Math.min(w,h)*.25,w*.5,h*.5,Math.max(w,h)*.73);
    g.addColorStop(0,'#04152200');g.addColorStop(1,'#04152155');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  }

  getViewState() {return {scale:this.scale,selectedId:this.selectedId,followId:this.followId,camera:{...this.camera},quality:this.effectiveQuality,dpr:this.dpr,width:this.width,height:this.height};}

  destroy() {
    this.destroyed=true;if(this.frameId!==null)cancelAnimationFrame(this.frameId);this.frameId=null;
    this.resizeObserver?.disconnect();globalThis.removeEventListener?.('resize',this._resize);
    document.removeEventListener('visibilitychange',this._visibility);
    for(const [name,fn,options]of this._listeners)this.canvas.removeEventListener(name,fn,options);
    this.pointers.clear();this.landscape=null;
  }
}
