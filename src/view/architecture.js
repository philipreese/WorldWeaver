import { ellipse, polygon, random } from './landscape.js';
import { resolveStyleColor } from '../customization.js';

const TAU = Math.PI * 2;
const palettes = {
  amber: { top:'#baa47b', left:'#7b7562', right:'#44575a', edge:'#ead4a88c', light:'#ffe0a0', dark:'#2e4142' },
  cyan: { top:'#769895', left:'#3c646e', right:'#264655', edge:'#adede2aa', light:'#a2f6ee', dark:'#183c4b' },
  jade: { top:'#71997e', left:'#426c60', right:'#2c5350', edge:'#b7d7a288', light:'#c1e7a5', dark:'#234c47' },
  old: { top:'#647373', left:'#42575a', right:'#2d444b', edge:'#9aab9655', light:'#b0c8b5', dark:'#233b43' },
};

function box(ctx,x,y,w,d,h,p) {
  polygon(ctx,[[x-w/2,y-h],[x,y-h-d/2],[x+w/2,y-h],[x,y-h+d/2]],p.top,p.edge,.6);
  polygon(ctx,[[x-w/2,y-h],[x,y-h+d/2],[x,y+d/2],[x-w/2,y]],p.left,p.edge,.5);
  polygon(ctx,[[x,y-h+d/2],[x+w/2,y-h],[x+w/2,y],[x,y+d/2]],p.right,p.edge,.5);
  // Fine horizontal joints keep large neighborhood-scale walls tactile.
  ctx.strokeStyle='#d9d9b017';ctx.lineWidth=.45;
  for(let level=7;level<h-3;level+=7){ctx.beginPath();ctx.moveTo(x-w/2,y-level);ctx.lineTo(x,y-level+d/2);ctx.lineTo(x+w/2,y-level);ctx.stroke();}
  ctx.beginPath();ctx.moveTo(x-w/2,y-2);ctx.lineTo(x,y+d/2-2);ctx.lineTo(x+w/2,y-2);ctx.strokeStyle='#d9d9b02b';ctx.lineWidth=.7;ctx.stroke();
}

function glow(ctx,x,y,r,color,alpha=.24) {
  ctx.save();ctx.globalAlpha=alpha;
  const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,`${color}00`);
  ellipse(ctx,x,y,r,r*.55,g);ctx.restore();
}

function windows(ctx,x,y,w,h,p,lit) {
  const color=lit?p.light:'#243b3f';
  for(let i=0;i<3;i++) {
    const wx=x+4+i*(w/2-7)/3,wy=y-h*.57-i*1.4;
    if(lit)glow(ctx,wx+1,wy+1,8,p.light,.25);
    polygon(ctx,[[wx,wy],[wx+2.6,wy-1.4],[wx+2.6,wy+3],[wx,wy+4.4]],color);
    ctx.beginPath();ctx.moveTo(wx+1.3,wy-.3);ctx.lineTo(wx+1.3,wy+3.7);ctx.strokeStyle='#917958aa';ctx.lineWidth=.35;ctx.stroke();
  }
}

function steps(ctx,x,y,w) {
  for(let i=3;i>=0;i--)polygon(ctx,[[x-w/2-i*2,y-i*1.5],[x,y+9+i],[x+w/2+i*2,y-i*1.5],[x,y-7-i]],i%2?'#526260':'#354e50','#8ba09336',.55);
}

function home(ctx,p,abandoned,seed,style) {
  box(ctx,0,0,31,20,22,p);
  polygon(ctx,[[-18,-23],[0,-35],[18,-23],[0,-14]],p.top,p.edge,.8);
  polygon(ctx,[[-18,-23],[0,-35],[0,-14]],abandoned?'#566566':'#a69876',p.edge,.6);
  polygon(ctx,[[18,-23],[0,-35],[0,-14]],abandoned?'#3c5558':'#7b8068',p.edge,.6);
  for(let i=1;i<5;i++){ctx.beginPath();ctx.moveTo(-18+i*3.6,-23-i*2.4);ctx.lineTo(i*3.6,-14-i*1.8);ctx.strokeStyle='#e9d8a622';ctx.lineWidth=.5;ctx.stroke();}
  windows(ctx,0,0,31,22,p,!abandoned);
  polygon(ctx,[[-8,-7],[-3,-4],[-3,8],[-8,5]],abandoned?'#20373e':'#d8b27b');
  if(abandoned){ctx.beginPath();ctx.moveTo(-11,-26);ctx.lineTo(-4,-23);ctx.lineTo(-7,-18);ctx.lineTo(0,-15);ctx.strokeStyle='#20353d';ctx.lineWidth=2;ctx.stroke();}
  else {
    box(ctx,-15,10,10,7,5,p);ellipse(ctx,-15,3,5,2.5,'#64876d');
    ctx.beginPath();ctx.moveTo(-13,3);ctx.lineTo(-13,-6);ctx.strokeStyle='#9ca68a';ctx.lineWidth=.5;ctx.stroke();
    ellipse(ctx,-13,-7,3,1.7,'#bac794');
    polygon(ctx,[[-13,-9],[-4,-4],[-4,-7],[-13,-12]],'#b69b70','#e6caa766',.4);
    ctx.beginPath();ctx.moveTo(-14,7);ctx.lineTo(-14,-8);ctx.strokeStyle='#b8b698';ctx.lineWidth=.6;ctx.stroke();
    glow(ctx,-6,8,18,p.light,.17);
  }
  decorateHome(ctx,style,abandoned);
}

function decorateHome(ctx,style,abandoned) {
  if(!style)return;
  const color=resolveStyleColor(style.color),trim=color?.coat||'#d8b27b',accent=color?.accent||'#f1d6a0';
  ctx.save();if(abandoned)ctx.globalAlpha=.38;
  if(color){
    // Paint stays on existing woodwork; no room, path, or doorway is relocated.
    polygon(ctx,[[-13,-9],[-4,-4],[-4,-7],[-13,-12]],trim,accent,.5);
    ctx.beginPath();ctx.moveTo(-8.8,5.5);ctx.lineTo(-8.8,-8);ctx.lineTo(-2.3,-4.2);ctx.lineTo(-2.3,8.5);ctx.strokeStyle=trim;ctx.lineWidth=1.4;ctx.stroke();
    ctx.beginPath();ctx.moveTo(2,-10.3);ctx.lineTo(13.7,-16.3);ctx.strokeStyle=trim;ctx.lineWidth=1.4;ctx.stroke();
    ctx.beginPath();ctx.moveTo(-17,-23);ctx.lineTo(0,-14);ctx.lineTo(17,-23);ctx.strokeStyle=trim;ctx.lineWidth=1.2;ctx.stroke();
  }
  if(style.decoration==='planter'){
    const pot={top:accent,left:trim,right:color?.shade||'#8a785f',edge:'#e8d8b699'};
    box(ctx,6,14,12,7,5,pot);ellipse(ctx,6,9,5,2.3,'#48644e');
    for(const [x,y]of [[2,4],[6,1],[10,4]]){
      ctx.beginPath();ctx.moveTo(x,9);ctx.lineTo(x,y);ctx.strokeStyle=abandoned?'#8e9376':'#a1c98b';ctx.lineWidth=.65;ctx.stroke();
      ellipse(ctx,x-1,y+2,1.8,.7,abandoned?'#8a9174':'#b5d799');
      for(let i=0;i<4;i++)ellipse(ctx,x+Math.cos(i*TAU/4)*1.2,y+Math.sin(i*TAU/4)*.9,1.2,1,trim);
      ellipse(ctx,x,y,.65,.55,accent);
    }
  }
  if(style.decoration==='lantern'){
    ctx.beginPath();ctx.moveTo(-12,6);ctx.lineTo(-12,-17);ctx.quadraticCurveTo(-17,-21,-17,-15);ctx.strokeStyle=trim;ctx.lineWidth=.85;ctx.stroke();
    if(!abandoned)glow(ctx,-17,-10,16,'#ffe3a1',.22);
    polygon(ctx,[[-20,-13],[-17,-15],[-14,-13],[-14,-8],[-17,-6],[-20,-8]],abandoned?'#6a7a70':'#ffdda0',trim,.7);
    ctx.beginPath();ctx.moveTo(-17,-14);ctx.lineTo(-17,-7);ctx.moveTo(-20,-12.5);ctx.lineTo(-14,-12.5);ctx.moveTo(-20,-8.5);ctx.lineTo(-14,-8.5);ctx.strokeStyle=trim;ctx.lineWidth=.55;ctx.stroke();
  }
  if(style.decoration==='bunting'){
    ctx.beginPath();ctx.moveTo(-17,-21);ctx.quadraticCurveTo(-7,-11,0,-14);ctx.quadraticCurveTo(8,-12,17,-21);ctx.strokeStyle='#ddd3b5';ctx.lineWidth=.65;ctx.stroke();
    for(const [i,x,y]of [[0,-14,-18.6],[1,-8,-15.2],[2,-2,-14],[3,5,-14.5],[4,11,-16.6]])
      polygon(ctx,[[x-1.9,y],[x+1.9,y-.1],[x+.2,y+4.4]],i%2?accent:trim,'#f2e1b755',.3);
  }
  ctx.restore();
}

function archive(ctx,p,abandoned) {
  steps(ctx,0,5,46);box(ctx,0,0,44,27,27,p);
  ellipse(ctx,0,-29,18,10,p.dark,p.edge,.7);
  ctx.beginPath();ctx.ellipse(0,-31,15,19,0,Math.PI,TAU);ctx.lineTo(15,-31);ctx.closePath();ctx.fillStyle=abandoned?'#637575':'#a6ad8d';ctx.fill();ctx.strokeStyle=p.edge;ctx.stroke();
  ellipse(ctx,0,-31,15,8,p.top,p.edge,.7);
  for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(i*9,-34);ctx.quadraticCurveTo(i*10,-42,i*6,-45+Math.abs(i)*3);ctx.strokeStyle='#cbd0a299';ctx.lineWidth=.7;ctx.stroke();}
  ellipse(ctx,0,-31,16,8.5,null,'#e1d4aacc',.7);
  windows(ctx,0,0,44,27,p,!abandoned);windows(ctx,-18,-5,20,21,p,!abandoned);
  polygon(ctx,[[0,-7],[7,-11],[7,8],[0,12]],abandoned?'#263e42':p.light);
  if(!abandoned){glow(ctx,2,3,29,p.light,.3);polygon(ctx,[[0,9],[7,5],[23,14],[8,24]],'#ffcf8620');}
  box(ctx,19,8,11,8,9,p);
  for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(-17,-10-i*4);ctx.lineTo(-11,-7-i*4);ctx.strokeStyle='#d8d7b377';ctx.lineWidth=.55;ctx.stroke();}
}

function workshop(ctx,p,abandoned) {
  box(ctx,0,0,40,27,17,p);box(ctx,-10,-7,17,13,26,p);
  polygon(ctx,[[3,-16],[18,-23],[24,-10],[7,-4]],abandoned?'#4b6463':'#aa9270',p.edge,.8);
  windows(ctx,-10,-7,17,26,p,!abandoned);
  ellipse(ctx,10,-6,6,3,abandoned?'#253f43':'#e3a967','#edc68c77',.8);
  if(!abandoned)glow(ctx,10,-7,24,'#ffc485',.32);
  ctx.beginPath();ctx.moveTo(-8,-30);ctx.lineTo(-8,-46);ctx.lineTo(15,-36);ctx.moveTo(9,-38);ctx.lineTo(9,-22);ctx.strokeStyle='#a3aaa088';ctx.lineWidth=1.25;ctx.stroke();
  ellipse(ctx,8,-20,2.5,3,'#93a293');
  box(ctx,-20,13,9,7,4,p);box(ctx,-7,18,8,6,6,p);
  ctx.beginPath();ctx.moveTo(-21,7);ctx.lineTo(-16,4);ctx.moveTo(-8,10);ctx.lineTo(-3,7);ctx.strokeStyle='#d0c5a2';ctx.lineWidth=.8;ctx.stroke();
  for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(-5+i*3,-41+i*1.4);ctx.lineTo(-5+i*3,-35+i*1.4);ctx.strokeStyle='#d5c49d99';ctx.lineWidth=.6;ctx.stroke();}
}

function garden(ctx,p,abandoned,seed) {
  const rand=random(seed);
  ellipse(ctx,0,2,34,20,'#355a50','#83967a88',.8);
  for(let row=0;row<4;row++) {
    const yy=-9+row*7;
    polygon(ctx,[[-25,yy],[-3,yy-8],[23,yy],[1,yy+8]],'#243f3c','#6c87716b',.65);
    for(let i=0;i<7;i++) {
      const xx=-18+i*5,sy=yy-Math.abs(xx)*.1;
      ctx.strokeStyle=abandoned?'#526d5f':(i%2?'#bad09a':'#87b58b');ctx.lineWidth=.8;
      ctx.beginPath();ctx.moveTo(xx,sy);ctx.lineTo(xx,sy-3-rand()*4);ctx.stroke();
      ellipse(ctx,xx-.8,sy-3,2.3,.8,abandoned?'#5d7761':'#a4bc86');
    }
  }
  ctx.beginPath();ctx.ellipse(0,-7,30,24,0,Math.PI,TAU);ctx.strokeStyle='#a9b19b77';ctx.lineWidth=1;ctx.stroke();
  ctx.beginPath();ctx.ellipse(0,4,30,24,0,Math.PI,TAU);ctx.strokeStyle='#a9b19b77';ctx.stroke();
  ellipse(ctx,-27,6,4,2,'#8da89a','#b4c4a377',.8);
}

function ruin(ctx,p,abandoned) {
  steps(ctx,0,6,50);
  // A broken standing gate: three-dimensional stone faces and an empty center.
  const rx=25,ry=44,cy=-39,start=.25,end=5.85;
  for(let i=0;i<19;i++){
    const a=start+(end-start)*i/19,b=start+(end-start)*(i+.93)/19;
    const pts=[[Math.cos(a)*rx,cy+Math.sin(a)*ry],[Math.cos(b)*rx,cy+Math.sin(b)*ry],[Math.cos(b)*(rx-7),cy+Math.sin(b)*(ry-10)],[Math.cos(a)*(rx-7),cy+Math.sin(a)*(ry-10)]];
    polygon(ctx,pts.map(([x,y])=>[x+6,y+1]),'#263e46','#73827944',.5);
    polygon(ctx,[pts[0],pts[1],[pts[1][0]+6,pts[1][1]+1],[pts[0][0]+6,pts[0][1]+1]],'#344e53','#728a7c55',.5);
    polygon(ctx,pts,i%3?'#75867c':'#92a18a','#cad1ad70',.55);
    if(i%3===1){ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);ctx.lineTo(pts[2][0],pts[2][1]);ctx.strokeStyle='#d5d6ae88';ctx.lineWidth=.6;ctx.stroke();}
  }
  polygon(ctx,[[18,3],[29,-2],[34,5],[23,11]],'#697c75','#a9b89d66',.7);
  polygon(ctx,[[-27,10],[-13,5],[-8,13],[-23,19]],'#4d6a64','#899d8255',.7);
  ellipse(ctx,1,7,10,4,'#14343a','#a7bea04d',.7);
}

function spire(ctx,p,abandoned) {
  steps(ctx,0,5,35);box(ctx,0,0,21,16,12,p);
  polygon(ctx,[[-9,-9],[-5,-63],[0,-77],[5,-66],[9,-9],[0,-3]],p.left,p.edge,.65);
  polygon(ctx,[[0,-77],[5,-66],[9,-9],[0,-3]],p.right,p.edge,.65);
  polygon(ctx,[[-5,-63],[0,-77],[5,-66],[0,-52]],p.top,p.edge,.8);
  ctx.beginPath();ctx.moveTo(0,-60);ctx.lineTo(0,-16);ctx.strokeStyle=abandoned?'#536c73':p.light;ctx.lineWidth=1.4;ctx.stroke();
  for(let i=0;i<3;i++)ellipse(ctx,0,-20-i*10,12-i*2,4-i*.6,null,abandoned?'#67858a55':'#b1ede9b3',.65);
  if(!abandoned)glow(ctx,0,-44,24,p.light,.12);
}

function conduit(ctx,p,abandoned) {
  polygon(ctx,[[-37,6],[-28,13],[37,-5],[28,-12]],p.dark,p.edge,.7);
  for(let i=0;i<4;i++){
    const x=-27+i*18,y=7-i*5;
    box(ctx,x,y,11,9,17+(i%2)*5,p);
    ellipse(ctx,x,y-19-(i%2)*5,3.5,2,abandoned?'#547b83':p.light);
    if(i<3){ctx.beginPath();ctx.moveTo(x,y-16);ctx.quadraticCurveTo(x+9,y-8,x+18,y-21);ctx.strokeStyle=abandoned?'#4d717a':'#acf2e3b3';ctx.lineWidth=1;ctx.stroke();}
  }
  if(!abandoned)glow(ctx,0,-10,28,p.light,.1);
}

function nest(ctx,p,abandoned,seed) {
  const rand=random(seed);ellipse(ctx,0,4,36,20,p.dark,p.edge,.7);
  for(let i=0;i<8;i++){
    const a=i/8*TAU,x=Math.cos(a)*22,y=Math.sin(a)*11;
    const h=13+rand()*24;
    ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+12,y-h*.25,x-7,y-h*.8,x*.65,y-h);ctx.strokeStyle=p.left;ctx.lineWidth=5;ctx.stroke();
    ctx.strokeStyle=p.edge;ctx.lineWidth=.6;ctx.stroke();
    ellipse(ctx,x*.65,y-h,11,6,abandoned?'#466358':p.top,p.edge,.7);
    ellipse(ctx,x*.65,y-h-1,7,3,abandoned?'#60796a':'#a1c991','#c9dfae77',.6);
    if(!abandoned)ellipse(ctx,x*.65,y-h-1,1.6,1,p.light);
  }
  ellipse(ctx,0,-24,17,9,abandoned?'#5d7762':'#8fb783',p.edge,.6);
  for(let i=0;i<5;i++){const x=-10+i*5;ctx.beginPath();ctx.moveTo(x,-25);ctx.lineTo(x+3,-29);ctx.strokeStyle=p.light;ctx.lineWidth=.6;ctx.stroke();}
}

function bridge(ctx,p,abandoned) {
  for(let i=0;i<7;i++){const x=-30+i*10;box(ctx,x,-x*.25,11,13,6+Math.sin(i/6*Math.PI)*7,p);}
  ctx.beginPath();ctx.moveTo(-34,0);ctx.quadraticCurveTo(0,-25,34,-16);ctx.strokeStyle=abandoned?'#566c6c':p.light;ctx.lineWidth=1;ctx.stroke();
}

function memorial(ctx,p,abandoned) {
  steps(ctx,0,5,29);box(ctx,0,0,16,10,39,p);
  for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(2,-29+i*6);ctx.lineTo(6,-31+i*6);ctx.strokeStyle=p.light;ctx.lineWidth=.75;ctx.stroke();}
  ellipse(ctx,-12,7,4,2,abandoned?'#526b59':'#abbf8c');
}

function shell(ctx,p) {
  // Dormancy preserves a ceramic body; it cannot turn into an ancient gate.
  polygon(ctx,[[-16,3],[-7,-3],[14,1],[17,6],[6,11],[-14,7]],p.dark,p.edge,.7);
  polygon(ctx,[[-10,-2],[-2,-7],[11,-2],[14,2],[6,7],[-9,3]],p.left,p.edge,.6);
  polygon(ctx,[[-2,-7],[11,-2],[6,2],[-8,-2]],p.top,p.edge,.6);
  ctx.beginPath();ctx.moveTo(-7,0);ctx.lineTo(8,3);ctx.strokeStyle='#829d9c';ctx.lineWidth=.6;ctx.stroke();
  ellipse(ctx,-12,3,3,2,'#3d636a','#9bb4a955',.6);
}

export function structureSize(kind,form) {
  if(kind==='ruin'&&form==='synthetic')return [36,24];
  if(kind==='ruin'&&form==='collective')return [77,66];
  return {home:[32,40],archive:[48,55],garden:[68,44],workshop:[47,49],ruin:[63,88],spire:[38,80],conduit:[78,44],nest:[77,66],bridge:[80,32],memorial:[32,44]}[kind] || [32,40];
}

export function drawStructure(ctx,structure,x,y,selected=false,conditions={},style) {
  const { kind='home' }=structure;
  const abandoned=structure.abandonedAt!==undefined&&structure.abandonedAt!==null;
  let p=abandoned?palettes.old:(kind==='spire'||kind==='conduit'?palettes.cyan:kind==='nest'||kind==='garden'?palettes.jade:kind==='ruin'||kind==='memorial'?palettes.old:palettes.amber);
  if(structure.form==='collective'&&(abandoned||conditions.collectiveHydration<50))p={...palettes.old,top:'#777c62',left:'#525d50',right:'#364c46',light:'#a8ab80'};
  if(structure.form==='synthetic'&&(abandoned||conditions.syntheticIntegrity<50))p={...palettes.old,light:'#779eaa'};
  const visualKind=kind==='ruin'&&structure.form==='synthetic'?'shell':kind==='ruin'&&structure.form==='collective'?'nest':kind;
  ctx.save();ctx.translate(x,y);
  ellipse(ctx,8,8,kind==='garden'?35:25,10,'#06182066');
  if(!abandoned&&kind!=='ruin'&&kind!=='memorial')glow(ctx,0,5,kind==='nest'?51:41,p.light,.085);
  if(selected)ellipse(ctx,0,6,structureSize(kind,structure.form)[0]*.63,15,'#d6c28b14','#efdb9caa',.9);
  const seed=[...structure.id].reduce((sum,c)=>sum+c.charCodeAt(0),0);
  ({home,archive,workshop,garden,ruin,spire,conduit,nest,bridge,memorial,shell}[visualKind]||home)(ctx,p,abandoned,seed,kind==='home'?style:undefined);
  if(structure.form==='mixed'){
    for(let i=0;i<3;i++){
      const x=-17+i*15,y=11-i*4;
      ctx.beginPath();ctx.moveTo(x-8,y+6);ctx.quadraticCurveTo(x-10,y-3,x,y);ctx.quadraticCurveTo(x+4,y+4,x+12,y-2);ctx.strokeStyle='#c0dc9fbb';ctx.lineWidth=1.1;ctx.stroke();
      ellipse(ctx,x+4,y+2,3.3,1.5,'#a3c98f');
      ellipse(ctx,x,y-1,2,1,'#f0d298');
    }
  }
  if(conditions.cultureId==='culture-carriers'&&(kind==='home'||kind==='workshop')){
    polygon(ctx,[[4,-12],[11,-15],[11,-4],[4,-1]],'#3b6871','#b5e0d777',.5);
    for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(5.5,-10+i*2.5);ctx.lineTo(9.5,-12+i*2.5);ctx.strokeStyle='#c3e3d2';ctx.lineWidth=.5;ctx.stroke();}
  }
  if(structure.damaged){
    ctx.beginPath();ctx.moveTo(-17,-23);ctx.lineTo(-12,-17);ctx.lineTo(-15,-11);ctx.lineTo(-10,-4);ctx.strokeStyle='#152f39';ctx.lineWidth=1.6;ctx.stroke();
    ctx.beginPath();ctx.moveTo(-16,-22);ctx.lineTo(-12,-17);ctx.lineTo(-14,-11);ctx.lineTo(-10,-4);ctx.strokeStyle='#a3e4da77';ctx.lineWidth=.5;ctx.stroke();
    ellipse(ctx,-11,6,9,3.5,'#7bb6b22e','#bbded344',.5);
  }
  if(abandoned){for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(-14+i*9,10);ctx.lineTo(-12+i*9,5-i%2*3);ctx.strokeStyle='#8a9a6f88';ctx.lineWidth=.8;ctx.stroke();}}
  ctx.restore();
}

// Faces and clothes belong to a person's identity. Changing jobs must not turn
// Ves into Ivo: role-specific tools may change, but their appearance stays theirs.
const peopleStyles={
  'c-nera':{coat:'#d2a266',shade:'#8a6846',skin:'#d8a276',hair:'#403c35',accent:'#f4e7c4',shape:'bun',width:3.8},
  'c-senn':{coat:'#9dc58a',shade:'#547c59',skin:'#d9af7d',hair:'#61523c',accent:'#ded39b',shape:'hat',width:3.3},
  'c-ivo':{coat:'#cf9166',shade:'#815841',skin:'#cfaa89',hair:'#d8dcc8',accent:'#f1dcba',shape:'beard',width:3.7},
  'c-tavi':{coat:'#83bacc',shade:'#486c84',skin:'#bd8b66',hair:'#2b3d44',accent:'#efd193',shape:'glasses',width:3.1},
  'c-daro':{coat:'#d49b90',shade:'#8d635f',skin:'#a77554',hair:'#343e3b',accent:'#efc979',shape:'curls',width:3.6},
  'c-ves':{coat:'#e0bd68',shade:'#908044',skin:'#e7ba89',hair:'#6b4f3b',accent:'#8098c6',shape:'hood',width:3},
  'c-oren':{coat:'#93a9c9',shade:'#536e8b',skin:'#ba8d69',hair:'#413d36',accent:'#d9dfb7',shape:'swept',width:3.4},
  'c-mira':{coat:'#97c8b5',shade:'#48796e',skin:'#c49d7c',hair:'#314741',accent:'#f4d795',shape:'knot',width:3.4},
  'c-lio':{coat:'#dcc278',shade:'#927f4e',skin:'#cda27c',hair:'#594433',accent:'#94b7c4',shape:'swept',width:2.8},
};

export function drawCharacter(ctx,character,x,y,selected=false,clock=0,moving=false,reduced=false,style) {
  const original=peopleStyles[character.id]||{coat:'#d7c7a0',shade:'#8a8064',skin:'#d5ad85',hair:'#494439',accent:'#e7dbb6',shape:'swept',width:3.3};
  const color=resolveStyleColor(style?.color);
  const p=color?{...original,coat:color.coat,shade:color.shade,accent:color.accent}:original;
  const step=moving&&!reduced?Math.sin(clock*.014)*.85:0;
  const body=p.width;
  ctx.save();ctx.translate(x,y);ctx.lineCap='round';ctx.lineJoin='round';
  ellipse(ctx,1.5,1,5.5,2.1,'#061e2699');
  if(selected){ellipse(ctx,0,1,8.7,4,'#f5dba31a','#ffe0a2',.8);ellipse(ctx,0,1,10.5,4.8,null,'#ffe0a344',.5);}

  // Rounded boots, a sturdy little coat, and a larger readable face retain the
  // world's miniature scale without reducing its inhabitants to map markers.
  ctx.strokeStyle='#243c42';ctx.lineWidth=1.8;
  ctx.beginPath();ctx.moveTo(-1.5,-3.5);ctx.lineTo(-1.8-step,.3);ctx.moveTo(1.5,-3.5);ctx.lineTo(1.8+step,.3);ctx.stroke();
  ellipse(ctx,-1.9-step,.5,1.5,.9,'#2a4146');ellipse(ctx,2.2+step,.5,1.6,.9,'#2a4146');
  if(character.role==='pattern carrier'){
    ctx.beginPath();ctx.roundRect(-5.7,-9.7,4.7,7.4,1.1);ctx.fillStyle='#ad926d';ctx.fill();ctx.strokeStyle='#e0c59b';ctx.lineWidth=.5;ctx.stroke();
    ctx.beginPath();ctx.moveTo(-5.1,-7.9);ctx.lineTo(-1.7,-7.9);ctx.strokeStyle='#665f4c';ctx.lineWidth=.6;ctx.stroke();
  }
  ctx.beginPath();ctx.moveTo(-body,-8);ctx.quadraticCurveTo(-body,-10.1,-1.3,-10.2);ctx.lineTo(1.3,-10.2);ctx.quadraticCurveTo(body,-9.7,body,-7.5);ctx.lineTo(body+.5,-2.6);ctx.quadraticCurveTo(0,-1.3,-body-.5,-2.6);ctx.closePath();ctx.fillStyle=p.coat;ctx.fill();ctx.strokeStyle='#e8ddbd66';ctx.lineWidth=.4;ctx.stroke();
  ctx.beginPath();ctx.moveTo(1.9,-9.3);ctx.quadraticCurveTo(body,-6.3,body+.5,-2.6);ctx.lineTo(1,-2);ctx.closePath();ctx.fillStyle=p.shade;ctx.fill();
  ctx.beginPath();ctx.moveTo(-body+.2,-7.9);ctx.lineTo(-body-1,-4.5-step*.25);ctx.moveTo(body-.2,-7.8);ctx.lineTo(body+1.2,-5.3+step*.25);ctx.strokeStyle=p.coat;ctx.lineWidth=1.8;ctx.stroke();
  ellipse(ctx,-body-1,-4.2-step*.25,.85,1,p.skin);ellipse(ctx,body+1.2,-5.1+step*.25,.85,1,p.skin);
  if(character.role==='storekeeper'||character.role==='mender'){
    const apron=character.role==='storekeeper'?p.accent:'#75573f';
    polygon(ctx,[[-1.9,-9],[1.9,-9],[2.5,-2.7],[-2.5,-2.7]],apron,'#f4e0bb55',.35);
    ctx.beginPath();ctx.moveTo(-1.3,-5.8);ctx.quadraticCurveTo(0,-5.2,1.3,-5.8);ctx.strokeStyle=character.role==='storekeeper'?'#c2b18e':'#dab68a';ctx.lineWidth=.45;ctx.stroke();
  }else{
    ctx.beginPath();ctx.moveTo(-2.4,-3.9);ctx.lineTo(2.6,-3.9);ctx.strokeStyle=p.shade;ctx.lineWidth=.55;ctx.stroke();
    ellipse(ctx,.2,-3.9,.55,.45,p.accent);
  }
  if(p.shape==='hood'||p.shape==='curls'){
    polygon(ctx,[[-3,-9.3],[2.7,-9.3],[2.2,-7.4],[-1,-7.1],[-3.8,-4],[-3.4,-8]],p.accent,'#f8e4b344',.35);
    if(p.shape==='curls'){ctx.beginPath();ctx.moveTo(-2.1,-7.8);ctx.lineTo(-3.4,-4.4);ctx.strokeStyle='#a56e4b';ctx.lineWidth=.5;ctx.stroke();}
  }

  // Personal silhouettes: the hair and headwear remain recognizable in a crowd.
  if(p.shape==='bun')ellipse(ctx,-2.7,-14.5,1.8,1.7,p.hair,'#bba78b77',.4);
  if(p.shape==='knot'){ellipse(ctx,-2.5,-13.7,2,2.3,p.hair);ellipse(ctx,-3.1,-10.8,1.1,2,p.hair);}
  if(p.shape==='hood'){
    ctx.beginPath();ctx.moveTo(-3.4,-10);ctx.quadraticCurveTo(-4,-15.9,-.7,-17);ctx.quadraticCurveTo(3.9,-16.3,3.4,-10);ctx.closePath();ctx.fillStyle=p.coat;ctx.fill();ctx.strokeStyle='#f5d690aa';ctx.lineWidth=.45;ctx.stroke();
  }
  ellipse(ctx,-2.8,-11.2,.6,.9,p.skin);ellipse(ctx,2.8,-11.2,.6,.9,p.skin);
  ellipse(ctx,.2,-11.9,2.9,3.25,p.skin,'#f1d6ad66',.4);
  ctx.beginPath();ctx.ellipse(.1,-13.2,3.05,2.3,0,Math.PI,TAU);ctx.lineTo(2.3,-12.7);ctx.quadraticCurveTo(.5,-14.1,-2.7,-12.1);ctx.closePath();ctx.fillStyle=p.hair;ctx.fill();
  if(p.shape==='curls')for(const [xx,yy,rr] of [[-2.6,-14,1.5],[-.8,-15.1,1.6],[1.1,-14.9,1.6],[2.7,-13.7,1.3]])ellipse(ctx,xx,yy,rr,rr,p.hair);
  if(p.shape==='swept'){ctx.beginPath();ctx.moveTo(-2.4,-13.8);ctx.quadraticCurveTo(-.8,-16.6,2.7,-14.5);ctx.quadraticCurveTo(.1,-13.6,-2.4,-13.8);ctx.fillStyle=p.hair;ctx.fill();}
  // Eyes and a tiny nose are large enough to survive a phone's neighborhood view.
  ellipse(ctx,-.85,-11.7,.33,.46,'#313e3c');ellipse(ctx,1.2,-11.7,.33,.46,'#313e3c');
  ellipse(ctx,.35,-10.85,.45,.33,'#b67d5b');
  ctx.beginPath();ctx.moveTo(-.5,-9.85);ctx.quadraticCurveTo(.35,-9.5,1.05,-9.85);ctx.strokeStyle='#815944';ctx.lineWidth=.34;ctx.stroke();
  if(p.shape==='beard'){
    ctx.beginPath();ctx.moveTo(-2.4,-10.6);ctx.quadraticCurveTo(.4,-7.5,2.6,-10.5);ctx.lineTo(1.7,-9);ctx.quadraticCurveTo(.1,-7.7,-1.6,-9.2);ctx.closePath();ctx.fillStyle=p.hair;ctx.fill();
    ellipse(ctx,-.45,-10.1,.95,.42,p.hair);ellipse(ctx,1,-10.1,.95,.42,p.hair);
    ctx.beginPath();ctx.moveTo(-1.6,-12.5);ctx.lineTo(-.3,-12.4);ctx.moveTo(.8,-12.5);ctx.lineTo(2,-12.5);ctx.strokeStyle=p.hair;ctx.lineWidth=.5;ctx.stroke();
  }
  if(p.shape==='glasses'){
    ellipse(ctx,-.85,-11.8,1.1,.9,null,'#ead9b3',.4);ellipse(ctx,1.25,-11.8,1.1,.9,null,'#ead9b3',.4);
    ctx.beginPath();ctx.moveTo(.2,-11.9);ctx.lineTo(.3,-11.9);ctx.moveTo(-2,-12);ctx.lineTo(-2.8,-12.2);ctx.strokeStyle='#ead9b3';ctx.lineWidth=.4;ctx.stroke();
  }
  if(p.shape==='hat'){
    ellipse(ctx,0,-14.6,5.1,1.25,p.accent,'#f1e1ab88',.4);
    ellipse(ctx,-.1,-15.7,2.8,1.65,'#c5be87','#ede0ab66',.4);
    ctx.beginPath();ctx.moveTo(-2.5,-14.9);ctx.quadraticCurveTo(0,-14.3,2.5,-14.9);ctx.strokeStyle='#82925c';ctx.lineWidth=.65;ctx.stroke();
    polygon(ctx,[[2.5,-15],[4,-16.5],[3.5,-14.7]],'#9ec27d');
  }
  if(p.shape==='knot'){ellipse(ctx,2.9,-10.5,.65,.85,p.accent);ctx.beginPath();ctx.moveTo(-1.9,-14.6);ctx.lineTo(.5,-14.7);ctx.strokeStyle=p.accent;ctx.lineWidth=.45;ctx.stroke();}

  // Optional player styling follows the resident's real, modeled location.
  if(style?.accessory==='cap'){
    ctx.beginPath();ctx.moveTo(-3.4,-14.1);ctx.quadraticCurveTo(-3.7,-18,0,-18.2);ctx.quadraticCurveTo(3.4,-18.1,3.4,-14.1);ctx.closePath();ctx.fillStyle=p.accent;ctx.fill();ctx.strokeStyle=p.shade;ctx.lineWidth=.5;ctx.stroke();
    ellipse(ctx,.6,-14.2,4.5,.8,p.coat,'#ead9af88',.4);ellipse(ctx,0,-18.3,.7,.55,p.coat);
  }
  if(style?.accessory==='scarf'){
    ctx.beginPath();ctx.moveTo(-2.8,-9);ctx.quadraticCurveTo(0,-7.2,3,-9);ctx.strokeStyle=p.accent;ctx.lineWidth=1.9;ctx.stroke();
    polygon(ctx,[[-2.8,-9],[-.9,-8.1],[-2.2,-3.8],[-4,-4.6]],p.accent,p.shade,.35);
    ctx.beginPath();ctx.moveTo(-3.3,-5.1);ctx.lineTo(-2.2,-4.8);ctx.strokeStyle=p.coat;ctx.lineWidth=.4;ctx.stroke();
  }
  if(style?.accessory==='flower'){
    for(let i=0;i<5;i++)ellipse(ctx,3+Math.cos(i*TAU/5)*1.1,-14.1+Math.sin(i*TAU/5)*1.1,.85,.85,'#efcca8');
    ellipse(ctx,3,-14.1,.6,.6,'#c59959');polygon(ctx,[[2.7,-13.3],[4.9,-12.7],[4,-14.1]],'#96b782');
  }

  // Tools communicate a job at a glance; they do not invent a modeled action.
  if(character.role==='gardener'){
    ctx.beginPath();ctx.moveTo(4.7,-6.5);ctx.lineTo(6.8,-1.6);ctx.strokeStyle='#dcc795';ctx.lineWidth=.85;ctx.stroke();
    polygon(ctx,[[5.6,-2.5],[7.6,-3],[8.1,-.7],[7.3,.1]],'#b4d6ce','#e0e5c4',.4);
    ellipse(ctx,4.6,-6,.85,.75,p.skin);
  }
  if(character.role==='archivist'){
    polygon(ctx,[[3.3,-7.3],[6.6,-8],[7.4,-2.9],[4.1,-2]],'#d9ad66','#f5ddaa',.45);
    polygon(ctx,[[3.7,-6.8],[6.2,-7.4],[6.8,-3.4],[4.4,-2.8]],'#f1e7c4');
    for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(4.3+i*.15,-5.9+i);ctx.lineTo(6.1+i*.15,-6.3+i);ctx.strokeStyle='#a7a17d';ctx.lineWidth=.3;ctx.stroke();}
    ellipse(ctx,4.1,-4.7,.75,.8,p.skin);
  }
  if(character.role==='mender'){
    ctx.beginPath();ctx.moveTo(4.2,-6);ctx.lineTo(6.6,-1);ctx.strokeStyle='#d6bb8d';ctx.lineWidth=1;ctx.stroke();
    polygon(ctx,[[3.2,-7.8],[6.4,-6.7],[5.7,-4.7],[2.6,-5.8]],'#b3c5c2','#e1dfbb',.4);
    ellipse(ctx,4.7,-4.5,.8,.8,p.skin);
  }
  if(character.role==='storekeeper'){
    ellipse(ctx,5,-4.5,3.8,1.3,'#f0d89f','#b79d6d',.4);ellipse(ctx,5,-4.6,2.7,.7,null,'#d7bb85',.35);
    ellipse(ctx,3.4,-4,.8,.65,p.skin);
  }
  if(character.role==='braider'){
    ellipse(ctx,5,-4.6,3.2,4.2,'#bcbb86','#efdb9b',.55);
    ellipse(ctx,5,-4.6,2.2,3.1,null,'#7d9473',.45);
    for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(3,-4.6+i*1.7);ctx.lineTo(7,-4.6+i*1.7);ctx.strokeStyle='#dcca8c';ctx.lineWidth=.5;ctx.stroke();}
    ellipse(ctx,3.3,-5,.8,.85,p.skin);
  }
  if(character.role==='apprentice'){
    polygon(ctx,[[-4.8,-4.6],[-2.4,-4.5],[-2.5,-1.8],[-5,-2]],'#ac8654','#e6cb98',.35);
    ellipse(ctx,-3.8,-3.4,.35,.35,p.accent);
  }
  if(character.role==='pattern carrier'||character.role==='channel keeper'){
    ctx.beginPath();ctx.moveTo(5.2,.5);ctx.lineTo(5.2,-14.2);
    if(character.role==='channel keeper')ctx.quadraticCurveTo(8.7,-16.2,8.7,-12.8);
    ctx.strokeStyle=character.role==='channel keeper'?'#cae0c2':'#c8c5a0';ctx.lineWidth=.8;ctx.stroke();
    ellipse(ctx,5.1,-5.7,.8,.85,p.skin);
  }
  ctx.restore();
}
