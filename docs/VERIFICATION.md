# Verification and remaining release work

2026-09-24. Tier 2 mechanics are implemented. The required release is **incomplete** until the browser, device, and experience checks below are completed. Test counts establish specific properties, not enjoyment or visual quality.

## Retained evidence

| Evidence | Verified scope | Limits |
| --- | --- | --- |
| `npm test` — 64 passing | 22 simulation, 23 history/recovery, 13 director, 6 renderer tests | Node execution; renderer input tests use synthetic events |
| [UI report](../evidence/ui-integration.json) — 11 passing | Real app handlers: opening, exploration panel, decision layers, history/fork, refuge, relic discovery, power, institution, background pause | LinkeDOM and Skia Canvas; no browser engine, CSS layout, real touch, accessibility audit, or device performance |
| [Build report](../evidence/build-verification.json) | `/WorldWeaver/` HTTP path, 19 precached responses, worker activation, simulated offline cache reads | Worker evaluated in Node with a cache mock; actual browser offline reload and installation remain unverified |
| [Causal report](../evidence/causal-scenarios.json) | Preserved alternate futures, changed motives, exact decision context, director stops, three automated save-reload sequences | Agent-produced deterministic evidence; no human participants or qualitative session claims |
| [Render report](../evidence/static-render-report.json) and `evidence/*.webp` | 10 frames from the production renderer, including three life forms and surviving power/infrastructure | Static Canvas renders; `render-phone` describes dimensions only. Timings are single hosted Node renders, not sustained FPS |
| [Portable examples](../public/worlds) | Three histories exported and imported with exact state equality | Separate browser-context transfer remains unverified |

The Tier 1 checkpoint at `67d6731` was verified before Tier 2 integration. Its committed save is retained as a compatibility fixture in `tests/history.test.js`. Independent agent review also exercised 40 mixed-command branch transcripts and 54 Tier 2 configurations through day 6000, and checked three prior Tier 1 histories. Those exploratory checks complement the retained tests; they were not browser or human playtests.

Review found and corrected historical digest leakage, save readback rollback, an unreachable relic intervention, invalid scene participants, information used before arrival, unaffordable refuge, and succession beyond the ordinary playable command horizon. No confirmed protected-invariant defect remained in that source-level review.

## Reproduce

Core verification requires Node 22 or later and no dependency installation:

```sh
npm run check
npm test
npm run examples
npm run build
npm run verify:build
```

CI runs check, test, build, and build verification, then retains `dist/` as the `worldweaver-production` artifact for 14 days. The deterministic build can always be recreated from source. The preview command is `npm run preview`; visit `http://localhost:4173/WorldWeaver/`.

The optional static rendering and DOM integration tools used for this evidence were LinkeDOM **0.18.12** and Skia Canvas **3.0.8**. They are development tools only. Install them in an external tools directory and set `LINKEDOM_MODULE` and `SKIA_CANVAS_MODULE` to their module directories, or install them temporarily in this checkout:

```sh
npm install --no-save --package-lock=false linkedom@0.18.12 skia-canvas@3.0.8
npm run verify:ui
npm run render:evidence
```

Skia's native binary must support the machine used to run it. These optional commands do not launch a browser. The runtime game remains dependency-free.

## Causal and attention examples

Use seed 8417, temperate climate, balanced density, careful disposition. With the passage closed at the day-4 dilemma, Nera raises the seed vessels and leaves a Dry Loft. Open the passage on day 2 in a branch: Oren's repair arrives, Nera accepts it, Oren moves to Hearth, and a workshop and landing are built. The source future remains intact. A curious disposition with the passage closed produces a third choice: a living nursery and abandoned seed room. The player changes conditions, never selects the answer.

The [player guide](PLAYER_GUIDE.md) names the exact people, structures, controls, and underlying records. `two-tellings.json` contains both day-52 histories. The power emerges on day 13 in the early-contact example and day 24 in passive observation; these are outcomes of different causal histories, not a universal emergence date. Around day 365, Ivo's death and Ves's inherited obligation provide continuity beyond an individual lifetime.

Director measurement: **Hearth and Nera followed**, day 2 through day 62, **60 simulated days / 1,440 simulated hours**. The engine advanced one day per call; no real-time play speed was measured.

| Run | Quiet: count (per simulated hour) | Balanced: count (per simulated hour) | Attentive: count (per simulated hour) |
| --- | --- | --- | --- |
| Observe only | 4 (0.002778) | 8 (0.005556) | 8 (0.005556) |
| Open passage on day 2 | 3 (0.002083) | 8 (0.005556) | 10 (0.006944) |

Counts and exact records are generated in the causal report. **Interruptions per hour of real play are unmeasured.** Implementation-aware agent expectations for the route's immediate and later effects are recorded explicitly; they are not an independent prospective player prediction test. Three automated reload/advance/digest sequences do not establish that three return visits were enjoyable.

## Remaining acceptance work

The available browser rejected both local HTTP access and local file navigation. No public deployment was authorized. This blocked direct app browser inspection and capture in this workspace; it did not block the Node, source, and static-render work above.

1. Run the real app on desktop, phone, and tablet in portrait and landscape. Exercise touch pan/pinch/select, text and focus behavior, muted/audio controls, reduced motion, camera recovery, and the entire opening-to-branch path.
2. Record a continuous neighborhood visit: follow an inhabitant's activity, inspect a physical trace, reach its historical event, revisit the same place in the past, and branch. Retain browser screenshots and label mouse/keyboard, touch, emulation, and real-device evidence accurately.
3. Measure sustained performance at representative populated states: target 30 FPS on a phone and 60 FPS on a capable desktop. Confirm quality settings preserve simulation behavior. Node render timings do not answer this.
4. On HTTPS or localhost, complete the first cache, reload with browser network disabled, test install behavior, and transfer an export to a separate browser context. Exercise background/reopen pause and recovery with real browser storage.
5. Conduct the brief's prospective intervention prediction and three short return sessions. Record who tested, what they found worthwhile, how they found it, interruption rates at stated speeds/follows, and unresolved usability issues. Human and agent reports must remain distinct.
6. Resolve resulting defects before marking the PR ready or declaring Tier 2 released. Issues #1–#3 track these gates; no Tier 3 expansion is underway.

## Deliberate limits

One finite world, three regions, four places, one realized power, and a compact authored cast. Synthetic and collective lives are aggregated. History permits at most 6,000 days per branch, eight branches, and 1,200 retained commands including inherited commands; the interface advances one day per command. Exports are limited to 4 MB. Limits stop with an export-first explanation rather than discarding history. The UI follow list is limited to twelve interests.

Portable saves include the exact simulation version and replay fingerprints. Unsupported versions or changed deterministic outcomes fail validation rather than silently migrating. Future rule changes must preserve replay or explicitly introduce a compatibility plan. Cloud sync and Tier 3 systems are out of scope.
