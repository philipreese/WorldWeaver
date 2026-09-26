# Verification and remaining release work

2026-09-26. The preview combines an authored opening with reusable settlement ecology. The required release is **incomplete**: general personal/institutional situations and persistent deprivation remain substantive gaps, alongside the browser, device, and experience checks below. Test counts establish specific properties, not enjoyment or visual quality.

## Retained evidence

| Evidence | Verified scope | Limits |
| --- | --- | --- |
| `npm test` — 145 passing | Existing simulation/history suites plus optional courtyard metadata, real channel connectivity, furniture editing, companion choices and twenty illustrated/Three.js scene checks | Node execution; renderer input tests use synthetic events |
| [UI report](../evidence/ui-integration.json) — 26 passing | Courtyard placement/move/rotation/removal, named companion appearance and repeated play, gated spring preview/commit, historical branch isolation and import/save recovery; existing app handlers: opening, saved customization, guide progression/restart, failed-save messaging, exploration panel, decision layers, history/fork, refuge, relic discovery, power, institution, background pause, generated settlement/buildings/decision and rewind | LinkeDOM and native Canvas; no browser engine, CSS layout, real touch, accessibility audit, or device performance |
| [Build report](../evidence/build-verification.json) | `/WorldWeaver/` HTTP path, 36 core precached responses, immutable release graph, separate main/comparison offline entries, HTTP-cache revalidation and cache-quota recovery | Worker evaluated in Node with a cache mock; actual browser offline reload and installation remain unverified |
| [Causal report](../evidence/causal-scenarios.json) | Preserved alternate futures, changed motives, exact decision context, director stops, three automated save-reload sequences | Agent-produced deterministic evidence; no human participants or qualitative session claims |
| [Courtyard render report](../evidence/courtyard-static-render-report.json) | Six reproducible frames: first visit, furnishings, companion, preview and restored spring | Native Canvas only; phone dimensions are not a real phone test |
| [Render report](../evidence/static-render-report.json) and `evidence/*.webp` | 10 retained engine 1.0.0 frames from the production renderer, including three life forms and surviving power/infrastructure | Static Canvas renders; `render-phone` describes dimensions only. Timings are single hosted Node renders, not sustained FPS |
| [Browser report](../evidence/browser-verification.json) | Earlier engine 1.0.0 opening/branch/guide/styles; current build fb2d8303 old-save notice, fresh v2 survey/recovery/migration explanation and paused reload | Agent mouse/keyboard walkthrough; no real phone, touch emulation, human playtesting, sustained FPS, or continuous video |
| [Courtyard browser report](../evidence/courtyard-browser-verification.json) and [fallback screenshot](../evidence/browser-courtyard-three-fallback.jpg) | Build `5639c231`: live illustrated/fallback furnishing, pet choices and repeat play, spring preview/commit/history, same-tab comparison, reload, normal-entry recovery and historical guards | Cloud Chrome disables WebGL; no 3D frame, camera/GPU check, real-device result or human playtest |
| [Portable examples](../public/worlds) | Four engine 2.0.0 histories exported and imported with exact state equality | Separate browser-context transfer remains unverified |

The [long-run correction report](SIMULATION_CORRECTION.md) compares the same 60 worlds before and after the engine change. Ecological tests change only routes, capacity, supplies, or source conditions; rename identities; and check conservation, prior knowledge, physical traces and immutable evidence. Versioned tests retain byte-identical v1 saves while exercising v2 replay/forks/recovery.

The following earlier exploratory review describes the original engine, not a substitute for the current matrix. The Tier 1 checkpoint at `67d6731` was verified before Tier 2 integration. Its committed save is retained as a compatibility fixture in `tests/history.test.js`. Independent agent review also exercised 40 mixed-command branch transcripts and 54 Tier 2 configurations through day 6000, and checked three prior Tier 1 histories. Those exploratory checks complement the retained tests; they were not browser or human playtests.

Review found and corrected historical digest leakage, save readback rollback, an unreachable relic intervention, invalid scene participants, information used before arrival, unaffordable refuge, and succession beyond the ordinary playable command horizon. The current independent review also corrected a history-trust loophole, full-pantries blocking migration, missing collective consumption in forecasts, invalid reoccupation capacity, and missing abandonment/causal traces. No critical defect remained from those reported findings; explicit model gaps remain.

The guide/customization review corrected a branch suggestion that retained an already-opened path, a stalled guide after all interventions were used, and a style-save success notice after storage failure. Cosmetic tests verify unchanged snapshots, decisions, fingerprints and hit targets; optional guide progress records interface actions only. The design invites learning through observation and comparison, but no educational efficacy claim or completed child playtest is made.

## Courtyard increment

The first #8 example is verified locally with the counts above. Independent review corrected an invalid home-trim identity, a disconnected-looking restored channel on older saves, stale save warnings after successful import, and fetch animation replay during saved-state loading. Cosmetic choices remain outside simulation fingerprints; the spring changes the current world only after an explicit available intervention. Restored gardens do not create a repeat chore.

Static scene renderings and synthetic phone-sized input coordinates do not establish actual phone layout, touch behavior or enjoyment. The short uncoached visit in #8 remains open, alongside the broader release work below.

## Optional Three.js comparison

The separate [courtyard comparison](THREE_COURTYARD_TEST.md) projects the same saved activities into a JSON-defined 3D scene. Thirteen GPU-independent tests verify bounded assets, shared geometry, saved-state projection, fetch lifecycle, ray picking, disposal, first-frame/context/shader failure recovery and bounded mobile resize allocation. Three additional DOM cases verify renderer injection, reset, save guards and a fresh-canvas fallback after startup or later rendering failure. The build keeps one immutable module graph per page and loads Three.js only on request. The published browser walkthrough reached the intended Three.js modules, but cloud Chrome reported `GL_VENDOR = Disabled` and could not create WebGL. The real illustrated fallback, shared activities, comparison navigation and saves passed the live checks in the report above. No WebGL frame or real-device performance result is claimed; 3D appearance and camera controls remain to verify in a WebGL-enabled browser.

A mobile report subsequently showed an empty scene while 3D controls remained active. The renderer previously guarded constructor failure only. Recovery now covers first-frame exceptions, shader errors, a lost context, zero draw calls and blank initial pixels; the active activity, choices and unsaved warning are preserved in the illustrated fallback. The first visible frame is attempted synchronously. Phone rendering uses capped 1.25 DPR, no multisample antialiasing and a 512-pixel shadow map, with no repeated buffer allocation for unchanged sizes. These changes mitigate failure and resource pressure; they do not establish the reporting phone's exact GPU cause or a successful 3D device result. The local downloadable problem report includes courtyard rendering status/error.

A subsequent device report confirmed shader compilation/linking failure, but the previous handler had discarded the compiler logs, so its exact shader/driver cause remains unknown. Confirmed shader failures now retry the same scene without shadows and then with Lambert lighting, at most once per profile. If all three profiles fail, the illustrated view takes over. Colors, emissive materials, transparency, the camera and saved activities survive a successful retry. Problem reports retain bounded compiler/link logs, material names, nearby source lines, context limits and the selected lighting profile, including after fallback.

`npm run verify:shaders` assembles the pinned Three.js programs for the scene, labels and shadow pass, then compiles and links **23 shader variants** in native Mesa OpenGL ES. All pass in the [retained report](../evidence/courtyard-shaders.json), including the original materials. This is actual GLSL compilation, separate from the synthetic rendering lifecycle tests; it is not WebGL rasterization or proof of compatibility with the reporting device. No successful phone 3D result is claimed.

## Reproduce

Core verification requires Node 22 or later and the pinned Three.js dependency:

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run examples
npm run build
npm run verify:build
npm run audit:world -- --engine-version 2.0.0 --label local-v2
```

On Linux, install `python3`, `libegl1` and `libgl1-mesa-dri`, then run `npm run verify:shaders` for native shader compilation. CI includes that check alongside check, test, build, and build verification, then retains `dist/` as the `worldweaver-production` artifact for 14 days. The deterministic build can always be recreated from source. The preview command is `npm run preview`; visit `http://localhost:4173/WorldWeaver/`.

The optional static rendering and DOM integration tools used for this evidence were LinkeDOM **0.18.12** and Skia Canvas **3.0.8**. They are development tools only. Install them in an external tools directory and set `LINKEDOM_MODULE` and `SKIA_CANVAS_MODULE` to their module directories, or install them temporarily in this checkout:

```sh
npm install --no-save --package-lock=false linkedom@0.18.12 skia-canvas@3.0.8
npm run verify:ui
npm run render:evidence
```

`verify:ui` also accepts `CANVAS_MODULE` pointing to `@napi-rs/canvas`; that backend was used for the courtyard integration run. The native binary must support the machine used to run it. These optional commands do not launch a browser. The ordinary illustrated view has no runtime library payload; the optional comparison loads the pinned Three.js modules from the same site.

## Causal and attention examples

Use seed 8417, temperate climate, balanced density, careful disposition. With the passage closed at the day-4 dilemma, Nera raises the seed vessels and leaves a Dry Loft. Open the passage on day 2 in a branch: Oren's repair arrives, Nera accepts it, Oren moves to Hearth, and a workshop and landing are built. The source future remains intact. A curious disposition with the passage closed produces a third choice: a living nursery and abandoned seed room. The player changes conditions, never selects the answer.

The [player guide](PLAYER_GUIDE.md) names the exact people, structures, controls, and underlying records. `two-tellings.json` contains both day-52 histories. The power emerges on day 13 in the early-contact example and day 25 in passive observation; these are outcomes of different causal histories, not a universal emergence date. Around day 365, Ivo's death and Ves's inherited obligation provide continuity beyond an individual lifetime.

Director measurement: **Hearth and Nera followed**, day 2 through day 62, **60 simulated days / 1,440 simulated hours**. The engine advanced one day per call; no real-time play speed was measured.

| Run | Quiet: count (per simulated hour) | Balanced: count (per simulated hour) | Attentive: count (per simulated hour) |
| --- | --- | --- | --- |
| Observe only | 4 (0.002778) | 12 (0.008333) | 12 (0.008333) |
| Open passage on day 2 | 3 (0.002083) | 13 (0.009028) | 15 (0.010417) |

Counts and exact records are generated in the causal report. **Interruptions per hour of real play are unmeasured.** Implementation-aware agent expectations for the route's immediate and later effects are recorded explicitly; they are not an independent prospective player prediction test. Three automated reload/advance/digest sequences do not establish that three return visits were enjoyable.

## Remaining acceptance work

These checks govern a release claim, not whether development may continue. Owner feedback can be short and focused; no exhaustive owner playthrough is required. Build and test the next playable slice while closing relevant defects.

Initial local HTTP/file preview was blocked. The owner subsequently authorized Pages, selected GitHub Actions, and allowed the review branch in the deployment environment. The public preview now supports cloud-browser checks. [Browser evidence](../evidence/browser-verification.json) records the exercised build and interactions; device and continuous-recording gates below remain open.

Before release, generalize the remaining personal/institutional dynamics and address or deliberately resolve persistent deprivation. The household subsystem is a genuine extension, not completion of the brief.

1. Run the real app on desktop, phone, and tablet in portrait and landscape. Exercise touch pan/pinch/select, text and focus behavior, muted/audio controls, reduced motion, camera recovery, and the entire opening-to-branch path.
2. Record a continuous neighborhood visit: follow an inhabitant's activity, inspect a physical trace, reach its historical event, revisit the same place in the past, and branch. Retain browser screenshots and label mouse/keyboard, touch, emulation, and real-device evidence accurately.
3. Measure sustained performance at representative populated states: target 30 FPS on a phone and 60 FPS on a capable desktop. Confirm quality settings preserve simulation behavior. Node render timings do not answer this.
4. On HTTPS or localhost, complete the first cache, reload with browser network disabled, test install behavior, and transfer an export to a separate browser context. Exercise background/reopen pause and recovery with real browser storage.
5. Conduct the brief's prospective intervention prediction and three short return sessions. Record who tested, what they found worthwhile, how they found it, interruption rates at stated speeds/follows, and unresolved usability issues. Human and agent reports must remain distinct.
6. Resolve resulting defects before marking the PR ready or declaring Tier 2 released. Issues #1–#3 track these gates; no Tier 3 expansion is underway.

## Deliberate limits

One finite world, three regions, four initial places and at most ten surveyed settlement sites, one realized power, and a compact authored cast. Household migration and births, synthetic bodies and collective nodes are aggregated. Named people do not move with anonymous household migrations; no general character-birth system exists. Food shortfall can persist without starvation mortality. The ecological ledger does not account for every authored or non-organic flow. History permits at most 6,000 days per branch, eight branches, and 1,200 retained commands including inherited commands; the interface advances one day per command. Exports are limited to 4 MB. Limits stop with an export-first explanation rather than discarding history. The UI follow list is limited to twelve interests.

Portable saves include the exact simulation version and replay fingerprints. Engines 1.0.0 and 2.0.0 remain separate; unknown versions or changed deterministic outcomes fail validation rather than silently migrating. Existing worlds keep their engine. Future rule changes must preserve replay or explicitly introduce a compatibility plan. Cloud sync and Tier 3 systems are out of scope.
