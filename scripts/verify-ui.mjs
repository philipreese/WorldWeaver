/** Node DOM integration checks, NOT a browser/layout/touch test.
 * Optional dev tools: linkedom and skia-canvas (module directories may be passed
 * via LINKEDOM_MODULE and SKIA_CANVAS_MODULE). Core game/test suite needs neither.
 */
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { parseHistory, currentWorld } from "../src/persistence/history.js";
const require = createRequire(import.meta.url);
const { parseHTML } = require(process.env.LINKEDOM_MODULE || "linkedom");
const { Canvas } = require(process.env.SKIA_CANVAS_MODULE || "skia-canvas");
const { window, document } = parseHTML(await readFile("index.html", "utf8"));
const slots = new Map();
const storage = {
  getItem: (key) => slots.get(key) ?? null,
  setItem: (key, value) => slots.set(key, String(value)),
  removeItem: (key) => slots.delete(key),
};
const makeCanvas = () => new Canvas(1440, 760);
const createElement = document.createElement.bind(document);
document.createElement = (tag) =>
  tag === "canvas" ? makeCanvas() : createElement(tag);
const canvas = document.getElementById("world"),
  backing = makeCanvas();
canvas.getContext = () => backing.getContext("2d");
canvas.getBoundingClientRect = () => ({
  left: 0,
  top: 77,
  width: 1440,
  height: 760,
});
for (const prop of ["width", "height"])
  Object.defineProperty(canvas, prop, {
    get: () => backing[prop],
    set: (value) => (backing[prop] = value),
  });
const dialog = document.getElementById("modal");
dialog.showModal = () => {
  dialog.open = true;
};
dialog.close = () => {
  dialog.open = false;
};
const matchMedia = () => ({ matches: true, addEventListener() {} });
Object.assign(globalThis, {
  window,
  document,
  matchMedia,
  requestAnimationFrame: () => 1,
  cancelAnimationFrame() {},
  ResizeObserver: class {
    observe() {}
    disconnect() {}
  },
});
Object.defineProperty(window, "localStorage", { value: storage });
window.matchMedia = matchMedia;
Object.defineProperty(globalThis, "navigator", {
  value: {},
  configurable: true,
});
await import("../src/app.js");
const $ = (selector) => {
  const element = document.querySelector(selector);
  assert.ok(element, `Missing control: ${selector}`);
  return element;
};
const click = (selector) => $(selector).click();
const saved = () => parseHistory(slots.get("worldweaver.save.current"));
const cases = [];
assert.equal($("#clock").textContent, "Day 2");
assert.equal($("#run-state").textContent, "Paused");
cases.push("Opening initializes paused on day 2 with saved development");
click('[data-entity="c-nera"]');
assert.match($("#inspector").textContent, /Nera/);
assert.match($("#inspector").textContent, /Expose the Silt Saddle/);
cases.push("Meet Nera reaches a conditional intervention and recorded history");
click('[data-visit="c-nera"]');
assert.equal($("#inspector").hidden, true);
click("#step");
assert.equal($("#inspector").hidden, true);
cases.push("Walking with a person does not reopen the panel on advancement");
click("#step");
const first = saved();
assert.equal(currentWorld(first).flags.archiveResolved, "raise");
assert.equal(currentWorld(first).tick, 4);
click('[data-tab="chronicle"]');
const decision = currentWorld(first).events.find(
  (e) => e.kind === "seed-decision",
);
click(`[data-event="${decision.id}"]`);
assert.match($("#inspector").textContent, /Recorded decision/);
assert.match($("#inspector").textContent, /Cultural interpretations/);
cases.push("Closed-route choice reaches its separate explanation layers");
const range = $("#timeline-slider");
range.value = "2";
range.dispatchEvent(new window.Event("input", { bubbles: true }));
assert.equal($("#step").disabled, true);
assert.equal($("#historic-banner").hidden, false);
assert.match($("#journal-content").textContent, /No|Day|recorded|development/i);
click("#branch-here");
assert.equal(saved().branches.length, 2);
assert.equal(currentWorld(saved()).tick, 2);
click('[data-entity="s-hearth"]');
click('[data-intervention="open-east"]');
click("#step");
click("#step");
const fork = saved();
assert.equal(currentWorld(fork).flags.archiveResolved, "exchange");
assert.equal(fork.branches[0].head.flags.archiveResolved, "raise");
assert.equal(fork.branches[0].head.tick, 4);
cases.push(
  "Historical controls are read-only; branch changes a decision and preserves source future",
);
click('[data-tab="followed"]');
click('[data-entity="s-hollow"]');
assert.ok($('[data-intervention="reveal-memory"]'));
click('[data-intervention="reveal-memory"]');
assert.equal(currentWorld(saved()).flags.relicRevealed, true);
cases.push("Structure-targeted discovery intervention is reachable");
click('[data-tab="followed"]');
click('[data-entity="s-hearth"]');
click('[data-entity="k-hearth-door"]');
assert.match($("#inspector").textContent, /First recorded on day 0/);
assert.match($("#inspector").textContent, /Lore · not recorded history/);
cases.push("Surveyed ancient trace distinguishes lore from recorded history");
click("#settings");
assert.equal(dialog.open, true);
assert.ok($("#horizon"));
assert.ok($("#attention"));
dialog.close();
const before = JSON.stringify(currentWorld(saved()));
document.hidden = true;
document.dispatchEvent(new window.Event("visibilitychange"));
assert.equal($("#run-state").textContent, "Paused");
assert.equal(JSON.stringify(currentWorld(saved())), before);
cases.push("Background handler pauses and preserves exact world state");
await mkdir("evidence", { recursive: true });
await writeFile(
  "evidence/ui-integration.json",
  JSON.stringify(
    {
      kind: "Node DOM + Canvas integration; not browser execution, layout, performance, touch or human playtesting.",
      passed: cases.length,
      cases,
    },
    null,
    2,
  ) + "\n",
);
console.log(cases.map((item) => "PASS " + item).join("\n"));
process.exit(0);
