import {cp,mkdir,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});
for(const path of ['index.html','src'])await cp(path,`dist/${path}`,{recursive:true});
await cp('public','dist',{recursive:true});
async function walk(dir){const result=[];for(const entry of await readdir(dir,{withFileTypes:true})){const path=`${dir}/${entry.name}`;result.push(...(entry.isDirectory()?await walk(path):[path]));}return result;}
const files=(await walk('dist')).sort();const hash=createHash('sha256');for(const f of files)hash.update(await readFile(f));
const version=hash.digest('hex').slice(0,12);const assets=['./',...files.map(f=>'./'+f.slice(5))];
await writeFile('dist/sw.js',`const CACHE='worldweaver-${version}';\nconst ASSETS=${JSON.stringify(assets)};\nself.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));\nself.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('worldweaver-')&&key!==CACHE).map(key=>caches.delete(key)))),self.clients.claim()])));\nself.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));});\n`);
console.log(`Built ${files.length} files, offline cache ${version}; all paths relative.`);
