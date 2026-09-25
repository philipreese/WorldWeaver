# Courtyard renderer comparison

This is a bounded Three.js experiment around the same saved activities. The main game still opens with the illustrated view.

- [Open the 3D test](https://philipreese.github.io/WorldWeaver/lab/?renderer=three)
- [Open the illustrated comparison](https://philipreese.github.io/WorldWeaver/lab/?renderer=canvas)

Use the picture-style links in one tab to compare the same arrangement. Both views share the browser's saved world. Avoid editing it in two tabs at once. The switch is blocked while the app reports unsaved changes; export before leaving that session.

Try placing and moving a bench, changing the companion's appearance, throwing a sunseed, and connecting the spring. In 3D, drag to turn the view, pinch or scroll to zoom, and use **Reset view** to return to the activity camera. The wider basin and simulation remain the existing implementation.

The decision is whether this makes the same actions clearer and more inviting, with acceptable loading and responsiveness on a real phone. A successful build or an agent walkthrough does not answer the enjoyment question. This is a stylized primitive-model study, not finished character art or a full 3D world.

## Content and behavior

| Source | Responsibility |
| --- | --- |
| `public/assets/courtyard-three.json` | Materials, reusable models, scene placements, lighting and camera presets |
| `src/view/neighborhood-three-view.js` | Build the scene, project saved choices, animate fetch, raycast taps and operate the camera |
| `src/neighborhood.js` | Shared furnishing/companion vocabulary, validated choices and channel connectivity |
| `src/neighborhood-ui.js` | The same activity controls for both renderers |

Models and placements are data. Simulation and interaction rules remain JavaScript. The existing catalogs remain JavaScript exports; this experiment does not claim that every content definition has been extracted. Authored glTF/GLB models could replace the primitive models in a later art pass.

Three.js **0.186.1** is pinned in the package lock. The build copies the necessary modules and MIT license from the installed package; no runtime CDN is used. If loading or creating the 3D view fails, the app creates a fresh Canvas2D element and explains the illustrated fallback. Rendering choices do not change simulation versions, fingerprints, days, commands or historical events.

## Run and build

```sh
npm ci --ignore-scripts
npm run dev
# Open http://localhost:4173/lab/
npm run check
npm test
npm run build
npm run verify:build
```

Production HTML points at one content-versioned module graph under `releases/<hash>/`. Main and lab share it. The offline worker fetches navigation pages from the network when available, then falls back to the corresponding cached entry. Three.js and the 3D scene load only when requested and are cached after use. Core installation must finish before the worker activates; no open page is forced to reload and no saved world is cleared.

Retained verification distinguishes Node tests, synthetic DOM interaction, browser GPU rendering and real-device observations. Phone touch, sustained phone performance and uncoached play remain checks to perform on the actual test, not inferred properties of choosing Three.js.

## Published check

The live agent walkthrough of build `5639c231` verified furniture, companion choices and repeat play, spring preview/commit/history, reload and same-tab switching. Cloud Chrome has WebGL disabled and used the intended illustrated fallback. Actual 3D appearance, orbit/reset and GPU performance remain unverified in that environment. See the [browser report](../evidence/courtyard-browser-verification.json) and its explicitly labeled [fallback screenshot](../evidence/browser-courtyard-three-fallback.jpg).

## Blank-scene recovery

The 3D view now attempts its first visible frame immediately and checks for shader/context failures, absent draw calls and blank initial pixels. A failure at startup or during play replaces the canvas with the illustrated view while keeping the current activity and choices. Phone rendering avoids multisample antialiasing, caps DPR at 1.25 and uses a 512-pixel shadow map; hidden/repeated layout observations no longer allocate a desktop-size buffer.

If a device still cannot show 3D, **Settings → Report a problem** includes the courtyard renderer and its last error in the locally downloaded report. No report is sent automatically. The exact cause of the reported phone failure remains unconfirmed; cloud Chrome still cannot produce WebGL frames.
