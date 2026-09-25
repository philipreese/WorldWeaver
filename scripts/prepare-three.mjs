/** Publish a pinned local dependency; the game never loads code from a CDN. */
import { cp, mkdir, readFile } from "node:fs/promises";
const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const installed = JSON.parse(await readFile(new URL("../node_modules/three/package.json", import.meta.url), "utf8"));
if (installed.version !== manifest.dependencies.three)
  throw new Error("Three.js differs from its pinned version. Run npm ci.");
const target = new URL(`../public/vendor/three-${installed.version}/`, import.meta.url);
await mkdir(new URL("addons/controls/", target), { recursive: true });
for (const file of ["three.module.js", "three.core.js"])
  await cp(new URL(`../node_modules/three/build/${file}`, import.meta.url), new URL(file, target));
await cp(new URL("../node_modules/three/examples/jsm/controls/OrbitControls.js", import.meta.url), new URL("addons/controls/OrbitControls.js", target));
await cp(new URL("../node_modules/three/LICENSE", import.meta.url), new URL("LICENSE", target));
