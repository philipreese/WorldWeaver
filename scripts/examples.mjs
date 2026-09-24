import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import {
  createHistory,
  applyCommand,
  currentWorld,
  forkHistory,
  serializeHistory,
  parseHistory,
  worldAt,
} from "../src/persistence/history.js";
import { createWorld, advance, intervene } from "../src/sim/world.js";
import { selectAttentionEvent, makeDigest } from "../src/director.js";
await mkdir("public/worlds", { recursive: true });
await mkdir("evidence", { recursive: true });
const opening = applyCommand(createHistory({ tier: 2 }), {
  type: "advance",
  days: 2,
});
let alternatives = applyCommand(opening, { type: "advance", days: 50 });
const source = JSON.stringify(currentWorld(alternatives));
alternatives = forkHistory(alternatives, 2, "The open passage");
alternatives = applyCommand(alternatives, {
  type: "intervene",
  intervention: { kind: "open-route", targetId: "r-hearth-lattice" },
});
alternatives = applyCommand(alternatives, { type: "advance", days: 50 });
assert.equal(JSON.stringify(alternatives.branches[0].head), source);
const wet = applyCommand(
  createHistory({
    tier: 2,
    seed: 2026,
    climate: "wet",
    temperament: "curious",
    density: "sparse",
  }),
  { type: "advance", days: 2 },
);
for (const [name, history] of [
  ["quiet-basin", opening],
  ["two-tellings", alternatives],
  ["wet-beginning", wet],
]) {
  const text = serializeHistory(history);
  assert.deepEqual(parseHistory(text), history);
  await writeFile(`public/worlds/${name}.json`, text + "\n");
}
const histories = alternatives.branches.map((branch) => {
  const w = branch.head,
    e = w.events.find((e) => e.kind === "seed-decision");
  return {
    branch: branch.name,
    day: w.tick,
    decision: e.decision.chosen,
    title: e.title,
    known: e.decision.known,
    alternatives: e.decision.alternatives,
    observed: e.observed,
    causes: e.causes,
    orenAt: w.characters.find((c) => c.id === "c-oren").settlementId,
    structures: w.settlements
      .find((s) => s.id === "s-hearth")
      .structures.map((s) => ({ id: s.id, name: s.name, eventId: s.eventId })),
    power: w.power?.name,
    powerFirstRecorded: w.power?.emergedAt,
  };
});
const motiveWorld = advance(
  createWorld({ tier: 2, temperament: "curious" }),
  4,
);
const motiveDecision = motiveWorld.events.find(
  (e) => e.kind === "seed-decision",
);
const pacing = [];
for (const route of ["observe", "open-east"])
  for (const attention of ["quiet", "balanced", "attentive"]) {
    let w = advance(createWorld({ tier: 2 }), 2);
    if (route === "open-east")
      w = intervene(w, { kind: "open-route", targetId: "r-hearth-lattice" });
    const stops = [];
    for (let i = 0; i < 60; i++) {
      const before = w.events.length;
      w = advance(w, 1);
      const e = selectAttentionEvent(
        w.events.slice(before),
        ["s-hearth", "c-nera"],
        attention,
      );
      if (e) stops.push({ day: e.tick, kind: e.kind, severity: e.severity });
    }
    pacing.push({
      route,
      attention,
      followed: ["s-hearth", "c-nera"],
      simulatedDays: 60,
      simulatedHours: 1440,
      stops: stops.length,
      stopsPerSimulatedHour: stops.length / 1440,
      stopRecords: stops,
      realPlayInterruptionsPerHour: null,
      speed:
        "Engine advanced one day per call; no real-play speed or wall-clock measurement.",
    });
  }
// These are sequential save reloads, not people or browser play sessions.
let h = opening;
const sessions = [];
for (const [name, days] of [
  ["The seed decision", 2],
  ["A transmitted repair", 12],
  ["The responding channel", 12],
]) {
  h = parseHistory(serializeHistory(h));
  const before = currentWorld(h).tick;
  h = applyCommand(h, { type: "advance", days });
  const w = currentWorld(h),
    digest = makeDigest(w, h.followed, before);
  sessions.push({
    name,
    fromDay: before,
    toDay: w.tick,
    recordedDiscoveries: digest.events.map((e) => e.title),
    openThreads: digest.threads.map((t) => t.title),
    qualitativeEnjoyment:
      "Not assessed. This is an automated load/advance/digest sequence.",
  });
}
await writeFile(
  "evidence/causal-scenarios.json",
  JSON.stringify(
    {
      kind: "Deterministic engine evidence; no human or browser playtesting.",
      histories,
      secondLook: {
        changedCondition:
          "Nera’s inherited disposition: careful → curious; route remains closed",
        resolution: motiveDecision.decision.chosen,
        decision: motiveDecision.decision,
        claim:
          "Relevant motive change produces a distinct material answer; not a statistical quality score.",
      },
      pacing,
      sessions,
      interventionPrediction: {
        tester: "Implementation-aware agent; not an independent blinded player",
        immediate: "Exposing the Silt Saddle makes its passage usable.",
        later:
          "If done before the seed decision, Oren’s known repair can change Nera’s alternative set.",
        status:
          "Both confirmed by recorded route and decision state. These expectations were derived from known rules; no prospective human prediction test is claimed.",
      },
    },
    null,
    2,
  ) + "\n",
);
assert.equal(
  worldAt(alternatives, 2, "b1").routes.find((r) => r.id === "r-hearth-lattice")
    .open,
  false,
);
console.log(
  "Generated three validated portable worlds, alternate-history evidence and simulated attention measurements.",
);
