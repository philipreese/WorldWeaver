import {readdir} from 'node:fs/promises';import {spawnSync} from 'node:child_process';
async function walk(dir){const all=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=`${dir}/${e.name}`;all.push(...(e.isDirectory()?await walk(p):/\.m?js$/.test(p)?[p]:[]));}return all;}
for(const file of [...await walk('src'),...await walk('scripts')]){const r=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(r.status)process.exit(r.status);}
console.log('JavaScript syntax checked.');
