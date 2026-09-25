import { cp, mkdir, readFile, writeFile, rm, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import "./prepare-three.mjs";
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
for (const path of ["index.html", "src"])
  await cp(path, `dist/${path}`, { recursive: true });
await cp("public", "dist", { recursive: true });
await writeFile(
  "dist/build-info.json",
  JSON.stringify({
    commit: process.env.GITHUB_SHA || "development",
    branch: process.env.GITHUB_REF_NAME || "local",
  }) + "\n",
);
async function walk(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    result.push(...(entry.isDirectory() ? await walk(path) : [path]));
  }
  return result;
}
const sourceFiles = (await walk("dist")).sort();
const hash = createHash("sha256");
for (const f of sourceFiles) hash.update(await readFile(f));
const version = hash.digest("hex").slice(0, 12);
// A page selects one immutable module graph. A cached old module can never
// satisfy a request for a different release, including an optional renderer.
const release = `releases/${version}`;
await mkdir(`dist/${release}`, { recursive: true });
for (const directory of ["src", "assets", "vendor"]) {
  await cp(`dist/${directory}`, `dist/${release}/${directory}`, { recursive: true });
  await rm(`dist/${directory}`, { recursive: true });
}
await cp("dist/build-info.json", `dist/${release}/build-info.json`);
const entry = await readFile("dist/index.html", "utf8");
function page(prefix, lab = false) {
  let html = entry.replaceAll('./src/', `${prefix}${release}/src/`)
    .replaceAll('./vendor/', `${prefix}${release}/vendor/`);
  if (lab) html = html
    .replace('data-site-base="./"', 'data-site-base="../" data-neighborhood-renderer="three"')
    .replace('href="./icon.svg"', 'href="../icon.svg"')
    .replace('href="./manifest.webmanifest"', 'href="../manifest.webmanifest"')
    .replace('<title>Worldweaver · The Quiet Basin</title>', '<title>Worldweaver · Courtyard comparison</title>');
  return html;
}
await writeFile("dist/index.html", page("./"));
await mkdir("dist/lab", { recursive: true });
await writeFile("dist/lab/index.html", page("../", true));
const files = (await walk("dist")).sort();
const optionalAsset = path => path.includes('/vendor/')
  || path.endsWith('/view/neighborhood-three-view.js')
  || path.endsWith('/assets/courtyard-three.json');
const assets = ["./", "./lab/", ...files.filter(f => !optionalAsset(f)).map(f => "./" + f.slice(5))];
await writeFile(
  "dist/sw.js",
  `const CACHE='worldweaver-${version}';
const ASSETS=${JSON.stringify(assets)};
const BASE=new URL('./',self.location.href);
const MAIN=new URL('./',BASE).href, LAB=new URL('./lab/',BASE).href;
const IMMUTABLE=new URL('./releases/',BASE).pathname;
self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(path=>new Request(new URL(path,BASE),{cache:'reload'})))).then(()=>self.skipWaiting())
));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const prior=(await caches.keys()).filter(key=>key.startsWith('worldweaver-')&&key!==CACHE);
  // Keep one previous graph for an already-open tab. Never force a reload or
  // touch saved worlds. Optional assets are cached only after they are used.
  await Promise.all(prior.slice(0,-1).map(key=>caches.delete(key)));
  await self.clients.claim();
})()));
function navigationKey(url){
  if(url.pathname===BASE.pathname||url.pathname===BASE.pathname+'index.html')return MAIN;
  if(url.pathname===BASE.pathname+'lab/'||url.pathname===BASE.pathname+'lab/index.html')return LAB;
  return null;
}
async function navigate(request,key){
  const cache=await caches.open(CACHE).catch(()=>null);
  try {
    const response=await fetch(request,{cache:'no-cache'});
    if(response.ok&&cache)await cache.put(key,response.clone()).catch(()=>{});
    if(response.status>=500)throw new Error('Server unavailable');
    return response;
  } catch {
    return await cache?.match(key).catch(()=>null)||Response.error();
  }
}
async function asset(request,immutable){
  const cache=await caches.open(CACHE).catch(()=>null);
  const cached=await cache?.match(request).catch(()=>null)||(immutable?await caches.match(request).catch(()=>null):null);
  if(cached)return cached;
  const response=await fetch(request);
  if(immutable&&response.ok&&cache)await cache.put(request,response.clone()).catch(()=>{});
  return response;
}
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;
  const key=request.mode==='navigate'?navigationKey(url):null;
  event.respondWith(key?navigate(request,key):asset(request,url.pathname.startsWith(IMMUTABLE)));
});
`,
);
console.log(
  `Built ${files.length} files, offline cache ${version}; all paths relative.`,
);
