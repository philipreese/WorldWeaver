import { DECOR_SLOTS, PET_COLORS, CHANNEL_TILES, DEFAULT_CHANNEL_TURNS, channelPorts, channelFlow, defaultNeighborhood } from '../neighborhood.js';
import { resolveStyleColor } from '../customization.js';

const TAU = Math.PI * 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const mix = (a, b, p) => a + (b - a) * p;
const smooth = n => n * n * (3 - 2 * n);
const rng = (seed = 8197) => () => { seed = Math.imul(seed ^ seed >>> 15, 1 | seed); seed ^= seed + Math.imul(seed ^ seed >>> 7, 61 | seed); return ((seed ^ seed >>> 14) >>> 0) / 4294967296; };
const BOARD = { x: 711, y: 332, size: 48, gap: 3 };
const LAWN = { x: 632, y: 557, rx: 177, ry: 93 };
const PET_HOME = { x: 650, y: 560 };
const DIRECTIONS = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
const INSTALLED_CHANNEL_TURNS = Object.freeze(DEFAULT_CHANNEL_TURNS.map((turn, index) => (turn + ([5, 6].includes(index) ? 1 : 0)) % 4));

function ellipse(c, x, y, rx, ry, fill, stroke, width = 1) {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}
function polygon(c, points, fill, stroke, width = 1) {
  c.beginPath(); c.moveTo(...points[0]); for (const p of points.slice(1)) c.lineTo(...p); c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}
function line(c, points, color, width = 1) {
  c.beginPath(); c.moveTo(...points[0]); for (const p of points.slice(1)) c.lineTo(...p);
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
}
function curve(c, points, color, width = 1) {
  c.beginPath(); c.moveTo(...points[0]); c.bezierCurveTo(...points[1], ...points[2], ...points[3]);
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.stroke();
}
function round(c, x, y, w, h, r, fill, stroke, width = 1) {
  c.beginPath(); c.roundRect(x, y, w, h, r);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}
function glow(c, x, y, r, center, edge = '#f9cf7800') {
  const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, center); g.addColorStop(1, edge);
  ellipse(c, x, y, r, r, g);
}
function stone(c, x, y, w = 24, h = 12, color = '#b4b196') {
  polygon(c, [[x-w/2,y],[x-w*.3,y-h*.6],[x+w*.33,y-h*.7],[x+w/2,y-h*.1],[x+w*.35,y+h*.35],[x-w*.3,y+h*.35]], color, '#50685875', 1);
  line(c, [[x-w*.3,y-h*.55],[x+w*.3,y-h*.64],[x+w*.45,y-h*.1]], '#e4dcb763', 1.2);
}
function leaf(c, x, y, angle, length, color) {
  c.save(); c.translate(x,y); c.rotate(angle); c.beginPath(); c.moveTo(0,0); c.quadraticCurveTo(length*.55,-length*.55,length,0); c.quadraticCurveTo(length*.4,length*.25,0,0); c.fillStyle=color; c.fill(); c.restore();
}
function fern(c, x, y, scale = 1, colors = ['#28594e','#58895b','#8bab66']) {
  c.save(); c.translate(x,y); c.scale(scale,scale);
  for(let arm=0;arm<7;arm++) { const angle = -2.65 + arm*.36, length=28+Math.sin(arm*2)*9;
    const ex=Math.cos(angle)*length,ey=Math.sin(angle)*length;
    curve(c,[[0,0],[ex*.18,ey*.75],[ex*.7,ey*.95],[ex,ey]],colors[1],1.2);
    for(let n=1;n<7;n++) {const p=n/7, px=ex*p,py=ey*(.4*p+.6*Math.sqrt(p)); leaf(c,px,py,angle+.85,9*(1-p*.7),colors[n%3]);leaf(c,px,py,angle-.95,9*(1-p*.7),colors[(n+1)%3]);}
  } c.restore();
}
function flowers(c, x, y, seed=1, scale=1, palette=['#f4c586','#efb4b0','#d7dda2']) {
  const r=rng(seed); c.save();c.translate(x,y);c.scale(scale,scale);
  for(let i=0;i<13;i++) {const px=(r()-.5)*45,py=-r()*23;
    curve(c,[[px*.5,3],[px,py*.1],[px-3,py],[px,py]],'#68845a',1);
    leaf(c,px*.7,py*.4,-.5,7,'#8f9d62');
    const col=palette[i%palette.length];for(let j=0;j<5;j++)ellipse(c,px+Math.cos(j*TAU/5)*2.4,py+Math.sin(j*TAU/5)*2.1,2.3,2,col);
    ellipse(c,px,py,1.6,1.6,'#fbe4ab');
  } c.restore();
}
function tree(c, x, y, scale=1, seed=1, golden=false) {
  const r=rng(seed);c.save();c.translate(x,y);c.scale(scale,scale);
  ellipse(c,7,7,58,20,'#173e3c66');
  curve(c,[[0,5],[5,-30],[-5,-80],[-15,-128]],'#4b5147',17);
  curve(c,[[-1,2],[8,-44],[-9,-89],[-14,-128]],'#a29469',5);
  for(const [a,b,d,e] of [[-5,-60,-46,-104],[0,-83,38,-128],[-12,-110,-44,-152]])curve(c,[[a,b],[d*.3,b-10],[d,e+6],[d,e]],'#66654d',7);
  const shades=golden?['#8b854c','#b09d54','#d0b463','#dbbf73','#a1a46d']:['#2e6557','#427b60','#649269','#90aa74','#789f70'];
  const lobes=[[-48,-117,37,30],[-21,-152,42,36],[19,-150,35,29],[47,-121,35,28],[-3,-116,58,35],[27,-96,32,22]];
  for(const [lx,ly,rx,ry]of lobes){ellipse(c,lx+3,ly+7,rx,ry,'#234d4433');ellipse(c,lx,ly,rx,ry,shades[0]);
    for(let i=0;i<43;i++){const a=r()*TAU,d=Math.sqrt(r()),px=lx+Math.cos(a)*rx*d,py=ly+Math.sin(a)*ry*d;ellipse(c,px,py,4+r()*9,2+r()*6,shades[1+Math.floor(r()*4)]);}
  }
  for(let i=0;i<25;i++)leaf(c,(r()-.5)*130,-93-r()*85,r()*TAU,6+r()*7,shades[2+i%3]);
  c.restore();
}
function lantern(c, x, y, size=1, light=true) {
  c.save();c.translate(x,y);c.scale(size,size);
  if(light)glow(c,0,-19,45,'#ffcc6a39');
  ellipse(c,3,3,12,4,'#26392f66');
  line(c,[[-8,-7],[-8,-31],[8,-31],[8,-7]],'#765a3d',2);
  round(c,-7,-30,14,23,3,'#edc880','#b29051',1);
  round(c,-5,-29,10,19,3,'#ffe4a1');line(c,[[0,-28],[0,-9]],'#e0b56c',1);
  polygon(c,[[-11,-32],[0,-38],[11,-32],[8,-29],[-8,-29]],'#6a7560','#c6b380',1);
  polygon(c,[[-10,-9],[10,-9],[8,-4],[-8,-4]],'#69735c','#bfb075',1);
  c.beginPath();c.arc(0,-40,4,Math.PI,TAU);c.strokeStyle='#aa9d70';c.lineWidth=1.8;c.stroke();
  c.restore();
}

function drawBackdrop(c) {
  const sky=c.createLinearGradient(0,0,0,760);sky.addColorStop(0,'#243b4f');sky.addColorStop(.25,'#6d8b8e');sky.addColorStop(.55,'#b8b494');sky.addColorStop(1,'#334e43');c.fillStyle=sky;c.fillRect(-900,-500,2800,1800);
  glow(c,717,143,210,'#f8d5a329','#edce9600');ellipse(c,727,86,29,29,'#f2dfb995');ellipse(c,738,79,27,27,'#6d888b');
  const r=rng(175);for(let i=0;i<48;i++)ellipse(c,r()*1000,r()*180,.4+r()*.8,.5,'#eeeac46c');
  polygon(c,[[-200,255],[-40,140],[82,184],[181,110],[280,186],[409,118],[531,187],[675,121],[812,194],[917,148],[1150,273],[1150,390],[-200,390]],'#527774');
  polygon(c,[[-100,291],[74,239],[150,265],[244,219],[348,261],[460,193],[560,250],[683,213],[806,256],[940,201],[1100,272],[1150,450],[-100,450]],'#3e6860');
  // Broken aqueducts belong to the backdrop; no new modeled settlement is implied.
  c.save();c.globalAlpha=.45;
  for(let i=0;i<4;i++){const x=680+i*54,y=200+i*6;polygon(c,[[x,y],[x,y-90+i*4],[x+18,y-91+i*4],[x+18,y]],'#314e53');}
  curve(c,[[697,127],[706,94],[724,95],[735,131]],'#345458',13);curve(c,[[751,134],[763,105],[779,110],[788,140]],'#345458',12);
  polygon(c,[[824,233],[824,155],[838,153],[838,231]],'#36575a');line(c,[[683,113],[753,122]],'#afbd9b99',3);
  for(let i=0;i<3;i++)polygon(c,[[470+i*35,250],[475+i*35,170+i*17],[486+i*35,174+i*17],[487+i*35,255]],'#40635f');
  c.restore();
  for(let i=0;i<21;i++){const x=i*57-80,y=278+Math.sin(i*1.3)*24;ellipse(c,x,y,55,30,i%2?'#315c51':'#3b6758');}
  const mist=c.createLinearGradient(0,215,0,352);mist.addColorStop(0,'#d4d0ad00');mist.addColorStop(.52,'#c1c6a22e');mist.addColorStop(1,'#c4c3a000');c.fillStyle=mist;c.fillRect(0,205,1000,190);
  // A river bends behind the garden, giving the little place a wider world.
  curve(c,[[1140,355],[777,294],[1047,598],[828,784]],'#8aa995',57);
  curve(c,[[1140,355],[777,294],[1047,598],[828,784]],'#afc1a4',24);
  curve(c,[[1140,351],[784,302],[1037,596],[825,784]],'#e0d9b563',3);
  for(let i=0;i<28;i++){const x=865+r()*100,y=416+r()*287;line(c,[[x,y],[x+6+r()*13,y-2]],'#cfdbbd4d',1);}
  tree(c,66,386,1.3,24);tree(c,958,398,1.2,43);tree(c,103,258,.68,8,true);
}

function drawGround(c) {
  const r=rng(640);
  ellipse(c,509,570,436,174,'#173b3a80');
  polygon(c,[[91,417],[503,286],[928,437],[906,579],[653,731],[192,648],[91,532]],'#435b4b','#344d45',2);
  polygon(c,[[91,455],[282,473],[602,709],[653,731],[192,648],[91,532]],'#576451');
  polygon(c,[[602,674],[922,477],[906,579],[653,731]],'#324f44');
  for(let i=0;i<70;i++){const x=129+r()*721,y=537+r()*132;stone(c,x,y,16+r()*36,9+r()*12,['#65705a','#6f785f','#4c604e'][i%3]);}
  polygon(c,[[98,417],[503,287],[928,437],[843,603],[625,688],[208,612],[98,511]],'#789260','#b5b887',2);
  const grass=c.createRadialGradient(525,432,20,525,482,380);grass.addColorStop(0,'#b6b77d');grass.addColorStop(.5,'#839960');grass.addColorStop(1,'#5d815b');
  polygon(c,[[103,416],[500,295],[918,440],[837,596],[624,680],[213,607],[106,508]],grass);
  for(let i=0;i<620;i++){const x=100+r()*820,y=327+r()*330;if(x<154&&y>536||y>606+(x-400)*.13||y<325+(x-500)*.28)continue;
    const col=['#c0c18937','#355f4930','#e0d3a040','#5e80413d'][i%4];line(c,[[x,y],[x-2+r()*5,y-2-r()*4]],col,.9);}
  // Flagstone terrace, separated from the companion's soft lawn.
  polygon(c,[[172,379],[392,314],[652,441],[608,596],[362,639],[161,523]],'#a7a385','#dfd1a7',2);
  c.save();c.beginPath();c.moveTo(172,379);for(const p of [[392,314],[652,441],[608,596],[362,639],[161,523]])c.lineTo(...p);c.closePath();c.clip();
  for(let row=0;row<15;row++)for(let col=0;col<15;col++){const x=88+col*48+(row%2)*24,y=339+row*23;const tone=['#b2ad8e','#bbb391','#a7a488','#c1b697'][(row*3+col*7)%4];polygon(c,[[x,y],[x+45,y-4],[x+57,y+17],[x+11,y+23]],tone,'#817f674a',1);}
  c.restore();
  curve(c,[[632,423],[611,449],[601,479],[597,499]],'#b6b388',11);curve(c,[[598,567],[582,607],[485,632],[394,647]],'#ccc098',9);
  // Stepping stones pull the eye and the player toward the spring.
  for(const [i,p]of [[632,449],[658,431],[682,416],[885,493],[864,529],[827,572]].entries())stone(c,p[0],p[1],31,16,i%2?'#c9bc96':'#bdb18d');
  for(const [x,y,s,seed]of [[145,463,.95,2],[231,633,.65,7],[440,655,.65,9],[765,609,.7,11],[897,468,.7,12],[657,347,.85,21]]){fern(c,x,y,s);flowers(c,x+10,y-5,seed,s*.7);}
  // Timber retaining edge and a few familiar, tactile details.
  for(let i=0;i<6;i++){const x=686+i*31,y=328+i*11;line(c,[[x,y+15],[x,y-18]],'#626e50',5);ellipse(c,x,y-18,3.5,2,'#b9ad78');}
  line(c,[[680,319],[847,379]],'#aaa875',5);line(c,[[680,337],[847,397]],'#8c9665',4);
  for(let i=0;i<5;i++){const x=120+i*19,y=581+i*6;polygon(c,[[x,y],[x+17,y+4],[x+17,y+10],[x,y+6]],'#b8a785','#746f59',1);}
  // Moss softens the stone edge without covering furnishing slots.
  for(let i=0;i<32;i++){const x=188+i*15,y=609+Math.sin(i*.13)*54;ellipse(c,x,y,8+r()*9,4+r()*5,['#4f7350','#6a8554','#8c9a60'][i%3]);}
}

function drawHouse(c, trim='#628784') {
  // Hand-drawn isometric timber house: thick walls, glazed amber light, a tiled roof.
  polygon(c,[[139,351],[314,264],[554,373],[385,465]],'#49614445');
  polygon(c,[[180,290],[327,220],[488,302],[340,382]],'#a58458','#554f3e',2);
  const front=c.createLinearGradient(180,180,354,381);front.addColorStop(0,'#e0b374');front.addColorStop(.6,'#c59762');front.addColorStop(1,'#b08859');
  const side=c.createLinearGradient(342,225,491,271);side.addColorStop(0,'#9e7951');side.addColorStop(1,'#bd8e59');
  polygon(c,[[180,288],[340,369],[340,205],[180,130]],front,'#67573e',2);
  polygon(c,[[340,369],[488,296],[488,140],[340,205]],side,'#66523b',2);
  // The taller roof has warm orange edges, contrasting with the cool forest.
  polygon(c,[[165,138],[340,226],[503,143],[329,63]],'#3c6460','#b5b291',2);
  const roof=c.createLinearGradient(246,55,340,226);roof.addColorStop(0,'#8daba0');roof.addColorStop(.45,'#618e81');roof.addColorStop(1,'#4a736c');
  polygon(c,[[165,138],[246,55],[410,139],[340,226]],roof,'#e1c799',2);
  polygon(c,[[246,55],[329,63],[503,143],[410,139]],'#74958b','#cfcca4',2);
  // Rows of staggered shingles are individually legible in the close view.
  c.save();c.beginPath();c.moveTo(165,138);c.lineTo(246,55);c.lineTo(410,139);c.lineTo(340,226);c.closePath();c.clip();
  const roofPoint=(u,v)=>[mix(mix(246,410,u),mix(165,340,u),v),mix(mix(55,139,u),mix(138,226,u),v)];
  for(let row=0;row<9;row++)for(let col=-1;col<10;col++){const u=(col+(row%2)*.5)/9,v=(row+1)/9,a=roofPoint(u,v),b=roofPoint(u+1/9,v),crest=roofPoint(u,v-1/9);curve(c,[a,[mix(a[0],b[0],.3)-1,mix(a[1],b[1],.3)+3],[mix(a[0],b[0],.75)-1,mix(a[1],b[1],.75)+3],b],'#c2d1b259',1.2);line(c,[a,crest],'#274e4957',.8);}
  c.restore();
  c.save();c.beginPath();c.moveTo(340,226);c.lineTo(410,139);c.lineTo(503,143);c.closePath();c.clip();
  for(let i=0;i<12;i++)line(c,[[340+i*14,229],[423+i*9,137]],'#82a59855',1.2);c.restore();
  line(c,[[162,137],[340,227],[508,143]],'#654d34',9);line(c,[[162,133],[340,222],[508,139]],'#d6b577',4);
  line(c,[[241,54],[411,140],[503,141]],'#d5c39c',3);line(c,[[246,54],[166,137]],'#d3bd87',4);
  // Wall framing and plaster, with shadows beneath every projecting beam.
  for(const [a,b]of [[[186,157],[334,231]],[[183,270],[336,349]],[[341,235],[482,165]],[[344,348],[482,281]]]){line(c,[a,b],'#77563b',7);line(c,[[a[0],a[1]-2],[b[0],b[1]-2]],'#d5aa6e',1.3);}
  const grain=rng(789);for(let i=0;i<65;i++){const x=187+grain()*141,y=180+grain()*92+x*.17;if(y>281+(x-184)*.51||y<166+(x-184)*.48)continue;line(c,[[x,y],[x+3+grain()*9,y+2]],'#6e503815',.7);}
  line(c,[[184,151],[184,289]],'#8c6442',8);line(c,[[337,228],[337,367]],'#78583d',9);line(c,[[482,158],[482,295]],'#67513b',7);
  line(c,[[187,180],[333,317]],'#876341',5);line(c,[[342,316],[480,197]],'#69513b',5);
  // A rounded welcoming doorway, inset into the front wall.
  c.save();c.transform(1,.49,0,1,217,232);
  round(c,-7,-48,71,115,[32,32,4,4],'#6b503c','#ddbc7f',4);
  round(c,0,-42,57,105,[26,26,1,1],'#47716a','#91a887',2);
  for(let i=0;i<5;i++)line(c,[[7+i*10,-10],[7+i*10,60]],'#8ea48770',1);
  round(c,8,-33,41,30,[19,19,3,3],'#f0cb84','#af965e',2);
  line(c,[[28,-32],[28,-5]],'#7b6d44',2);line(c,[[10,-17],[46,-17]],'#8e754d',2);
  ellipse(c,45,27,4,4,'#f3d38b','#73593a',1);line(c,[[14,47],[44,47]],'#b3c2a170',1.5);c.restore();
  // Wide side bay window with a flower-box shelf.
  c.save();c.transform(1,-.49,0,1,382,235);
  round(c,-4,-30,72,72,7,'#5d5b3e','#d8b978',4);round(c,2,-25,60,60,3,'#e8bb70');
  const windowLight=c.createLinearGradient(0,-25,0,35);windowLight.addColorStop(0,'#bd8052');windowLight.addColorStop(.5,'#e9bf76');windowLight.addColorStop(1,'#ffe5a1');round(c,3,-24,58,58,2,windowLight);
  line(c,[[31,-23],[31,35]],'#6b6650',4);line(c,[[3,5],[60,5]],'#6b6650',4);
  line(c,[[8,-21],[8,0]],'#fae9b487',2);line(c,[[35,10],[35,28]],'#ffeab787',2);
  round(c,-7,36,78,16,2,trim,'#cab283',2);for(let i=0;i<6;i++)line(c,[[i*13-3,40],[i*13-3,49]],'#233f3d66',1);
  flowers(c,33,36,111,.95,['#e5a17d','#f4cd8c','#ddbe94']);c.restore();
  // Chimney, little attic light, and a porch edged in the player's chosen trim.
  polygon(c,[[365,108],[365,49],[387,40],[387,98]],'#a09578','#5a6857',1.5);polygon(c,[[387,40],[402,50],[402,104],[387,98]],'#73816d','#586c5a',1.5);
  polygon(c,[[361,48],[386,37],[408,49],[384,60]],'#c2b59a','#536454',2);polygon(c,[[372,47],[386,43],[397,49],[384,53]],'#374b45');
  for(let i=0;i<4;i++)line(c,[[366,60+i*12],[385,52+i*12]],'#d5c79a63',1);
  glow(c,291,139,29,'#ffcf8133');c.save();c.translate(291,139);c.rotate(.45);ellipse(c,0,0,20,24,'#ad9765','#debf86',4);ellipse(c,0,0,15,18,'#efc780','#667666',3);line(c,[[-14,0],[14,0]],'#8a7549',2);line(c,[[0,-17],[0,17]],'#8a7549',2);c.restore();
  polygon(c,[[211,345],[340,410],[496,333],[496,346],[340,426],[211,359]],'#97876c','#6c6e50',1);
  polygon(c,[[211,344],[340,408],[496,331],[479,324],[341,393],[226,336]],'#c8b492','#ddd0ac',1);
  line(c,[[218,351],[340,414],[490,339]],trim,7);
  for(let i=0;i<2;i++)polygon(c,[[281-i*9,383+i*8],[336,412+i*8],[372+i*10,394+i*8],[371+i*10,402+i*8],[336,421+i*8],[280-i*9,392+i*8]],i?'#c5b492':'#b7a884','#7d7960',1);
  // Creepers and hanging objects give the house small discoveries at close range.
  curve(c,[[188,290],[153,216],[184,206],[164,159]],'#475e44',4);
  for(let i=0;i<29;i++){const y=163+i*4,x=172+Math.sin(i*.7)*12;leaf(c,x,y,i%2?-.6:2.8,11,['#729161','#a6ad69','#4e7959'][i%3]);}
  lantern(c,323,275,.68);line(c,[[323,249],[323,233],[311,229]],'#4f5d4c',3);
  lantern(c,466,238,.6);line(c,[[466,212],[466,200],[477,195]],'#4f5d4c',3);
  // A long clothesline of small pennants; not a UI ribbon.
  curve(c,[[119,247],[231,353],[435,309],[573,334]],'#565e467f',1.3);
  for(let i=0;i<13;i++){const t=i/12,x=mix(123,571,t),y=249+130*t-46*t*t;polygon(c,[[x,y],[x+12,y+5],[x+3,y+19]],['#c99a70','#78a49a','#dbbf79','#a0aa71'][i%4],'#e4c99777',.6);}
  flowers(c,187,337,45,1.2);fern(c,483,328,.8);flowers(c,504,344,28,1.1);
}

function drawSpringBase(c) {
  // A clearly separate, close-up-able stone mechanism among the old roots.
  polygon(c,[[684,329],[846,300],[896,350],[895,483],[729,512],[688,470]],'#6c8067','#bbc098',2);
  polygon(c,[[693,332],[850,311],[885,353],[881,475],[729,500],[699,465]],'#adad88','#d4cc9f',2);
  for(const [x,y,w,h]of [[672,382,46,75],[643,376,32,58],[689,332,27,52]]){polygon(c,[[x-w/2,y],[x-w*.4,y-h],[x+w*.3,y-h-9],[x+w/2,y],[x,y+9]],'#89977b','#516953',2);line(c,[[x-w*.3,y-h+4],[x+w*.27,y-h-4]],'#c4c3a0',2);}
  curve(c,[[665,371],[681,383],[685,405],[713,405]],'#627d70',22);curve(c,[[665,371],[681,383],[685,405],[713,405]],'#3b645c',12);
  // A small brass wheel makes the entrance recognizable from the controls.
  ellipse(c,668,355,17,19,'#617d69','#dab87d',4);ellipse(c,668,355,5,6,'#d6b779');
  for(let i=0;i<6;i++){const a=i*TAU/6;line(c,[[668,355],[668+Math.cos(a)*14,355+Math.sin(a)*16]],'#d7b777',2.3);}
  fern(c,644,400,.85);flowers(c,699,322,839,.85,['#bfc2dd','#d6d4da','#f1d7a3']);
  curve(c,[[870,405],[923,431],[833,472],[857,523]],'#506f58',26);curve(c,[[870,405],[923,431],[833,472],[857,523]],'#83907b',17);
  ellipse(c,854,543,63,31,'#455f50','#b1b38b',6);ellipse(c,854,541,54,23,'#7b8d6d');
  for(let i=0;i<12;i++){const a=i*TAU/12;stone(c,854+Math.cos(a)*62,542+Math.sin(a)*31,19,11,i%3?'#a7ab83':'#c4bd91');}
  fern(c,918,526,.9);flowers(c,898,566,17,.9);flowers(c,779,497,17,.8);
}

function drawFurniture(c, item, x, y, time, reduced) {
  c.save();c.translate(x,y);
  // Four orientations are deliberately visible rather than only changing a counter.
  const turn=item.rotation||0;
  if(['rug','cushions','pet-bed'].includes(item.itemId)){c.scale(1,.56);c.rotate(turn*Math.PI/2);c.scale(1,1/.56);}
  else c.transform(turn===0?1:turn===1?.68:turn===2?-1:-.68,turn===1?.35:turn===3?-.35:0,0,1,0,0);
  ellipse(c,3,5,42,15,'#294e3c35');
  if(item.itemId==='bench') {
    for(const px of [-33,28]){polygon(c,[[px,-5],[px+6,-3],[px+6,20],[px,18]],'#665b43');polygon(c,[[px,-30],[px+5,-29],[px+5,0],[px,-3]],'#716a4e');}
    for(let i=0;i<3;i++)polygon(c,[[-42,-10+i*5],[35,-5+i*5],[43,-12+i*5],[-33,-17+i*5]],i%2?'#b5a977':'#cfbd86','#766d4f',1);
    for(let i=0;i<2;i++)polygon(c,[[-36,-36+i*11],[35,-32+i*11],[35,-23+i*11],[-36,-27+i*11]],'#adac7e','#e2cb97',1);
    line(c,[[-39,-24],[-43,-3]],'#5e7865',5);line(c,[[36,-21],[42,0]],'#5e7865',5);
    for(let i=0;i<4;i++)line(c,[[-25+i*14,-31],[-21+i*14,-31]],'#796f4c99',.9);
  } else if(item.itemId==='planter') {
    polygon(c,[[-31,-8],[27,-5],[24,19],[-26,15]],'#a47353','#6b6044',2);polygon(c,[[27,-5],[39,-14],[34,8],[24,19]],'#80694d');polygon(c,[[-33,-9],[-21,-19],[39,-14],[27,-3]],'#cd9d6d','#d5b980',2);polygon(c,[[-23,-10],[-17,-15],[27,-12],[21,-7]],'#4a6246');
    flowers(c,0,-8,415,1.4);fern(c,-17,-9,.65);line(c,[[-17,1],[-17,14]],'#d3a57888',1);line(c,[[6,2],[6,15]],'#d3a57888',1);
  } else if(item.itemId==='lantern') {
    stone(c,0,8,39,19,'#b5b08a');line(c,[[0,1],[0,-70],[13,-77]],'#5f7560',5);curve(c,[[13,-77],[30,-84],[31,-61],[25,-60]],'#c0b58a',3);line(c,[[25,-61],[25,-51]],'#9a9466',2);lantern(c,25,-15,1.1);
  } else if(item.itemId==='rug') {
    polygon(c,[[-52,-5],[10,-25],[56,6],[-7,29]],'#965f5d','#e8bc91',3);polygon(c,[[-43,-4],[9,-18],[45,5],[-6,21]],null,'#d0a581',2);
    polygon(c,[[-20,0],[4,-10],[26,3],[2,13]],'#e2bf86','#714f4a',2);polygon(c,[[-8,1],[3,-4],[12,2],[2,7]],'#67877b');
    for(let i=0;i<7;i++){line(c,[[-53+i*9,-4+i*5],[-58+i*9,-1+i*5]],'#d5ba8c',1.4);line(c,[[10+i*7,-25+i*5],[13+i*7,-28+i*5]],'#d5ba8c',1.4);}
  } else if(item.itemId==='cushions') {
    for(const [px,py,col]of [[-21,0,'#6f9b90'],[17,-8,'#d0a069'],[4,11,'#b47e75']]){c.save();c.translate(px,py);c.rotate(-.15);round(c,-22,-13,44,26,9,col,'#ead0a3',1.5);ellipse(c,0,-1,2.2,1.8,'#dfc7a2');line(c,[[-15,-8],[15,-8]],'#fff0c129',1);c.restore();}
  } else if(item.itemId==='birdbath') {
    ellipse(c,0,12,23,10,'#83907a','#d1cbaa',2);polygon(c,[[-7,8],[-9,-30],[10,-30],[7,10]],'#a3ac91','#d4d2b2',1.5);ellipse(c,0,-28,33,16,'#8a9e89','#dbd5b2',3);ellipse(c,0,-31,27,10,'#7aada1','#c9d7b2',1.7);ellipse(c,-3,-33,17,4,null,'#d4ead35c',1);
    ellipse(c,22,-43,8,6,'#c3b895');ellipse(c,18,-48,5,5,'#e3d4ac');ellipse(c,16,-49,1,1,'#38574d');polygon(c,[[12,-49],[7,-46],[12,-45]],'#a47751');line(c,[[23,-39],[23,-35]],'#6c7457',1.5);polygon(c,[[27,-43],[37,-47],[33,-39]],'#668476');
  } else if(item.itemId==='pet-bed') {
    ellipse(c,0,0,44,24,'#a48360','#dec29a',3);ellipse(c,0,-4,39,19,'#ccae82');ellipse(c,0,-3,30,14,'#88a89a','#e5d5b0',2);
    for(let i=0;i<14;i++){const a=i*TAU/14;line(c,[[Math.cos(a)*39,Math.sin(a)*21],[Math.cos(a)*43,Math.sin(a)*23]],'#81694e8a',1);}
    ellipse(c,0,-3,5,4,'#d3dcc0');for(const [px,py]of [[-7,-7],[0,-10],[7,-7]])ellipse(c,px,py,2.6,2.6,'#d3dcc0');
  } else if(item.itemId==='wind-chime') {
    stone(c,0,10,36,17,'#c1b391');line(c,[[0,4],[0,-85]],'#6a795b',5);curve(c,[[0,-83],[17,-100],[36,-84],[31,-73]],'#8ea582',4);line(c,[[31,-75],[31,-65]],'#baad78',1.5);
    const sway=reduced?0:Math.sin(time*.002)*3;
    c.save();c.translate(sway,0);ellipse(c,31,-61,21,6,'#af9970','#e2cd98',1.5);
    for(let i=0;i<5;i++){const px=16+i*7,h=18+(i%3)*7;line(c,[[px,-59],[px,-50]],'#e3d7ac',1);round(c,px-2,-51,4,h,2,i%2?'#83b8af':'#d6c693','#eddfb2',.7);}polygon(c,[[30,-34],[36,-27],[30,-20],[24,-27]],'#dcb07a');c.restore();
  }
  c.restore();
}

function drawFox(c, x, y, companion, time, reduced, facing=1, running=false, carrying=false) {
  const colors=PET_COLORS.find(color=>color.id===companion?.color)||PET_COLORS[0];
  const coat=colors?.coat||'#d79b64',shade=colors?.shade||'#ae7458',accent=colors?.accent||'#fae7b8';
  const wag=reduced?0:Math.sin(time*(running?.018:.005))*7,bounce=reduced?0:Math.sin(time*.02)*(running?3:.3);
  ellipse(c,x+4,y+3,46,15,'#254a3b45');
  c.save();c.translate(x,y+bounce);c.scale(facing,1);
  // The long luminous tail is the character's silhouette, not a generic dog icon.
  c.beginPath();c.moveTo(-20,-12);c.bezierCurveTo(-59,-5,-68,-34,-73,-43+wag);c.bezierCurveTo(-47,-54+wag,-30,-47,-24,-34);c.bezierCurveTo(-14,-25,-13,-17,-20,-12);c.fillStyle=shade;c.fill();
  c.beginPath();c.moveTo(-37,-20);c.bezierCurveTo(-55,-19,-62,-33,-69,-40+wag);c.bezierCurveTo(-54,-43+wag,-47,-36,-45,-31);c.closePath();c.fillStyle=accent;c.fill();
  ellipse(c,-9,-23,29,22,coat,shade,1);
  for(const [px,py]of [[-24,-5],[7,-5]]){const step=running?Math.sin(time*.023+(px<0?0:Math.PI))*6:0;round(c,px-5,-14,12,20+step,5,shade);ellipse(c,px+2,6+step,9,4,accent);}
  // Oversized ears and eyebrows remain expressive at phone size.
  polygon(c,[[6,-47],[4,-82],[25,-60]],coat,shade,2);polygon(c,[[29,-58],[45,-80],[47,-44]],coat,shade,2);
  polygon(c,[[11,-51],[10,-73],[23,-56]],'#b97872');polygon(c,[[34,-56],[41,-71],[42,-49]],'#b97872');
  ellipse(c,27,-45,27,24,coat,shade,1.2);
  c.beginPath();c.moveTo(2,-45);c.quadraticCurveTo(11,-47,22,-33);c.quadraticCurveTo(33,-47,49,-48);c.quadraticCurveTo(47,-24,28,-22);c.quadraticCurveTo(10,-22,2,-45);c.fillStyle=accent;c.fill();
  const blink=!reduced&&Math.sin(time*.00071)>.997;
  for(const px of [15,38]){if(blink)curve(c,[[px-3,-43],[px-1,-41],[px+1,-41],[px+3,-43]],'#33483f',2);else{ellipse(c,px,-43,4,5.5,'#294d46');ellipse(c,px-1,-45,1.5,1.7,'#fff2cd');}}
  line(c,[[10,-52],[18,-54]],shade,2);line(c,[[34,-53],[42,-51]],shade,2);
  ellipse(c,28,-32,4.1,3.2,'#35483f');curve(c,[[28,-30],[28,-25],[23,-26],[22,-28]],'#765c4a',1.4);curve(c,[[28,-30],[28,-25],[33,-26],[35,-29]],'#765c4a',1.4);
  ellipse(c,10,-34,4,2,'#dd9c8070');ellipse(c,44,-34,4,2,'#dd9c8070');
  // A three-dot bioluminescent brow identifies the glimmerfox species.
  for(const [px,py]of [[22,-58],[28,-60],[34,-58]]){glow(c,px,py,5,'#dcefb245','#b9f9b600');ellipse(c,px,py,1.7,2.2,'#e3efc0');}
  if(companion?.accessory==='scarf') {curve(c,[[5,-25],[13,-17],[34,-16],[43,-24]],'#739c98',8);polygon(c,[[12,-22],[23,-18],[11,5],[3,1]],'#86b7ab','#cad2ae',1);line(c,[[7,-1],[13,-14]],'#d4dfbb',1);}
  if(companion?.accessory==='bow') {polygon(c,[[7,-26],[-7,-34],[-8,-17],[7,-22]],'#cf8e89','#f0c2a4',1);polygon(c,[[7,-26],[20,-34],[20,-18],[7,-22]],'#ce9eab','#f0c2a4',1);ellipse(c,7,-24,4,4,'#e7bc99');}
  if(companion?.accessory==='flower') {for(let i=0;i<5;i++)ellipse(c,46+Math.cos(i*TAU/5)*5,-60+Math.sin(i*TAU/5)*5,4.7,4.7,'#ecd4a1');ellipse(c,46,-60,3,3,'#b49058');leaf(c,41,-55,2.6,12,'#83aa75');}
  if(carrying){ellipse(c,30,-23,8.5,8.5,'#b57c79','#f2d09e',1.5);curve(c,[[24,-27],[28,-22],[32,-22],[37,-26]],'#ead3a7',1.5);}
  c.restore();
}

/** A projection of saved choices, never a source of world events or elapsed days.
 * Fetch animation is disposable presentation: its saved outcome is always the
 * companion back home with its toy. Loading or hiding cannot create activity. */
export class NeighborhoodView {
  constructor(canvas,{onSelect=()=>{}}={}) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.onSelect=onSelect;
    this.state={neighborhood:defaultNeighborhood(),mode:'welcome',historical:false,waterRunning:false,reducedMotion:globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||false};
    this.width=1;this.height=1;this.dpr=1;this.camera={x:500,y:390,zoom:1};this.visible=true;this.destroyed=false;this.frameId=null;this.lastFrame=0;this.fetchStart=null;this.fetchTarget=null;this.hits=[];this.layer=null;this.trim=null;this.hasState=false;this.pointerDown=null;
    this.listeners=[];this._bind('pointerdown',e=>{if(e.button&&e.pointerType!=='touch')return;this.pointerDown={x:e.clientX,y:e.clientY,id:e.pointerId};});
    this._bind('pointerup',e=>{const down=this.pointerDown;this.pointerDown=null;if(!down||down.id!==e.pointerId||Math.hypot(e.clientX-down.x,e.clientY-down.y)>10)return;this._select(e);});
    this._bind('pointercancel',()=>{this.pointerDown=null;});
    this._bind('pointermove',e=>{if(e.pointerType==='touch')return;const p=this._point(e);this.canvas.style.cursor=this._hit(p)?'pointer':this.state.mode==='companion'?'crosshair':'default';});
    canvas.style.touchAction='pan-y';
    canvas.setAttribute?.('role','img');canvas.setAttribute?.('aria-label','Hearth courtyard: a warm stone home, a furnished terrace, Pip the glimmerfox, and a spring garden. All activities also have buttons below the scene.');
    this._resize=()=>this.resize();this.resizeObserver=globalThis.ResizeObserver?new ResizeObserver(this._resize):null;this.resizeObserver?.observe(canvas);if(!this.resizeObserver)globalThis.addEventListener?.('resize',this._resize);
    this._visibility=()=>{if(globalThis.document?.hidden)this._stop();else if(this.visible)this.invalidate();};globalThis.document?.addEventListener?.('visibilitychange',this._visibility);
    this.resize();
  }
  _bind(name,fn){this.canvas.addEventListener(name,fn);this.listeners.push([name,fn]);}
  setState(state={}) {
    const previous=this.state.neighborhood?.companion?.lastPlay;
    const incoming=state.neighborhood?.companion?.lastPlay;
    if(this.hasState&&this.visible&&(state.mode||this.state.mode)==='companion'&&incoming?.id!==previous?.id&&incoming&&!(state.historical??this.state.historical)){this.fetchStart=globalThis.performance?.now?.()||0;this.fetchTarget={x:470+incoming.x*320,y:477+incoming.y*169};}
    if(state.historical){this.fetchStart=null;this.fetchTarget=null;}
    this.state={...this.state,...state};this.hasState=true;
    const trim=this.state.personalization?.homes?.['k-hearth-table']?.color||null;
    if(trim!==this.trim){this.trim=trim;this.layer=null;}
    this._camera();this.invalidate();
  }
  setVisible(value){this.visible=Boolean(value);if(this.visible){this.resize();this.invalidate();}else this._stop();}
  _stop(){if(this.frameId!==null)globalThis.cancelAnimationFrame?.(this.frameId);this.frameId=null;}
  resize(){const r=this.canvas.getBoundingClientRect();this.width=Math.max(1,r.width||this.canvas.clientWidth||1000);this.height=Math.max(1,r.height||this.canvas.clientHeight||760);this.dpr=Math.min(2,Math.max(1,globalThis.devicePixelRatio||1));this.canvas.width=Math.round(this.width*this.dpr);this.canvas.height=Math.round(this.height*this.dpr);this._camera();this.invalidate();}
  _camera(){const mode=this.state.mode;const portrait=this.width<600||this.width/this.height<1.45;let frame={x:500,y:390,w:1010,h:750};
    if(mode==='water')frame=portrait?{x:785,y:414,w:360,h:Math.min(320,this.height/.98)}:{x:714,y:415,w:660,h:490};
    else if(mode==='decorate')frame=portrait?{x:390,y:474,w:630,h:405}:{x:422,y:393,w:850,h:620};
    else if(mode==='companion')frame=portrait?{x:638,y:531,w:460,h:330}:{x:599,y:479,w:780,h:565};
    else if(portrait)frame={x:508,y:408,w:925,h:640};
    this.camera={x:frame.x,y:frame.y,zoom:Math.min(this.width/frame.w,this.height/frame.h)};
  }
  sceneToScreen(x,y){return{x:(x-this.camera.x)*this.camera.zoom+this.width/2,y:(y-this.camera.y)*this.camera.zoom+this.height/2};}
  screenToScene(x,y){return{x:(x-this.width/2)/this.camera.zoom+this.camera.x,y:(y-this.height/2)/this.camera.zoom+this.camera.y};}
  _point(e){const r=this.canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*this.width/(r.width||this.width),y:(e.clientY-r.top)*this.height/(r.height||this.height)};}
  _hit(p){let best=null,score=Infinity;for(const h of this.hits){const v=((p.x-h.x)/h.rx)**2+((p.y-h.y)/h.ry)**2;if(v<=1&&v+(h.priority||0)<score){score=v+(h.priority||0);best=h;}}return best;}
  _hitScene(action,x,y,rx,ry=rx,priority=0){const p=this.sceneToScreen(x,y);this.hits.push({...p,rx:Math.max(22,rx*this.camera.zoom),ry:Math.max(22,ry*this.camera.zoom),priority,action});}
  _select(e){if(this.state.historical)return;const p=this._point(e),hit=this._hit(p);if(hit){this.onSelect({...hit.action});return;}
    if(this.state.mode==='companion'){const q=this.screenToScene(p.x,p.y);if(((q.x-LAWN.x)/LAWN.rx)**2+((q.y-LAWN.y)/LAWN.ry)**2<1.15)this.onSelect({type:'lawn',x:clamp((q.x-470)/320,0,1),y:clamp((q.y-477)/169,0,1)});}
  }
  invalidate(){if(this.destroyed||!this.visible||globalThis.document?.hidden||this.frameId!==null)return;if(globalThis.requestAnimationFrame)this.frameId=requestAnimationFrame(time=>this._frame(time));}
  _frame(time){this.frameId=null;if(this.destroyed||!this.visible||globalThis.document?.hidden)return;
    if(time-this.lastFrame>=32||this.state.reducedMotion){this.lastFrame=time;this.drawFrame(time);}
    if(!this.state.reducedMotion)this.invalidate();
  }
  _background(){if(this.layer)return this.layer;
    let canvas;if(globalThis.OffscreenCanvas)canvas=new OffscreenCanvas(1800,1380);else if(globalThis.document?.createElement)canvas=document.createElement('canvas');
    if(!canvas?.getContext)return null;canvas.width=1800;canvas.height=1380;const c=canvas.getContext('2d');c.scale(1.5,1.5);c.translate(100,80);drawBackdrop(c);drawGround(c);
    // Soft shade grounds the house and leaves afternoon patches on the terrace.
    const shade=c.createRadialGradient(334,390,20,350,421,231);shade.addColorStop(0,'#203f3d3b');shade.addColorStop(1,'#203f3d00');ellipse(c,347,424,224,111,shade);
    const sun=c.createRadialGradient(451,434,8,447,449,175);sun.addColorStop(0,'#fff0ae18');sun.addColorStop(1,'#fff0ae00');ellipse(c,449,449,175,99,sun);
    drawHouse(c,this._trimColor());drawSpringBase(c);
    tree(c,129,408,.95,57,true);tree(c,572,326,.77,239);flowers(c,561,370,610,.8);this.layer=canvas;return canvas;
  }
  _trimColor(){return resolveStyleColor(this.trim)?.coat||'#628784';}
  drawFrame(time=0){if(!this.ctx)return;const c=this.ctx,s=this.state,n=s.neighborhood||defaultNeighborhood();
    c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle='#2e514b';c.fillRect(0,0,this.width,this.height);this.hits=[];
    c.save();c.translate(this.width/2,this.height/2);c.scale(this.camera.zoom,this.camera.zoom);c.translate(-this.camera.x,-this.camera.y);
    const layer=this._background();if(layer)c.drawImage(layer,-100,-80,1200,920);else{drawBackdrop(c);drawGround(c);drawHouse(c,this._trimColor());drawSpringBase(c);}
    this._water(c,time);
    if(s.mode==='decorate')this._slots(c,n);
    const things=DECOR_SLOTS.filter(slot=>n.items?.[slot.id]).map(slot=>({type:'item',...slot,item:n.items[slot.id]}));
    const fox=this._foxPosition(time);things.push({type:'fox',...fox});things.sort((a,b)=>a.y-b.y);
    for(const thing of things){if(thing.type==='item'){drawFurniture(c,thing.item,thing.x,thing.y,time,s.reducedMotion);if(s.mode==='decorate')this._hitScene({type:'slot',slotId:thing.id},thing.x,thing.y-12,45,39,-.1);}
      else{drawFox(c,thing.x,thing.y,n.companion,time,s.reducedMotion,thing.facing,thing.running,thing.carrying);if(s.mode==='companion'||s.mode==='welcome')this._hitScene({type:'pet'},thing.x+8,thing.y-27,54,48,-.5);}}
    if(this.fetchTarget&&this.fetchStart!==null&&!s.reducedMotion){const elapsed=time-this.fetchStart;if(elapsed>0&&elapsed<1900){const p=this.fetchTarget,jump=elapsed<450?Math.sin(elapsed/450*Math.PI)*47:0;ellipse(c,p.x,p.y+1,8,3,'#243e3933');ellipse(c,p.x,p.y-6-jump,7,7,'#bd8880','#f5d69d',1.4);}}
    this._foreground(c,time);
    if(s.mode==='welcome'){this._hitScene({type:'house'},320,260,155,130,.3);this._hitScene({type:'channel',index:4},788,409,93,94,.1);}
    c.restore();
    this._labels(c,n,fox);
    if(this.canvas.dataset){this.canvas.dataset.renderMode=s.mode;this.canvas.dataset.renderDpr=String(this.dpr);}
  }
  _slots(c,n){for(const [i,slot]of DECOR_SLOTS.entries()){const selected=this.state.selectedSlotId===slot.id,occupied=Boolean(n.items?.[slot.id]);
      ellipse(c,slot.x,slot.y+4,48,25,selected?'#f5d89955':'#e8d6a321',selected?'#ffe6ac':'#e4d7a879',selected?2.8:1.4);
      if(!occupied){line(c,[[slot.x-7,slot.y],[slot.x+7,slot.y]],'#fff0c2b0',2);line(c,[[slot.x,slot.y-5],[slot.x,slot.y+5]],'#fff0c2b0',2);}
      this._hitScene({type:'slot',slotId:slot.id},slot.x,slot.y,48,31,0);
      if(selected&&this.state.selectedItemId&&!occupied){c.save();c.globalAlpha=.62;drawFurniture(c,{itemId:this.state.selectedItemId,rotation:0},slot.x,slot.y,0,true);c.restore();}
    }}
  _displayChannelTurns(){const n=this.state.neighborhood||defaultNeighborhood();return this.state.waterRunning&&!channelFlow(n.channelTurns).connected?INSTALLED_CHANNEL_TURNS:n.channelTurns;}
  _water(c,time){const s=this.state,turns=this._displayChannelTurns(),flow=channelFlow(turns),wet=new Set(flow.wetCells);const boardMode=s.mode==='water';
    // A previously restored world's installed channel stays connected even when
    // this player's unsolved practice board belongs to another telling. This
    // fallback is display-only; it never rewrites saved rotations or history.
    const flowing=Boolean(s.waterRunning);if(flowing){curve(c,[[665,371],[681,383],[685,405],[713,405]],'#a7d4bd',9);curve(c,[[870,405],[923,431],[833,472],[857,523]],'#81bbac',15);curve(c,[[870,402],[923,428],[833,469],[857,520]],'#d0e8ca99',3);
      ellipse(c,854,541,54,23,'#729f8f');ellipse(c,854,539,48,18,'#8fb7a1');for(let i=0;i<4;i++){const p=s.reducedMotion?.5:((time*.00025+i*.25)%1);ellipse(c,854,536,10+p*34,3+p*12,null,`rgba(220,242,204,${.45*(1-p)})`,1.2);}fern(c,817,565,.7,['#3e7b58','#73a969','#b4c581']);flowers(c,846,576,204,.75,['#f4cc8e','#efd7a4','#e4b4aa']);
    }
    // Preview water is intentionally confined to the connected pipes. Only the
    // real world flag above fills the pond and waters the surrounding garden.
    for(let index=0;index<CHANNEL_TILES.length;index++){const col=index%3,row=Math.floor(index/3),x=BOARD.x+col*(BOARD.size+BOARD.gap),y=BOARD.y+row*(BOARD.size+BOARD.gap),cx=x+BOARD.size/2,cy=y+BOARD.size/2;
      round(c,x+1,y+4,BOARD.size,BOARD.size,5,'#667e64');round(c,x,y,BOARD.size,BOARD.size,5,index%2?'#c4ba92':'#b4b38d','#e0d4aa',1.1);
      line(c,[[x+5,y+4],[x+40,y+4]],'#eee1b77a',1);ellipse(c,x+6,y+6,1.5,1.5,'#838a68');ellipse(c,x+41,y+41,1.5,1.5,'#838a68');
      const ports=channelPorts(index,turns);const p0=DIRECTIONS[ports[0]],p1=DIRECTIONS[ports[1]];
      c.beginPath();c.moveTo(cx+p0[0]*24,cy+p0[1]*24);c.lineTo(cx+p0[0]*9,cy+p0[1]*9);c.quadraticCurveTo(cx,cy,cx+p1[0]*9,cy+p1[1]*9);c.lineTo(cx+p1[0]*24,cy+p1[1]*24);c.lineCap='butt';c.lineWidth=17;c.strokeStyle='#7d8b6b';c.stroke();c.lineWidth=12;c.strokeStyle='#506f5c';c.stroke();
      if(wet.has(index)){c.lineWidth=9;c.strokeStyle=flow.connected?'#9ad9c0':'#8cbeb0';c.stroke();c.lineWidth=2;c.strokeStyle='#dff3c270';c.stroke();}
      if(boardMode){this._hitScene({type:'channel',index},cx,cy,24,24,0);c.save();c.font='9px sans-serif';c.textAlign='left';c.fillStyle='#657559';c.fillText(String(index+1),x+4,y+43);c.restore();}
    }
    if(boardMode){const x=695,y=406;polygon(c,[[x-7,y-4],[x+4,y-4],[x+4,y-9],[x+13,y],[x+4,y+9],[x+4,y+4],[x-7,y+4]],'#f7d89a','#6c815e',1);polygon(c,[[873,y-4],[885,y-4],[885,y-9],[894,y],[885,y+9],[885,y+4],[873,y+4]],flow.connected?'#c3e9b0':'#c6bd91','#718568',1);}
  }
  _foxPosition(time){const s=this.state,last=s.neighborhood?.companion?.lastPlay;let p={...PET_HOME,facing:1,running:false,carrying:Boolean(last)};
    if(this.fetchStart===null||!this.fetchTarget||s.reducedMotion)return p;
    const age=Math.max(0,time-this.fetchStart),target=this.fetchTarget;let f=0;if(age<450)return{...p,carrying:false};if(age<1500)f=smooth((age-450)/1050);else if(age<1900)f=1;else if(age<3000)f=1-smooth((age-1900)/1100);else {this.fetchStart=null;return p;}
    return{x:mix(PET_HOME.x,target.x,f),y:mix(PET_HOME.y,target.y,f),facing:(target.x>PET_HOME.x?1:-1)*(age>1900?-1:1),running:age<1500||age>1900,carrying:age>=1900};
  }
  _foreground(c,time){const s=this.state;const r=rng(328);for(let i=0;i<8;i++){const x=125+i*23,y=592+i*9;fern(c,x,y,.65+i*.03);}
    fern(c,626,687,1.2);flowers(c,651,675,17,1.15);fern(c,802,635,1.1);flowers(c,811,627,35,1.15);flowers(c,291,651,199,.8);fern(c,926,601,1.5);
    if(!s.reducedMotion)for(let i=0;i<12;i++){const x=123+r()*761+Math.sin(time*.0005+i)*6,y=337+r()*306+Math.cos(time*.0008+i)*5;const a=.22+Math.sin(time*.001+i*2)*.15;glow(c,x,y,7,`rgba(249,224,158,${a})`);ellipse(c,x,y,1.1,1.1,`rgba(255,239,181,${a+.15})`);}
  }
  _labels(c,n,fox){if(this.state.mode==='decorate')for(const [i,slot]of DECOR_SLOTS.entries()){const p=this.sceneToScreen(slot.x,slot.y+31);if(p.x<12||p.x>this.width-12||p.y<9||p.y>this.height-10)continue;this._badge(c,String(i+1),p.x,p.y,this.state.selectedSlotId===slot.id);}
    if(this.state.mode==='companion'||this.state.mode==='welcome'){const p=this.sceneToScreen(fox.x+10,fox.y+23);this._badge(c,n.companion?.name||'Pip',p.x,p.y,false);}
  }
  _badge(c,text,x,y,active){c.save();c.font='600 12px system-ui, sans-serif';c.textAlign='center';c.textBaseline='middle';const w=Math.max(26,c.measureText(text).width+18);round(c,x-w/2,y-12,w,24,12,active?'#e7c992f2':'#294b40dd',active?'#ffe5b3':'#cfcc9d66',1);c.fillStyle=active?'#384f3e':'#f4e7c7';c.fillText(text,x,y);c.restore();}
  destroy(){this.destroyed=true;this._stop();this.resizeObserver?.disconnect();globalThis.removeEventListener?.('resize',this._resize);globalThis.document?.removeEventListener?.('visibilitychange',this._visibility);for(const [name,fn]of this.listeners)this.canvas.removeEventListener(name,fn);this.layer=null;this.hits=[];}
}
