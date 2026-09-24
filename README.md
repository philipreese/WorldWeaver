# Worldweaver — The Quiet Basin

A finite, explorable science-fiction world whose people make their own choices and leave a history you can inspect. Browser-first, statically served, no accounts, services, runtime AI, or paid dependencies.

**Implementation in progress. The required Tier 2 release is not complete.** See [implementation status](docs/IMPLEMENTATION_STATUS.md) for the current gate and honest verification limits. The [v0.4 brief](docs/worldweaver-build-prompt-v0.4.md) is the source of truth.

## Run locally

Requires **Node.js 22 or later**. No dependency installation is needed.

```sh
git clone https://github.com/philipreese/WorldWeaver.git
cd WorldWeaver
git switch feat/tier-2-world
npm run dev
```

Open `http://localhost:4173`. `PORT=8080 npm run dev` selects another port on Unix; on PowerShell use `$env:PORT=8080; npm run dev`.

```sh
npm test          # simulation, history, director and recovery invariants
npm run check     # JavaScript syntax
npm run build     # standalone production files in dist/
npm run preview   # serve the production build on port 4173
```

Do not run dev and preview on the same port simultaneously. Preview also supports `http://localhost:4173/WorldWeaver/` for subpath checks. Serve the contents of `dist/` using any static web server. Opening `index.html` directly as a file is unsupported because the app uses JavaScript modules.

Production builds generate a content-versioned service worker and relative asset paths. Installation and offline use require HTTPS or localhost, and a successfully completed first cache. Cloud sync is out of scope; export saves to transfer devices.

## Start playing

Meet Nera in Hearth. Inspect the archive, follow a person or place, then decide whether to open the eastern passage. **Next moment** advances at most fourteen days and stops for a meaningful event affecting your follow list. Open History to ask why. Visit day 2 on the timeline and **Branch here** to explore an alternate future without deleting the original.

Time advances only with your permission and pauses on backgrounding. You may explore while paused. See the [player guide](docs/PLAYER_GUIDE.md) for controls and a complete alternate-history demonstration.

## Development

- `src/sim/`: deterministic world and recorded decisions; no rendering or clock dependency.
- `src/persistence/`: commands, checkpoints, branches, validation, staged saves and recovery.
- `src/director.js`: follow-driven attention and factual digests.
- `src/view/`: Canvas world; reads state but never changes history.
- `src/app.js`: interface and bounded, interruptible advancement.
- `tests/`: reproducible invariant and causal-path tests.

[Shared contracts](docs/CONTRACTS.md) explain interfaces and protected invariants. Release gates: [Tier 1](https://github.com/philipreese/WorldWeaver/issues/1), [Tier 2](https://github.com/philipreese/WorldWeaver/issues/2), [verification](https://github.com/philipreese/WorldWeaver/issues/3). Work is reviewed in [PR #4](https://github.com/philipreese/WorldWeaver/pull/4). No public deployment is part of this change.
