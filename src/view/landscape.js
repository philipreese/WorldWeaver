// Authored geography is visual context, not simulation state. Habitation and
// inspectable structures are drawn separately from the recorded world.
const TAU = Math.PI * 2;

export function random(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(1664525, value) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function polygon(ctx, points, fill, stroke, width = 1) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

export function ellipse(ctx, x, y, rx, ry, fill, stroke, width = 1) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

function landOutline(rand, x, y, rx, ry, count = 48) {
  return Array.from({ length: count }, (_, i) => {
    const angle = i / count * TAU;
    const wobble = 0.91 + rand() * 0.15;
    return [x + Math.cos(angle) * rx * wobble, y + Math.sin(angle) * ry * wobble];
  });
}

function island(ctx, rand, x, y, rx, ry, height = 34, color = '#254449') {
  const points = landOutline(rand, x, y, rx, ry);
  ellipse(ctx, x + 10, y + height + 12, rx + 10, ry + 2, '#061c2699');
  polygon(ctx, points.map(([px, py]) => [px, py + height]), '#102a35', '#35505a55');
  for (let i = 0; i < points.length / 2; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    polygon(ctx, [a, b, [b[0], b[1] + height], [a[0], a[1] + height]],
      i % 3 === 0 ? '#17323d' : '#1a3540', '#304b5050', 0.5);
  }
  polygon(ctx, points, color, '#64817b66', 1.25);
  const inner = points.map(([px, py]) => [x + (px - x) * .96, y + (py - y) * .96 - 1]);
  polygon(ctx, inner, null, '#748e7e22', 1);
  // Sparse engraving-like topographic scratches remain legible at close scale.
  for (let i = 0; i < rx * .65; i++) {
    const a = rand() * TAU, r = Math.sqrt(rand()) * .87;
    const px = x + Math.cos(a) * rx * r, py = y + Math.sin(a) * ry * r;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 1 + rand() * 9, py - 1 - rand() * 2);
    ctx.strokeStyle = rand() > .7 ? '#8da69218' : '#071c2538';
    ctx.lineWidth = .7; ctx.stroke();
  }
}

function rock(ctx, x, y, scale, pale = false) {
  polygon(ctx, [[x - 5 * scale, y], [x - 3 * scale, y - 4 * scale], [x + 2 * scale, y - 6 * scale], [x + 6 * scale, y - 1 * scale], [x + 2 * scale, y + 2 * scale]], pale ? '#435960' : '#28464c', '#617e792b', .65);
  polygon(ctx, [[x - 3 * scale, y - 4 * scale], [x + 2 * scale, y - 6 * scale], [x + 1 * scale, y], [x - 5 * scale, y]], pale ? '#586f6d' : '#36565a');
}

function reeds(ctx, x, y, h, hue = '#689083') {
  ctx.strokeStyle = hue; ctx.lineWidth = .65;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath(); ctx.moveTo(x + i * 1.6, y);
    ctx.quadraticCurveTo(x + i * 2.5, y - h * .6, x + i * 4, y - h * (i ? .7 : 1)); ctx.stroke();
    ellipse(ctx, x + i * 4, y - h * (i ? .7 : 1), .9, 1.8, hue);
  }
}

function ridge(ctx, points, width = 30) {
  const back = points.map(([x, y], i) => [x, y + width * (.8 + (i % 3) * .15)]).reverse();
  polygon(ctx, [...points, ...back], '#152e38', '#3c535752', .8);
  for (let i = 0; i < points.length - 1; i++) {
    const [x, y] = points[i], [x2, y2] = points[i + 1];
    polygon(ctx, [[x, y], [x2, y2], [x2 - width * .5, y2 + width * .8], [x - width * .25, y + width * .8]], i % 2 ? '#31494e' : '#3b5153', '#66807722', .6);
  }
  ctx.beginPath(); points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
  ctx.strokeStyle = '#718d8055'; ctx.lineWidth = 1; ctx.stroke();
}

function ancientArc(ctx, x, y, radius, angle, extent, height) {
  ctx.save(); ctx.translate(x, y);
  const n = Math.ceil(extent * radius / 21);
  for (let i = 0; i < n; i++) {
    const a = angle + i / n * extent, b = angle + (i + .93) / n * extent;
    const outer = radius, inner = radius - 13;
    const p = [[Math.cos(a)*outer,Math.sin(a)*outer*.48], [Math.cos(b)*outer,Math.sin(b)*outer*.48], [Math.cos(b)*inner,Math.sin(b)*inner*.48], [Math.cos(a)*inner,Math.sin(a)*inner*.48]];
    polygon(ctx, p.map(([px,py])=>[px,py+height]), '#142c35', '#47616844');
    polygon(ctx, [p[0],p[1],[p[1][0],p[1][1]+height],[p[0][0],p[0][1]+height]], '#233d46','#60797144',.6);
    polygon(ctx,p, i%4===0?'#667774':'#465e60','#8ca19570',.7);
    if (i%3===0) {
      ctx.strokeStyle='#b4b89b40'; ctx.lineWidth=.7; ctx.beginPath();
      ctx.moveTo(p[0][0]*.98,p[0][1]*.98); ctx.lineTo(p[3][0]*1.015,p[3][1]*1.015); ctx.stroke();
    }
  }
  ctx.restore();
}

export function createLandscape(quality = 'high') {
  const resolution = quality === 'low' ? 1 : 1.7;
  const canvas = document.createElement('canvas');
  const bounds = { x: -260, y: -210, width: 1740, height: 1190 };
  canvas.width = Math.round(bounds.width * resolution); canvas.height = Math.round(bounds.height * resolution);
  const ctx = canvas.getContext('2d', { alpha: true });
  ctx.scale(resolution, resolution); ctx.translate(-bounds.x, -bounds.y);
  const rand = random(194173);

  // Bathymetry: translucent contours, scattered shoals, and a deep central inlet.
  for (let i = 0; i < 11; i++) {
    ctx.beginPath();
    ctx.ellipse(630, 433, 380 + i * 28, 180 + i * 17, -.18, .07, 5.95);
    ctx.strokeStyle = `rgba(76,126,133,${.033 - i * .0016})`; ctx.lineWidth = .8; ctx.stroke();
  }
  for (let i=0;i<260;i++) {
    const x=rand()*1500-150,y=rand()*1000-100;
    ctx.fillStyle=i%4?'#91bcb318':'#c4d1b822';ctx.fillRect(x,y,rand()>.9?1.6:.7,.7);
  }
  island(ctx,rand,535,165,350,128,40,'#263f44');
  island(ctx,rand,350,472,277,158,44,'#2b4c4d');
  island(ctx,rand,874,377,267,159,50,'#263f4b');
  island(ctx,rand,578,716,185,83,30,'#264349');
  island(ctx,rand,172,282,115,73,28,'#29454a');
  island(ctx,rand,1091,600,98,57,22,'#233f49');
  island(ctx,rand,104,647,47,28,16,'#2b4548');
  island(ctx,rand,1115,128,85,41,22,'#30484d');

  // Natural terraces and channels; a deliberately uneven, hand-drawn coastline.
  ridge(ctx,[[242,166],[299,111],[367,102],[421,70],[478,84],[525,61],[579,70],[622,52],[671,79],[722,92],[764,126]],34);
  ridge(ctx,[[907,307],[954,271],[987,287],[1029,254],[1063,270],[1098,285]],31);
  ridge(ctx,[[223,528],[246,556],[291,580],[334,587],[381,577]],20);
  ridge(ctx,[[810,419],[848,440],[897,451],[943,435]],17);
  ridge(ctx,[[492,726],[529,744],[576,750],[628,743],[661,728]],17);

  ctx.beginPath();ctx.moveTo(297,173);ctx.bezierCurveTo(350,210,416,193,453,248);
  ctx.bezierCurveTo(463,268,440,292,431,322);ctx.strokeStyle='#0d303e';ctx.lineWidth=22;ctx.stroke();
  ctx.strokeStyle='#55808a55';ctx.lineWidth=1.2;ctx.stroke();
  ctx.beginPath();ctx.moveTo(336,428);ctx.bezierCurveTo(290,440,294,478,320,494);ctx.bezierCurveTo(359,517,384,537,363,580);
  ctx.strokeStyle='#153741';ctx.lineWidth=17;ctx.stroke();ctx.strokeStyle='#72a19a44';ctx.lineWidth=1;ctx.stroke();
  ellipse(ctx,905,354,64,34,'#143846','#79a7a03d',1.1);
  ellipse(ctx,905,354,45,22,null,'#81bfc328',.7);
  ellipse(ctx,531,203,61,35,'#193e43','#7b9f8430',1);

  // An uninhabited, immense annular foundation predates the recorded settlements.
  ancientArc(ctx,636,420,197,2.8,2.62,24);
  ancientArc(ctx,636,420,197,.08,1.68,24);
  ancientArc(ctx,636,420,166,.23,2.45,8);
  ellipse(ctx,640,417,134,66,'#102e3875','#67898328',1);
  ellipse(ctx,640,417,105,50,null,'#829e8b1a',.6);
  // The old arc has a quiet, cold core; it does not imply an active power.
  const pool=ctx.createRadialGradient(637,418,0,637,418,94);
  pool.addColorStop(0,'#467d7919');pool.addColorStop(1,'#467d7900');ellipse(ctx,637,418,103,58,pool);

  const patches=[[303,393,130,70],[225,487,70,49],[477,584,114,38],[593,160,160,37],[982,374,94,93],[821,348,78,58],[161,298,87,43],[572,702,115,44]];
  for(const [x,y,rx,ry] of patches) {
    for(let i=0;i<rx*.55;i++){
      const a=rand()*TAU,r=Math.sqrt(rand()),px=x+Math.cos(a)*rx*r,py=y+Math.sin(a)*ry*r;
      if(rand()>.64)rock(ctx,px,py,.35+rand()*.65,rand()>.8);
      else reeds(ctx,px,py,3+rand()*9,rand()>.6?'#86aa8477':'#56887777');
    }
  }
  for(let i=0;i<19;i++) rock(ctx,698+i*5+rand()*8,641+Math.sin(i*.65)*16,.8+rand()*1.4,true);

  // A distant broken aqueduct gives scale without being an invented dwelling.
  for(let i=0;i<10;i++){
    const x=888+i*15,y=191-i*4;
    polygon(ctx,[[x,y],[x+5,y-2],[x+5,y-26],[x,y-24]],'#3c5358','#8aa08d44',.6);
    polygon(ctx,[[x,y-24],[x+5,y-26],[x+17,y-29],[x+14,y-23]],'#718078','#9fa99044',.7);
  }
  return { canvas, ...bounds };
}
