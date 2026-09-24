import { ellipse, polygon, random } from './landscape.js';

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

function home(ctx,p,abandoned) {
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

export function drawStructure(ctx,structure,x,y,selected=false,conditions={}) {
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
  ({home,archive,workshop,garden,ruin,spire,conduit,nest,bridge,memorial,shell}[visualKind]||home)(ctx,p,abandoned,seed);
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

export function drawCharacter(ctx,character,x,y,selected=false,clock=0,moving=false,reduced=false) {
  const palettesByRole={grower:'#b6d3a0',gardener:'#b6d3a0',keeper:'#d7ccae',storekeeper:'#edd4aa',maker:'#f1b983',mender:'#f1b983',reader:'#badbdc',archivist:'#badbdc',braider:'#cf9e91',apprentice:'#dacb96','pattern carrier':'#bcd2d8','channel keeper':'#9ecab5',pathfinder:'#d7a791',courier:'#d7a791',cartographer:'#aac9d4'};
  const color=palettesByRole[character.role]||'#ead8b2';
  ctx.save();ctx.translate(x,y);
  const step=moving&&!reduced?Math.sin(clock*.014)*.6:0;
  ellipse(ctx,2,1,4,1.8,'#061e268c');
  if(selected)ellipse(ctx,0,1,8,4,null,'#ffe2a3',.7);
  ctx.strokeStyle='#1e3840';ctx.lineWidth=1.2;
  ctx.beginPath();ctx.moveTo(-1,-2);ctx.lineTo(-1.5-step,1);ctx.moveTo(1,-2);ctx.lineTo(1.5+step,1);ctx.stroke();
  polygon(ctx,[[-2,-7],[2,-7],[3,-2],[-3,-2]],color,'#f3e4bd66',.35);
  polygon(ctx,[[1,-7],[3,-2],[0,-2]],'#44565c80');
  ellipse(ctx,0,-8.7,1.9,2.2,'#e0c7a3');
  ctx.beginPath();ctx.ellipse(0,-9.2,1.9,1.9,0,Math.PI,TAU);ctx.fillStyle=character.role==='mender'?'#c5c7ab':'#3d4546';ctx.fill();
  if(character.role==='gardener'){
    ellipse(ctx,0,-10,4,1,'#b7ba8e');ellipse(ctx,0,-11,2.1,1.3,'#a2a77e');
    ctx.beginPath();ctx.moveTo(4,-4);ctx.lineTo(6,1);ctx.strokeStyle='#c9d7b2';ctx.lineWidth=.7;ctx.stroke();
    polygon(ctx,[[5,1],[7,0],[7,2],[6,3]],'#93b9a9');
  }
  if(character.role==='archivist'){
    polygon(ctx,[[2,-5],[5,-6],[6,-2],[3,-1]],'#daca99','#f4e3bd',.35);
    ctx.beginPath();ctx.moveTo(3,-5);ctx.lineTo(4,-2);ctx.strokeStyle='#918c70';ctx.lineWidth=.45;ctx.stroke();
  }
  if(character.role==='mender'){
    ctx.beginPath();ctx.moveTo(4,-4);ctx.lineTo(6,0);ctx.strokeStyle='#b5b195';ctx.lineWidth=.8;ctx.stroke();
    polygon(ctx,[[4,-6],[7,-5],[6,-3],[3,-4]],'#aab9ac');
    polygon(ctx,[[-2,-6],[1,-6],[1,-2],[-2,-2]],'#735d4d');
  }
  if(character.role==='storekeeper'){
    polygon(ctx,[[-1.5,-6],[1.5,-6],[2,-2],[-2,-2]],'#ece0c0');
    ellipse(ctx,4,-3,3,1,'#f0d5a2','#bda87a',.35);
  }
  if(character.role==='braider'){
    ellipse(ctx,4,-3,2.7,3.5,'#b9b68b','#e3d19c',.4);
    ctx.beginPath();ctx.moveTo(2,-3);ctx.lineTo(6,-3);ctx.moveTo(4,-6);ctx.lineTo(4,0);ctx.strokeStyle='#777e65';ctx.lineWidth=.35;ctx.stroke();
  }
  if(character.role==='apprentice')polygon(ctx,[[-2,-8],[0,-11.5],[2,-8],[0,-9]],'#d8c496');
  if(character.role==='pattern carrier'){
    box(ctx,-3,-2,3,2,4,{top:'#809dab',left:'#58717e',right:'#455862',edge:'#c2d6c377'});
    ctx.beginPath();ctx.moveTo(4,-9);ctx.lineTo(5,1);ctx.strokeStyle='#b9cdbd';ctx.lineWidth=.6;ctx.stroke();
  }
  if(character.role==='channel keeper'){
    ctx.beginPath();ctx.moveTo(4,1);ctx.lineTo(4,-12);ctx.quadraticCurveTo(7,-13,7,-10);ctx.strokeStyle='#b5cbbb';ctx.lineWidth=.6;ctx.stroke();
  }
  ctx.beginPath();ctx.moveTo(3,-5);ctx.lineTo(5,-1);ctx.strokeStyle=color;ctx.lineWidth=.8;ctx.stroke();
  ctx.restore();
}
