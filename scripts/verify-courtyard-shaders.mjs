// Compile the pinned Three.js shader sources in native OpenGL ES. This catches
// GLSL/compiler failures, but does not replace WebGL/device rendering checks.
import * as THREE from 'three';
import { WebGLPrograms } from 'three/src/renderers/webgl/WebGLPrograms.js';
import { WebGLProgram } from 'three/src/renderers/webgl/WebGLProgram.js';
import { WebGLLights } from 'three/src/renderers/webgl/WebGLLights.js';
import { buildCourtyardThreeScene, NeighborhoodThreeView } from '../src/view/neighborhood-three-view.js';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const model = buildCourtyardThreeScene(JSON.parse(await readFile(new URL('../public/assets/courtyard-three.json', import.meta.url), 'utf8')));
const lights = []; model.scene.traverse(object => { if (object.isLight) lights.push(object); });
const extensions = { has: () => false }, lighting = WebGLLights(extensions); lighting.setup(lights);
const labelTexture = new THREE.Texture(), labelMaterial = new THREE.SpriteMaterial({ map: labelTexture });
model.scene.add(new THREE.Sprite(labelMaterial));
const depth = new THREE.MeshDepthMaterial({ side: THREE.BackSide });
const sources = [], seen = new Set();
// Capture the exact shader source sent to a compiler by the installed library.
// The capture itself makes no claim of compilation: Python does that below.
const gl = {
  VERTEX_SHADER: 35633, FRAGMENT_SHADER: 35632,
  createProgram: () => ({}), createShader: type => ({ type }),
  shaderSource: (shader, source) => { shader.source = source; },
  compileShader() {}, attachShader() {}, linkProgram() {}, bindAttribLocation() {},
};
let target = null;
const renderer = {
  getContext: () => gl, getRenderTarget: () => target,
  outputColorSpace: THREE.SRGBColorSpace, toneMapping: THREE.ACESFilmicToneMapping,
  shadowMap: { enabled: true, type: THREE.PCFShadowMap },
  state: { buffers: { depth: { getReversed: () => false } } },
};
const programs = WebGLPrograms(renderer, { get: () => null }, extensions, { precision: 'highp' }, {}, { numPlanes: 0, numIntersection: 0 });
const view = Object.assign(Object.create(NeighborhoodThreeView.prototype), { model, scene: model.scene, renderer, lightingProfile: 'standard' });
const emptyScene = new THREE.Scene();
do {
  const profile = view.lightingProfile;
  model.scene.traverse(object => {
    if (!object.isMesh && !object.isSprite) return;
    for (const material of [object.material, ...(object.castShadow && profile === 'standard' ? [depth] : [])].flat()) {
      target = material === depth ? { texture: { colorSpace: THREE.NoColorSpace } } : null;
      const parameters = programs.getParameters(material, lighting.state, lights.filter(light => light.castShadow), material === depth ? emptyScene : model.scene, object, []);
      const key = profile + programs.getProgramCacheKey(parameters);
      if (seen.has(key)) continue;
      seen.add(key);
      const program = new WebGLProgram(renderer, key, parameters, {});
      sources.push({
        name: `${profile}: ${material.type}, ${parameters.instancing ? 'instanced' : 'individual'}, ${parameters.flatShading ? 'flat' : 'smooth'}, ${parameters.opaque ? 'opaque' : 'transparent'}`,
        vertex: program.vertexShader.source, fragment: program.fragmentShader.source,
      });
    }
  });
} while (view._retryLighting());
model.dispose(); depth.dispose(); labelMaterial.dispose(); labelTexture.dispose();
const result = spawnSync('python3', [fileURLToPath(new URL('./compile-gles-shaders.py', import.meta.url))], {
  input: JSON.stringify(sources), encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024,
});
if (result.error) throw result.error;
if (result.stderr) process.stderr.write(result.stderr);
if (result.status !== 0) { process.stderr.write(result.stdout || 'Shader compiler failed.\n'); process.exit(1); }
const report = { kind: 'Native OpenGL ES shader compile/link; not browser rendering or phone validation.', threeRevision: THREE.REVISION, ...JSON.parse(result.stdout) };
await writeFile(new URL('../evidence/courtyard-shaders.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(`${report.programs.length} courtyard shader programs compiled and linked: ${report.renderer}.`);
