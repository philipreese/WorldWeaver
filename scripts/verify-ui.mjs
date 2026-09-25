/** Node DOM integration checks, NOT a browser/layout/touch test.
 * Optional dev tools: linkedom and skia-canvas or @napi-rs/canvas (module directories
 * via LINKEDOM_MODULE and CANVAS_MODULE/SKIA_CANVAS_MODULE). Core game needs neither.
 */
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { parseHistory, currentWorld, worldAt } from "../src/persistence/history.js";
import { getInterventions } from "../src/sim/world.js";
const require = createRequire(import.meta.url);
const { parseHTML } = require(process.env.LINKEDOM_MODULE || "linkedom");
const { Canvas } = require(process.env.CANVAS_MODULE || process.env.SKIA_CANVAS_MODULE || "skia-canvas");
const { window, document } = parseHTML(await readFile("index.html", "utf8"));
const slots = new Map();
let failStorage = false;
const storage = {
  getItem: (key) => slots.get(key) ?? null,
  setItem: (key, value) => {
    if (failStorage) throw new Error("Test storage is full");
    slots.set(key, String(value));
  },
  removeItem: (key) => slots.delete(key),
};
const makeCanvas = () => new Canvas(1440, 760);
const backings = new WeakMap();
const backingFor = (element) => {
  if (!backings.has(element)) {
    const canvas = makeCanvas();
    const context = canvas.getContext("2d");
    const drawImage = context.drawImage.bind(context);
    context.drawImage = (source, ...args) => drawImage(backings.get(source) || source, ...args);
    backings.set(element, canvas);
  }
  return backings.get(element);
};
const canvasPrototype = Object.getPrototypeOf(document.getElementById("world"));
canvasPrototype.getContext = function () { return backingFor(this).getContext("2d"); };
canvasPrototype.getBoundingClientRect = () => ({
  left: 0,
  top: 77,
  width: 1440,
  height: 760,
});
for (const prop of ["width", "height"])
  Object.defineProperty(canvasPrototype, prop, {
    get() { return backingFor(this)[prop]; },
    set(value) { backingFor(this)[prop] = value; },
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
const click = (selector) => {
  const before = $("#clock").textContent;
  $(selector).click();
  if (selector === "#step") {
    assert.notEqual($("#clock").textContent, before, `Clock stalled: ${$("#toast").textContent}`);
    assert.doesNotMatch($("#save-state").textContent, /Save failed/, $("#toast").textContent);
  }
};
let parsedSaveText, parsedSave;
const saved = () => {
  const text = slots.get("worldweaver.save.current");
  if (text !== parsedSaveText) {
    parsedSave = parseHistory(text);
    parsedSaveText = text;
  }
  return parsedSave;
};
const displayedDay = () => {
  const match = /^Day (\d+)$/.exec($("#clock").textContent);
  assert.ok(match, "The current day must be displayed.");
  return Number(match[1]);
};
const cases = [];
assert.equal($("#clock").textContent, "Day 2");
assert.equal($("#run-state").textContent, "Paused");
assert.equal(currentWorld(saved()).tier, 2);
cases.push("Tier 2 opening initializes paused on day 2 with saved development");
const beforeCourtyard = JSON.stringify(currentWorld(saved()));
assert.equal($("#neighborhood").hidden, false);
assert.match($(".nh-panel").textContent, /visitor in Hearth/);
assert.equal($(".timebar").inert, true);
const chooseSpot = (value) => {
  const select = $("[data-nh-slot-picker]");
  for (const option of select.querySelectorAll("option")) option.removeAttribute("selected");
  select.querySelector(`option[value="${value}"]`).selected = true;
  select.dispatchEvent(new window.Event("change", { bubbles: true }));
};
click('.nh-activities [data-nh-mode="decorate"]');
click('[data-nh-item="bench"]');
chooseSpot("porch-left");
click('[data-nh-action="rotate"]');
click('[data-nh-action="move"]');
chooseSpot("lawn-right");
assert.deepEqual(saved().neighborhood.items, { "lawn-right": { itemId: "bench", rotation: 1 } });
click('[data-nh-item="lantern"]');
chooseSpot("garden-right");
click('[data-nh-action="remove"]');
assert.equal(saved().neighborhood.items["garden-right"], undefined);
cases.push("Courtyard furniture can be placed, turned, moved and put away using semantic controls");
click('.nh-activities [data-nh-mode="companion"]');
$("[name=companion-name]").value = "Aster";
$("[data-nh-name-form]").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
click('[data-nh-color="moss"]');
click('[data-nh-accessory="scarf"]');
click('[data-nh-action="toss"]');
click('[data-nh-action="toss"]');
assert.equal(saved().neighborhood.companion.name, "Aster");
assert.equal(saved().neighborhood.companion.color, "moss");
assert.equal(saved().neighborhood.companion.accessory, "scarf");
assert.equal(saved().neighborhood.companion.tosses, 2);
assert.equal(JSON.stringify(currentWorld(saved())), beforeCourtyard);
cases.push("Named, colored and accessorized companion can play repeatedly without advancing or rewriting the world");
click('.nh-activities [data-nh-mode="water"]');
assert.equal($('[data-nh-action="restore"]').disabled, true);
click('[data-nh-action="restore"]');
click('[data-nh-channel="3"]');
click('[data-nh-channel="1"]');
assert.equal($('[data-nh-action="restore"]').disabled, false);
assert.match($(".nh-flow-state").textContent, /clear path/);
assert.equal(JSON.stringify(currentWorld(saved())), beforeCourtyard);
click('[data-nh-action="exit"]');
assert.equal($("#neighborhood").hidden, true);
assert.equal($(".timebar").inert, false);
cases.push("Channel preview follows actual connectivity, blocks an incomplete path, and waits for an explicit world intervention");
click('[data-action="stats"]');
assert.doesNotMatch($("#modal-content").textContent, /Undersong/);
dialog.close();
click('[data-entity="c-nera"]');
assert.match($("#inspector").textContent, /Nera/);
assert.match($("#inspector").textContent, /Open the path/);
assert.deepEqual(saved().guide.completed, ["meet"]);
const beforeStyle = JSON.stringify(currentWorld(saved()));
click('[data-style-person="c-nera"]');
click('[data-style-color="jade"]');
click('[data-person-accessory="cap"]');
assert.equal(saved().personalization.people["c-nera"].color, "jade");
assert.equal(saved().personalization.people["c-nera"].accessory, "cap");
assert.ok(document.querySelector('#modal-content [data-portrait-accessory="cap"]'));
assert.equal($("[data-style-color='jade']").getAttribute("aria-pressed"), "true");
const neraHome = currentWorld(saved()).characters.find((c) => c.id === "c-nera").homeId;
click(`#modal-content [data-style-home="${neraHome}"]`);
click('[data-style-color="rose"]');
click('[data-decoration="lantern"]');
assert.deepEqual(saved().personalization.homes[neraHome], { color: "rose", decoration: "lantern" });
assert.equal(JSON.stringify(currentWorld(saved())), beforeStyle);
click('[data-action="style-done"]');
assert.ok(saved().guide.completed.includes("style"));
cases.push("Character and shared-home styling survives saved reload without changing time, events or decisions");
click('[data-person-stats="c-nera"]');
assert.match($("#modal-content").textContent, /Curiosity/);
assert.match($("#modal-content").textContent, /Personal memories/);
dialog.close();
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
assert.ok(first.guide.completed.includes("watch"));
click("#help");
assert.match($("#modal-content").textContent, /Notice what changes/);
click('#modal-content [data-action="guide-next"]');
assert.equal($("[data-event-explanation]").hasAttribute("open"), true);
assert.ok(saved().guide.completed.includes("why"));
cases.push("The guide progresses through real actions and opens the recorded decision explanation");
click('[data-tab="chronicle"]');
const decision = currentWorld(first).events.find(
  (e) => e.kind === "seed-decision",
);
click(`[data-event="${decision.id}"]`);
assert.equal($("[data-event-explanation]").hasAttribute("open"), false);
assert.match(
  $("[data-event-explanation] summary").textContent,
  /Why did this happen/,
);
assert.match($("#inspector").textContent, /Recorded decision/);
assert.doesNotMatch($("#inspector").textContent, /Cultural interpretations/);
cases.push("Closed-route choice reaches its separate explanation layers");
const range = $("#timeline-slider");
range.value = "2";
range.dispatchEvent(new window.Event("input", { bubbles: true }));
assert.equal($("#step").disabled, true);
assert.equal($("#historic-banner").hidden, false);
assert.equal($("#courtyard").disabled, true);
click("#courtyard");
assert.equal($("#neighborhood").hidden, true);
click('[data-entity="c-nera"]');
assert.equal(document.querySelector('[data-style-person="c-nera"]'), null);
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
assert.equal(fork.personalization.people["c-nera"].color, "jade");
assert.equal(fork.neighborhood.companion.name, "Aster");
assert.deepEqual(fork.neighborhood.items, { "lawn-right": { itemId: "bench", rotation: 1 } });
assert.deepEqual(new Set(fork.guide.completed), new Set(["meet", "style", "watch", "why", "branch", "possibility"]));
cases.push(
  "Historical controls are read-only; branch changes a decision and preserves source future",
);
const sourceBeforeSpring = JSON.stringify(saved().branches[0]);
const pastBeforeSpring = JSON.stringify(worldAt(saved(), 3));
const habitatBeforeSpring = currentWorld(saved()).settlements.find(place => place.id === "s-hearth").habitat;
click("#courtyard");
click('.nh-activities [data-nh-mode="water"]');
click('[data-nh-action="restore"]');
assert.equal(currentWorld(saved()).flags.habitatRestored, true);
assert.equal(currentWorld(saved()).tick, 4);
assert.ok(currentWorld(saved()).settlements.find(place => place.id === "s-hearth").habitat > habitatBeforeSpring);
assert.ok(currentWorld(saved()).events.some(event => event.kind === "spring-restored"));
assert.equal(JSON.stringify(saved().branches[0]), sourceBeforeSpring);
assert.equal(JSON.stringify(worldAt(saved(), 3)), pastBeforeSpring);
assert.equal(document.querySelector('[data-nh-action="restore"]'), null);
click('[data-nh-action="inspect"]');
assert.match($("#inspector").textContent, /spring|water/i);
assert.equal($("#neighborhood").hidden, true);
cases.push("Opening the spring records a real habitat intervention; its record is reachable, prior days and source future remain unchanged");
click('[data-entity="s-hearth"]');
// The new resource economy does not promise a refuge on a scripted day.
while (currentWorld(saved()).tick < 400 && !getInterventions(currentWorld(saved())).find(item => item.id === "offer-refuge").available) click("#step");
assert.ok(getInterventions(currentWorld(saved())).find(item => item.id === "offer-refuge").available);
click('[data-possibilities="s-hearth"]');
assert.equal(dialog.open, true);
click('#modal-content [data-intervention="offer-refuge"]');
assert.equal(dialog.open, false);
click("#step");
const mixed = currentWorld(saved()).settlements.find(
  (s) => s.id === "s-hearth",
);
assert.equal(mixed.synthetics, 2);
assert.equal(mixed.collective, 3);
click('[data-entity="s-hearth"]');
assert.match($("#inspector").textContent, /Shell integrity/);
assert.match($("#inspector").textContent, /Hydration/);
cases.push(
  "Possibilities opens conditional refuge; arrivals expose distinct needs in inspection",
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
while (currentWorld(saved()).tick < 400 && !currentWorld(saved()).events.some(event => event.kind === "channel-authority-ended")) click("#step");
const inspectionDay = currentWorld(saved()).tick;
assert.ok(
  currentWorld(saved()).events.some((e) => e.kind === "power-redistribution"),
);
click('[data-tab="followed"]');
click('[data-entity="p-undersong"]');
assert.match($("#inspector").textContent, /Observed presence/);
assert.match($("#inspector").textContent, /Cultural interpretation/);
click('[data-follow="p-undersong"]');
assert.ok(saved().followed.includes("p-undersong"));
cases.push(
  "Material power emerges in play, remains inspectable, and can be followed",
);
click('[data-entity="i-confluence"]');
assert.equal(
  currentWorld(saved()).institutions.find((i) => i.id === "i-confluence")
    .status,
  "collapsed",
);
assert.match($("#inspector").textContent, /Participants/);
assert.match($("#inspector").textContent, /Nera/);
cases.push(
  "Institution collapse retains accessible participants and recorded history",
);
click('[data-action="stats"]');
assert.match($("#modal-content").textContent, /Different futures kept/);
assert.match($("#modal-content").textContent, /Times the Undersong answered/);
dialog.close();
cases.push(
  "Optional world and character statistics expose recorded data without advancing time",
);
click("#help");
click('[data-action="guide-restart"]');
assert.deepEqual(saved().guide.completed, []);
click('[data-action="guide-dismiss"]');
assert.equal(saved().guide.dismissed, true);
assert.equal($("#guide-card").hidden, true);
click("#help");
click('#modal-content [data-action="guide-next"]');
assert.equal(saved().guide.dismissed, false);
assert.ok(saved().guide.completed.includes("meet"));
assert.equal(currentWorld(saved()).tick, inspectionDay);
cases.push("Guide dismissal, reopening and restart preserve the existing world and recorded styles");
const lastGoodSave = slots.get("worldweaver.save.current");
failStorage = true;
click('[data-style-person="c-nera"]');
click('[data-style-color="lilac"]');
click('[data-action="style-done"]');
assert.equal(slots.get("worldweaver.save.current"), lastGoodSave);
assert.match($("#save-state").textContent, /Save failed/);
assert.doesNotMatch($("#toast").textContent, /Your look is kept/);
click("#settings");
const settingsNavigation = new window.Event("click", { bubbles: true, cancelable: true });
$("[data-courtyard-test]").dispatchEvent(settingsNavigation);
assert.equal(settingsNavigation.defaultPrevented, true, "Settings must preserve unsaved changes when switching renderers");
assert.match($("#toast").textContent, /before switching views/);
dialog.close();
failStorage = false;
click('[data-style-person="c-nera"]');
click('[data-action="style-done"]');
assert.equal(saved().personalization.people["c-nera"].color, "lilac");
cases.push("A failed style save preserves the last good file and never claims the new look is saved");
click("#courtyard");
click('.nh-activities [data-nh-mode="companion"]');
const priorCompanionSave = slots.get("worldweaver.save.current");
failStorage = true;
click('[data-nh-color="frost"]');
assert.equal(slots.get("worldweaver.save.current"), priorCompanionSave);
assert.equal($(".nh-save-warning").hidden, false);
assert.match($(".nh-status").textContent, /save|storage|export/i);
failStorage = false;
click('[data-nh-action="toss"]');
assert.equal(saved().neighborhood.companion.color, "frost");
assert.equal($(".nh-save-warning").hidden, true);
const recoveredSave = slots.get("worldweaver.save.current");
failStorage = true;
click('[data-nh-color="plum"]');
assert.equal($(".nh-save-warning").hidden, false);
failStorage = false;
await $("#import-file").onchange({ target: { value: "", files: [{ size: recoveredSave.length, text: async () => recoveredSave }] } });
click("#courtyard");
assert.equal($(".nh-save-warning").hidden, true);
assert.match($("#save-state").textContent, /All changes saved/);
assert.equal(saved().neighborhood.companion.color, "frost");
click('[data-nh-action="exit"]');
cases.push("Failed courtyard saving preserves the prior archive; recovery and successful import clear stale warnings without losing valid choices");
click("#settings");
assert.equal(dialog.open, true);
assert.ok($("#horizon"));
assert.ok($("#attention"));
click('[data-action="report"]');
$("#problem-note").value = "The path was hard to find.";
let reportBlob;
const originalObjectURL = URL.createObjectURL;
URL.createObjectURL = (blob) => {
  reportBlob = blob;
  return "blob:node-test-report";
};
click('[data-action="download-report"]');
URL.createObjectURL = originalObjectURL;
const report = JSON.parse(await reportBlob.text());
assert.equal(report.note, "The path was hard to find.");
assert.deepEqual(
  currentWorld(parseHistory(JSON.stringify(report.history))),
  currentWorld(saved()),
);
assert.equal(report.view.day, inspectionDay);
cases.push(
  "Problem report downloads a reproducible saved world and the player's note",
);
dialog.close();
const before = JSON.stringify(currentWorld(saved()));
click("#play");
assert.equal($("#run-state").textContent, "Unfolding");
document.hidden = true;
document.dispatchEvent(new window.Event("visibilitychange"));
assert.equal($("#run-state").textContent, "Paused");
assert.equal(JSON.stringify(currentWorld(saved())), before);
cases.push("Background handler pauses and preserves exact world state");
click("#branches");
click('[data-branch="b1"]');
// Exercise every real button press. Replaying every growing command log three
// times per day only measures the test harness; cold-replay the final save once.
for (let steps = 0; displayedDay() < 300 && steps < 300; steps++) {
  const priorDay = displayedDay();
  click("#step");
  assert.equal(displayedDay(), priorDay + 1, `Advancement failed: ${$("#toast").textContent}; ${$("#save-state").textContent}`);
}
const grown = currentWorld(saved());
assert.equal(grown.tick, 300, "The saved archive must replay to the displayed final day.");
const founding = grown.events.find(event => event.kind === "settlement-founded");
assert.ok(founding, "Observation creates a real new place in this reference world.");
const place = grown.settlements.find(item => item.eventId === founding.id);
click('[data-tab="followed"]');
click(`[data-entity="${place.id}"]`);
assert.match($("#inspector").textContent, new RegExp(place.name));
click(`[data-entity="${place.structures[0].id}"]`);
assert.match($("#inspector").textContent, new RegExp(`Built on day ${founding.tick}`));
click(`[data-event="${founding.id}"]`);
assert.match($("#inspector").textContent, /Recorded decision/);
const foundingPast = $("#timeline-slider");
foundingPast.value = String(founding.tick - 1);
foundingPast.dispatchEvent(new window.Event("input", { bubbles: true }));
assert.equal($("#step").disabled, true);
assert.equal(displayedDay(), founding.tick - 1);
assert.equal($("#inspector").hidden, true);
// A closed inspector retains its prior markup. Verify the visible historical
// journal, and compare booleans so a failure cannot format LinkeDOM's whole tree.
assert.equal(Boolean(document.querySelector(`#journal [data-entity="${place.id}"]`)), false);
cases.push("Observation grows a selectable settlement and buildings; its real decision is inspectable and rewinding hides the future place");
// The alternative view receives the same projection contract. These checks
// exercise failure and navigation safety; they do not simulate a WebGL GPU.
const { NeighborhoodUI } = await import("../src/neighborhood-ui.js");
const testContainer = document.createElement("section");
document.body.append(testContainer);
let receivedAssets, cameraResets = 0, failedCanvas;
class ComparisonView {
  constructor(canvas, options) { receivedAssets = options.assets; }
  setState() {}
  setVisible() {}
  resetCamera() { cameraResets++; }
  destroy() {}
}
const sampleAssets = Object.freeze({ schemaVersion: 1 });
const comparison = new NeighborhoodUI(testContainer, {}, {
  ViewClass: ComparisonView, viewOptions: { assets: sampleAssets }, comparisonEnabled: true, rendererName: "3D test",
});
comparison.show();
assert.equal(receivedAssets, sampleAssets);
assert.equal(testContainer.dataset.renderer, "three");
testContainer.querySelector('[data-nh-action="reset-view"]').click();
assert.equal(cameraResets, 1);
comparison.update({ saveOk: false });
const switchEvent = new window.Event("click", { bubbles: true, cancelable: true });
testContainer.querySelector('[data-nh-renderer="canvas"]').dispatchEvent(switchEvent);
assert.equal(switchEvent.defaultPrevented, true);
assert.match(testContainer.querySelector(".nh-status").textContent, /Save or export/);
comparison.destroy();
cases.push("Renderer comparison injects scene assets, resets the camera, and blocks navigation while changes are unsaved");
class UnavailableView {
  constructor(canvas) { failedCanvas = canvas; throw new Error("WebGL unavailable in this test"); }
}
const fallback = new NeighborhoodUI(testContainer, {}, { ViewClass: UnavailableView, comparisonEnabled: true });
fallback.show();
assert.notEqual(fallback.canvas, failedCanvas);
assert.equal(testContainer.dataset.renderer, "canvas");
assert.match(testContainer.querySelector(".nh-test-fallback").textContent, /illustrated courtyard is ready/);
fallback.destroy();
cases.push("Unavailable 3D rendering creates a fresh Canvas2D element and explains the playable fallback");
let lateFailure, disposed = 0;
class LateFailureView extends ComparisonView {
  constructor(canvas, options) { super(canvas, options); lateFailure = options.onError; }
  destroy() { disposed++; throw new Error("Disposing a lost context also failed"); }
}
const recovering = new NeighborhoodUI(testContainer, {}, { ViewClass: LateFailureView, comparisonEnabled: true });
recovering.update({ neighborhood: saved().neighborhood, saveOk: false, reducedMotion: true });
recovering.show("companion");
const failedFrameCanvas = recovering.canvas, choicesBeforeFailure = JSON.stringify(recovering.state.neighborhood);
lateFailure(new Error("The first frame could not draw"));
assert.notEqual(recovering.canvas, failedFrameCanvas);
assert.equal(testContainer.dataset.renderer, "canvas");
assert.equal(recovering.mode, "companion");
assert.equal(recovering.view.visible, true);
assert.equal(JSON.stringify(recovering.view.state.neighborhood), choicesBeforeFailure);
assert.equal(recovering.saveWarning.hidden, false);
assert.equal(recovering.getDiagnostics().error, "The first frame could not draw");
assert.equal(testContainer.querySelector('[data-nh-action="reset-view"]'), null);
assert.match(testContainer.querySelector(".nh-test-fallback").textContent, /Your choices are kept/);
const replacementCanvas = recovering.canvas;
lateFailure(new Error("A stale second notification"));
assert.equal(recovering.canvas, replacementCanvas); assert.equal(disposed, 1);
recovering.destroy(); testContainer.remove();
cases.push("First-frame or later GPU failure replaces the canvas once and preserves current activity, choices and unsaved-state warning");
await mkdir("evidence", { recursive: true });
await writeFile(
  "evidence/ui-integration.json",
  JSON.stringify(
    {
      kind: "Node DOM + Canvas integration; not browser execution, layout, performance, touch or human playtesting.",
      simulationVersion: grown.version,
      passed: cases.length,
      cases,
    },
    null,
    2,
  ) + "\n",
);
console.log(cases.map((item) => "PASS " + item).join("\n"));
process.exit(0);
