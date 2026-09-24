import {
  createHistory,
  currentWorld,
  applyCommand,
  worldAt,
  forkHistory,
  selectBranch,
  serializeHistory,
  parseHistory,
  saveHistory,
  loadHistory,
} from "./persistence/history.js";
import { getInterventions, entityLabel } from "./sim/world.js";
import {
  shouldStop,
  selectAttentionEvent,
  makeDigest,
  relatedEvents,
} from "./director.js";
import { WorldView } from "./view/world-view.js";
import { Soundscape } from "./audio.js";
const DEFAULT_TIER = 2;
const $ = (id) => document.getElementById(id);
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const esc = escape;
let storage;
try {
  storage = window.localStorage;
} catch {
  storage = null;
}
let loaded = storage
  ? loadHistory(storage)
  : {
      history: null,
      error: "Browser storage is unavailable. Export before closing.",
    };
let history = loaded.history || openingWorld();
let recoveryProtected = Boolean(loaded.error && !loaded.history);
let viewTick = null,
  selectedId = null,
  tabName = "threads",
  playing = false,
  timer = null,
  fastTarget = null,
  speed = 1,
  toastTimer,
  scale = "region";
let inspectedEvent = null;
let horizon = 14;
const sound = new Soundscape();
let sessionStart = currentWorld(history).tick;
let entryDigest = makeDigest(
  currentWorld(history),
  history.followed,
  history.session?.lastSeenTick ?? 0,
);
const renderer = new WorldView($("world"), {
  onSelect: (id) => inspectEntity(id),
  onScaleChange: (value) => {
    scale = value;
    renderScale();
  },
});
renderer.setReducedMotion(
  window.matchMedia("(prefers-reduced-motion: reduce)").matches,
);
function openingWorld(config = {}) {
  let h = createHistory({ seed: 8417, tier: DEFAULT_TIER, ...config });
  return applyCommand(h, { type: "advance", days: 2 });
}
function world() {
  return viewTick === null ? currentWorld(history) : worldAt(history, viewTick);
}
function branch() {
  return history.branches.find((b) => b.id === history.activeBranchId);
}
function label(id, w = world()) {
  return entityLabel(w, id) || id;
}
function entity(id, w = world()) {
  return [
    ...w.settlements,
    ...w.characters,
    ...w.routes,
    ...w.cultures,
    ...w.institutions,
    ...w.regions,
    ...w.settlements.flatMap((s) => s.structures),
    ...(w.power ? [w.power] : []),
  ].find((e) => e.id === id);
}
function settlementOf(id, w = world()) {
  const s = w.settlements.find(
    (s) => s.id === id || s.structures.some((b) => b.id === id),
  );
  if (s) return s;
  const e = entity(id, w);
  return w.settlements.find((s) => s.id === e?.settlementId);
}
function toast(text) {
  $("toast").textContent = text;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 7000);
}
function resetSession() {
  const w = currentWorld(history);
  entryDigest = makeDigest(
    w,
    history.followed,
    Math.min(w.tick, history.session?.lastSeenTick ?? 0),
  );
  sessionStart = w.tick;
}
function persist() {
  if (recoveryProtected) {
    $("save-state").textContent = "Recovery needed · unsaved";
    $("save-state").classList.add("save-error");
    return {
      ok: false,
      error:
        "Unreadable saved data has been preserved. Export this session, or explicitly create/import a world to replace it.",
    };
  }
  history = {
    ...history,
    session: {
      ...history.session,
      lastSeenTick: Math.min(sessionStart, currentWorld(history).tick),
    },
  };
  const result = storage
    ? saveHistory(storage, history)
    : { ok: false, error: "Browser storage unavailable" };
  $("save-state").textContent = result.ok
    ? "All changes saved"
    : "Save failed · export now";
  $("save-state").classList.toggle("save-error", !result.ok);
  if (!result.ok)
    toast(
      `${result.error}. Your last valid save is preserved; export this history now.`,
    );
  return result;
}
function render() {
  const w = world();
  renderer.setWorld(w);
  document.querySelectorAll(".tier2").forEach((e) => (e.hidden = w.tier < 2));
  $("clock").textContent = `Day ${w.tick}`;
  $("run-state").textContent =
    viewTick === null ? (playing ? "Unfolding" : "Paused") : "In history";
  $("play").textContent = playing ? "Ⅱ" : "▶";
  $("play").setAttribute("aria-label", playing ? "Pause time" : "Play time");
  for (const id of ["play", "step", "fast-forward"])
    $(id).disabled = viewTick !== null;
  $("timeline-slider").max = currentWorld(history).tick;
  $("timeline-slider").value = w.tick;
  $("timeline-range").textContent = `Day 0 — ${currentWorld(history).tick}`;
  $("branch-name").textContent = branch().name;
  $("historic-banner").hidden = viewTick === null;
  $("historic-label").textContent = `Day ${viewTick} · read-only history`;
  $("world-subtitle").textContent =
    viewTick === null
      ? "Nothing is forgotten. Nothing moves without you."
      : "A place as it was. Its future remains intact.";
  renderJournal();
  renderMarkers();
  renderScale();
  if (inspectedEvent) showEvent(inspectedEvent, false);
  else if (selectedId) inspectEntity(selectedId, false);
}
function renderScale() {
  document
    .querySelectorAll("[data-scale]")
    .forEach((b) => b.classList.toggle("active", b.dataset.scale === scale));
}
function renderMarkers() {
  const head = currentWorld(history);
  const significant = head.events.filter(
    (e) =>
      e.severity >= 2 || shouldStop(e, history.followed, history.attention),
  );
  $("timeline-markers").innerHTML = significant
    .slice(-32)
    .map(
      (e) =>
        `<button data-timeline-event="${esc(e.id)}" style="left:${head.tick ? (100 * e.tick) / head.tick : 0}%" title="Day ${e.tick}: ${esc(e.title)}" aria-label="Day ${e.tick}: ${esc(e.title)}"></button>`,
    )
    .join("");
}
function renderJournal() {
  const w = world();
  $("follow-strip").innerHTML = history.followed
    .slice(0, 8)
    .map(
      (id) =>
        `<button class="follow-chip" data-entity="${esc(id)}">${esc(label(id, w).split(" ")[0])}</button>`,
    )
    .join("");
  const threads = w.threads.filter((t) => t.status === "open");
  $("thread-count").textContent = threads.length;
  document
    .querySelectorAll("[data-tab]")
    .forEach((b) => b.classList.toggle("active", b.dataset.tab === tabName));
  let html = "";
  if (tabName === "threads") {
    const digest =
      viewTick === null ? entryDigest : makeDigest(w, history.followed, 0);
    html = `<div class="digest-note"><strong>${esc(digest.title || "WHEN YOU LAST LOOKED")}</strong>${esc(digest.summary || "A world already in motion. Choose a thread, or simply visit.")}</div>`;
    html += (digest.events || [])
      .filter(
        (e) =>
          e.tick <= w.tick && w.events.some((record) => record.id === e.id),
      )
      .slice(0, 3)
      .map(eventButton)
      .join("");
    html += threads
      .map(
        (t, i) =>
          `<article class="thread-card"><div class="thread-number">THREAD ${String(i + 1).padStart(2, "0")} · UNRESOLVED</div><h3>${esc(t.title)}</h3><p>${esc(t.summary)}</p><button class="text-button" data-thread="${esc(t.id)}">Follow this thread <span aria-hidden="true">↗</span></button></article>`,
      )
      .join("");
    if (!threads.length)
      html +=
        '<article class="thread-card"><h3>A little room to breathe.</h3><p>No unresolved threads need your attention. Visit someone, explore old foundations, or let a few days unfold.</p></article>';
  }
  if (tabName === "followed") {
    html =
      '<div class="section-label">The lives you keep close</div>' +
      history.followed.map((id) => entityRow(id, w)).join("");
    html +=
      '<div class="section-label">Places & people to discover</div>' +
      [
        ...w.settlements,
        ...w.characters.filter((c) => c.alive),
        ...w.cultures,
        ...w.institutions,
        ...(w.power ? [w.power] : []),
      ]
        .filter((e) => !history.followed.includes(e.id))
        .map((e) => entityRow(e.id, w))
        .join("");
  }
  if (tabName === "chronicle") {
    html =
      '<div class="digest-note">Every account has a record. Select a moment to ask why, or use the timeline to visit its day.</div>' +
      [...w.events]
        .reverse()
        .slice(0, 60)
        .map((e) => eventButton(e))
        .join("");
  }
  $("journal-content").innerHTML = html;
}
function entityRow(id, w) {
  const e = entity(id, w);
  return `<div class="entity-row"><span class="entity-symbol">${esc((e?.name || "?").slice(0, 1))}</span><button data-entity="${esc(id)}"><strong>${esc(label(id, w))}</strong><small>${esc(e?.role || e?.practice || e?.activity || (e?.population !== undefined ? "Settlement" : "Recorded presence"))}</small></button></div>`;
}
function eventButton(e) {
  return `<button class="event-link" data-event="${esc(e.id)}"><small>DAY ${e.tick} · ${esc(e.category.toUpperCase())}</small>${esc(e.title)} <span class="badged">↗</span></button>`;
}
function openInspector(html) {
  const scroll = $("inspector").scrollTop;
  $("inspector").innerHTML =
    `<button class="inspect-close icon-button" data-action="close-inspector" aria-label="Close inspection">×</button>${html}`;
  $("inspector").hidden = false;
  $("inspector").scrollTop = scroll;
}
function inspectEntity(id, move = true) {
  const w = world(),
    e = entity(id, w);
  if (!e) return;
  selectedId = id;
  inspectedEvent = null;
  renderer.select(id);
  const s = settlementOf(id, w);
  if (move) {
    pause();
    $("inspector").scrollTop = 0;
    renderer.focus(
      id,
      w.characters.some((c) => c.id === id) || e.kind
        ? "neighborhood"
        : "settlement",
    );
    $("journal").classList.remove("mobile-open");
    $("location-note").textContent = s
      ? `${s.name} · ${e.name || "a remembered place"}`
      : "Explore the basin";
  }
  const isPerson = w.characters.some((c) => c.id === id),
    isSettlement = w.settlements.some((s) => s.id === id),
    isStructure = !!e.kind;
  let html = `<div class="eyebrow">${isPerson ? (e.alive ? "A LIFE IN THE BASIN" : "A REMEMBERED LIFE") : isSettlement ? "A PLACE THAT REMEMBERS" : isStructure ? "A PHYSICAL TRACE" : "A THREAD OF HISTORY"}</div><h2>${esc(e.name || label(id, w))}</h2>`;
  if (isPerson)
    html += `<span class="muted-badge">${esc(e.role)}${e.alive ? "" : ` · remembered since day ${e.diedAt}`}</span><p>${esc(e.description)}</p><div class="scene">${esc(e.activity)}</div><p><span class="muted">Commitment:</span> ${esc(e.commitment)}</p>`;
  else if (isSettlement)
    html += `<p>${esc(w.regions.find((r) => r.id === e.regionId)?.name)} · ${e.population} Emberkin${w.tier > 1 ? ` · ${e.synthetics} Vessels · ${e.collective} Chorus nodes` : ""}</p><div class="resource-grid">${[
      ["Habitat", e.habitat],
      ["Sustenance", e.food],
      ["Energy", e.energy],
      ["Materials", e.materials],
    ]
      .map(
        ([name, value]) =>
          `<div class="resource">${name}<span>${Math.round(value)}</span><div class="meter"><i style="width:${Math.max(0, Math.min(100, value))}%"></i></div></div>`,
      )
      .join(
        "",
      )}</div><p>${esc(w.cultures.find((c) => c.id === e.cultureId)?.practice || "A community still finding its own way.")}</p>`;
  else if (isStructure)
    html += `<span class="muted-badge">${esc(e.kind)} · ${e.abandonedAt !== undefined ? "ABANDONED" : "IN USE"}</span><p>${e.builtAt === 0 ? "First recorded on day" : "Built on day"} ${e.builtAt}${e.abandonedAt !== undefined ? `; abandoned on day ${e.abandonedAt}` : ""}. This place belongs to ${esc(s?.name)}. Its foundations preserve a recorded part of this history.</p><p>${esc(e.description || "")}</p>${e.lore ? `<div class="section-label">Lore · not recorded history</div><div class="interpretation">${esc(e.lore.replace(/^Lore: /, ""))}</div>` : ""}`;
  else
    html += `<p>${esc(e.practice || e.description || e.terrain || "An independent presence woven into the basin.")}</p>${e.status ? `<p>Status: ${esc(e.status)}</p>` : ""}`;
  html += `<div class="inspect-actions"><button data-follow="${esc(id)}">${history.followed.includes(id) ? "✓ Following" : "+ Follow"}</button><button class="primary" data-visit="${esc(id)}">${isPerson ? (e.alive ? "Walk with them" : "Visit their place") : "Explore streets"} ↗</button>${s && viewTick === null ? `<button data-possibilities="${esc(s.id)}">Possibilities</button>` : ""}</div>`;
  if (isSettlement && w.tier > 1) {
    html += '<div class="section-label">Different ways to live here</div>';
    if (e.population)
      html +=
        '<p class="tiny">Emberkin need food, livable ground, and room for growing households.</p>';
    if (e.synthetics)
      html += `<p class="tiny">Vessels use energy and ceramic repair material. Shell integrity: ${Math.round(e.syntheticIntegrity ?? 0)}%. Wet weather wears their bodies.</p>`;
    if (e.collective)
      html += `<p class="tiny">Chorus nodes live through wet connections and nutrients. Hydration: ${Math.round(e.collectiveHydration ?? e.habitat)}%. New rooms occupy more ground.</p>`;
  }
  if (w.cultures.some((c) => c.id === id) && e.interpretation)
    html += `<div class="section-label">Cultural interpretation</div><div class="interpretation">${esc(e.interpretation)}</div>`;
  if (w.institutions.some((i) => i.id === id))
    html +=
      '<div class="section-label">Participants</div>' +
      e.members
        .map(
          (member) =>
            `<button class="text-button" data-entity="${esc(member)}">${esc(label(member, w))} ↗</button><br>`,
        )
        .join("");
  if (viewTick !== null)
    html +=
      '<div class="read-only-note">You are visiting an earlier day. Branch here to change what happens next.</div>';
  if (isPerson) {
    html +=
      '<div class="section-label">Relationships</div>' +
      e.relationships
        .map(
          (r) =>
            `<button class="event-link" data-entity="${esc(r.otherId)}">${esc(label(r.otherId, w))}<small>${esc(r.label)}</small></button>`,
        )
        .join("");
  }
  if (isSettlement) {
    const occupants = w.characters.filter(
      (c) => c.settlementId === id && c.alive,
    );
    html +=
      '<div class="section-label">People you may meet</div>' +
      occupants.map((c) => entityRow(c.id, w)).join("");
    html +=
      '<div class="section-label">Traces & architecture</div>' +
      e.structures
        .map(
          (b) =>
            `<button class="event-link" data-entity="${esc(b.id)}">${esc(b.name)}<small>${esc(b.kind)} · Day ${b.builtAt}${b.abandonedAt !== undefined ? " · abandoned" : ""}</small></button>`,
        )
        .join("");
    html +=
      '<div class="section-label">Connections</div>' +
      w.routes
        .filter((r) => r.from === id || r.to === id)
        .map(
          (r) =>
            `<div class="route-row">${esc(label(r.from === id ? r.to : r.from, w))} · ${r.open ? "open passage" : "closed passage"}</div>`,
        )
        .join("");
  }
  if (isStructure && e.eventId) {
    const event = w.events.find((x) => x.id === e.eventId);
    if (event)
      html +=
        '<div class="section-label">Why this place exists</div>' +
        eventButton(event);
  }
  if (w.power?.id === id) {
    html += `<div class="section-label">Observed presence</div><p>First recorded on day ${e.emergedAt}. ${e.active ? "Active" : "Quiet"} · strength ${Math.round(e.strength)}.</p>`;
    for (const it of e.interpretations)
      html += `<div class="section-label">Cultural interpretation · ${esc(label(it.cultureId, w))}</div><div class="interpretation">${esc(it.text)}</div>`;
  }
  const events = relatedEvents(w, id)
    .slice()
    .sort((a, b) => b.tick - a.tick)
    .slice(0, 5);
  if (events.length)
    html +=
      '<div class="section-label">Recorded history · ask why</div>' +
      events.map(eventButton).join("");
  if (s && viewTick === null) {
    const options = getInterventions(w).filter(
      (i) =>
        i.targetId === s.id ||
        s.structures.some((b) => b.id === i.targetId) ||
        w.routes.some(
          (r) => r.id === i.targetId && (r.from === s.id || r.to === s.id),
        ),
    );
    if (options.length)
      html +=
        '<div class="section-label">Change what is possible</div>' +
        options
          .map(
            (i) =>
              `<div class="intervention"><h3>${esc(i.title)}</h3><p>${esc(i.description)}</p><div class="reason">${esc(i.reason)}</div><button data-intervention="${esc(i.id)}" ${i.available ? "" : "disabled"}>${i.available ? "Make possible" : "Conditions not met"}</button></div>`,
          )
          .join("");
  }
  openInspector(html);
}
function showEvent(id, move = true) {
  const w = world(),
    e = w.events.find((e) => e.id === id);
  if (!e) return;
  inspectedEvent = id;
  selectedId = null;
  if (move) {
    pause();
    $("inspector").scrollTop = 0;
    if (e.settlementId) renderer.focus(e.settlementId, "settlement");
  }
  let html = `<div class="eyebrow">DAY ${e.tick} · ${esc(e.category)}</div><h2>${esc(e.title)}</h2><div class="scene">${esc(e.text)}</div><div class="section-label">Observed effects</div><ul class="explanation-list">${e.observed.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`;
  if (e.decision) {
    const d = e.decision;
    html +=
      `<div class="section-label">Recorded decision · ${esc(label(d.actorId, w))}</div><p>What they knew at the time:</p><ul class="explanation-list">${d.known.map((k) => `<li>${esc(k)}</li>`).join("")}</ul><p>${d.motives.map(esc).join(" · ")}</p><div class="section-label">Their alternatives</div>` +
      d.alternatives
        .map(
          (a) =>
            `<div class="choice ${a.id === d.chosen ? "chosen" : ""}"><strong>${a.id === d.chosen ? "✓ Chosen · " : a.available ? "Available · " : "Unavailable · "}${esc(a.label)}</strong>${esc(a.reason)}</div>`,
        )
        .join("");
  }
  html += '<div class="section-label">Cultural interpretations</div>';
  html += e.interpretations.length
    ? e.interpretations
        .map(
          (i) =>
            `<div class="interpretation"><small>${esc(label(i.cultureId, w))} believes:</small><br>${esc(i.text)}</div>`,
        )
        .join("")
    : '<p class="tiny muted">No cultural interpretation was recorded for this event. Observation does not establish a divine intention.</p>';
  if (e.causes.length)
    html +=
      '<div class="section-label">Underlying records</div>' +
      e.causes
        .map((c) => w.events.find((x) => x.id === c))
        .filter(Boolean)
        .map(eventButton)
        .join("");
  html +=
    `<div class="inspect-actions"><button data-visit-day="${e.tick}">Visit day ${e.tick}</button><button data-visit="${esc(e.settlementId)}">Visit this place ↗</button></div><div class="section-label">People & places involved</div>` +
    e.entities
      .filter((id) => entity(id, w))
      .slice(0, 6)
      .map(
        (id) =>
          `<button class="text-button" data-entity="${esc(id)}">${esc(label(id, w))} ↗</button><br>`,
      )
      .join("");
  openInspector(html);
}
function intro() {
  openInspector(
    `<div class="eyebrow">YOUR FIRST VISIT</div><h2>Every place<br>remembers.</h2><p>The basin has been living before you arrived. Its people will choose their own way. You can follow them, listen, and sometimes open a possibility.</p><div class="scene">Nera keeps the seed archive. Its cooling seam is failing. Across the closed eastern passage, someone may know how to mend it.</div><p>Visit Hearth. Meet Nera. You have time to look around.</p><div class="inspect-actions"><button class="primary" data-entity="c-nera">Meet Nera ↗</button></div><button class="text-button" data-action="dismiss-intro">Or simply explore the basin →</button><div class="rule"></div><p class="tiny">Time is paused. Explore freely. Use <b>Next moment</b> when you are ready to see what happens.</p>`,
  );
}
function pause() {
  playing = false;
  fastTarget = null;
  clearTimeout(timer);
  timer = null;
  $("play").textContent = "▶";
  $("play").setAttribute("aria-label", "Play time");
  $("run-state").textContent = "Paused";
}
function step(auto = false) {
  if (viewTick !== null) return false;
  const before = currentWorld(history);
  try {
    history = applyCommand(history, { type: "advance", days: 1 });
  } catch (error) {
    pause();
    toast(error.message);
    return false;
  }
  const w = currentWorld(history),
    newEvents = w.events.slice(before.events.length);
  const stop = selectAttentionEvent(
    newEvents,
    history.followed,
    history.attention,
  );
  persist();
  render();
  if (auto && stop) {
    pause();
    showEvent(stop.id);
    toast(
      `${label(stop.entities.find((id) => history.followed.includes(id)) || stop.settlementId, w)} has a moment worth your attention.`,
    );
    sound.chime(stop.severity);
    return false;
  }
  return true;
}
function schedule() {
  clearTimeout(timer);
  if (!playing) return;
  timer = setTimeout(
    () => {
      if (document.hidden) {
        pause();
        return;
      }
      if (!step(true)) return;
      if (fastTarget !== null && currentWorld(history).tick >= fastTarget) {
        pause();
        toast("A quiet interval. Your chosen horizon has been reached.");
        return;
      }
      schedule();
    },
    fastTarget !== null ? 90 : 1400 / speed,
  );
}
function start(fast = false) {
  if (viewTick !== null) return;
  if (playing) {
    pause();
    return;
  }
  playing = true;
  fastTarget = fast ? currentWorld(history).tick + horizon : null;
  $("play").textContent = "Ⅱ";
  $("play").setAttribute("aria-label", "Pause time");
  $("run-state").textContent = "Unfolding";
  schedule();
}
function timeTravel(tick) {
  pause();
  viewTick = Math.max(0, Math.min(currentWorld(history).tick, Number(tick)));
  selectedId = null;
  inspectedEvent = null;
  $("inspector").hidden = true;
  render();
  toast(`Visiting day ${viewTick}. This history is read-only.`);
}
function modal(html) {
  pause();
  $("modal-content").innerHTML = html;
  if (!$("modal").open) $("modal").showModal();
}
function showHelp() {
  modal(
    `<div class="eyebrow">AN OBSERVER'S GUIDE</div><h2>Follow a life. Find a history.</h2><p>You are outside this world's pantheon. Inhabitants choose their own answers. Your interventions change the alternatives they can consider.</p><div class="guide-grid"><div><b>01 · Explore</b><p>Select Hearth, then Explore streets. Drag to move, pinch or use + / − to zoom. Select a person to walk with their actual activity.</p></div><div><b>02 · Follow</b><p>Keep a few people or places close. Their important events stop time. Your field journal is always one tap away.</p></div><div><b>03 · Ask why</b><p>History opens recorded effects, decision-time knowledge, alternatives, and separately labeled interpretations.</p></div><div><b>04 · Ask what if</b><p>Open a viable passage or restore habitat. Visit an earlier day on the timeline, then branch to preserve both futures.</p></div></div><p><b>Try this:</b> meet Nera, inspect Hearth's archive, and look for the eastern passage. Advance to her decision. Revisit day 2 and try the other possibility.</p><p class="tiny">Space: pause/play · Escape: close inspection · arrows: move camera · + / −: zoom · 0: overview. Time pauses whenever the app is hidden. No time passes while away.</p><div class="modal-actions"><button class="primary" data-action="close-modal">Enter the basin</button></div>`,
  );
}
function showSettings() {
  modal(
    `<div class="eyebrow">THE OBSERVATORY</div><h2>Your world, safely kept.</h2><label class="field">What deserves a pause?<select id="attention"><option value="quiet" ${history.attention === "quiet" ? "selected" : ""}>Only turning points</option><option value="balanced" ${history.attention === "balanced" ? "selected" : ""}>Meaningful changes</option><option value="attentive" ${history.attention === "attentive" ? "selected" : ""}>Small moments too</option></select></label><label class="field">Next moment horizon<select id="horizon"><option value="7" ${horizon === 7 ? "selected" : ""}>Up to 7 days</option><option value="14" ${horizon === 14 ? "selected" : ""}>Up to 14 days</option><option value="30" ${horizon === 30 ? "selected" : ""}>Up to 30 days</option></select></label><label class="field">Rendering detail<select id="quality"><option value="auto">Automatic</option><option value="low">Gentle on battery</option><option value="high">Full detail</option></select></label><label class="field">Reduce motion<input id="reduced-motion" type="checkbox" ${matchMedia("(prefers-reduced-motion: reduce)").matches ? "checked" : ""}></label><label class="field">Sound volume<input id="volume" type="range" min="0" max="60" value="${sound.volume * 100}"></label><div class="rule"></div><p>Portable saves include every retained branch, character, decision, and consequence. Import validates the entire history before replacing this world.</p><div class="modal-actions"><button data-action="export">Export history ↓</button><button data-action="import">Import history ↑</button><button data-action="branches">View branches</button></div><p class="tiny">Simulation version ${esc(world().version)} · bounded local history. Export before reaching the retention limit. Browser storage can be cleared by the browser; keep a portable copy.</p><div class="rule"></div><button class="text-button" data-action="new-world">Shape another beginning →</button>`,
  );
}
function showBranches() {
  modal(
    `<div class="eyebrow">ASK WHAT IF</div><h2>Histories that could be.</h2><p>Each branch preserves its source future. Visit a day on the timeline, then continue from there.</p>${history.branches.map((b) => `<div class="branch-row"><div><h3>${esc(b.name)}</h3><small>Day ${b.head.tick} · ${b.parentId ? `branched on day ${b.forkTick}` : "original history"}</small></div><button data-branch="${esc(b.id)}" ${b.id === history.activeBranchId ? "disabled" : ""}>${b.id === history.activeBranchId ? "Here now" : "Visit"}</button></div>`).join("")}<div class="modal-actions"><button class="primary" data-action="branch-present">Branch from ${viewTick === null ? "now" : `day ${viewTick}`}</button><button data-action="export">Export all branches ↓</button></div>`,
  );
}
function branchNow() {
  pause();
  const tick = viewTick ?? currentWorld(history).tick;
  try {
    history = forkHistory(
      history,
      tick,
      `Telling ${history.branches.length + 1} · day ${tick}`,
    );
    resetSession();
    viewTick = null;
    selectedId = null;
    inspectedEvent = null;
    $("inspector").hidden = true;
    $("modal").close();
    persist();
    render();
    toast(
      `A new telling begins on day ${tick}. The original future is preserved.`,
    );
  } catch (e) {
    toast(e.message);
  }
}
function exportSave() {
  const blob = new Blob([serializeHistory(history)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `worldweaver-day-${currentWorld(history).tick}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("History exported. Keep this file to carry your world elsewhere.");
}
function newWorldForm() {
  modal(
    `<div class="eyebrow">A ONE-TIME ACT OF CREATION</div><h2>Set the beginning.<br>Let them choose the rest.</h2><p>First export your current world. Creating a beginning replaces this browser's active save; exported histories remain yours.</p><label class="field">Environment<select id="climate"><option value="temperate">Temperate · shared possibilities</option><option value="dry">Dry · energy-rich, thirsty</option><option value="wet">Wet · lush, hard on machinery</option></select></label><label class="field">Founding populations<select id="density"><option value="balanced">Balanced</option><option value="sparse">Sparse · room to recover</option><option value="dense">Dense · more hands, more needs</option></select></label><label class="field">Inherited disposition<select id="temperament"><option value="careful">Careful · protect commitments</option><option value="curious">Curious · seek unfamiliar answers</option><option value="communal">Communal · value mutual aid</option></select></label><label class="field">World seed<input id="seed" type="number" min="0" max="4294967295" value="8417"></label><div class="modal-actions"><button data-action="export">Export current history</button><button class="primary" data-action="create-world">Create this beginning</button></div>`,
  );
}
document.addEventListener("click", (event) => {
  const b = event.target.closest("button");
  if (!b) return;
  const d = b.dataset;
  if (d.tab) {
    tabName = d.tab;
    renderJournal();
  }
  if (d.entity) inspectEntity(d.entity);
  if (d.visit) {
    selectedId = null;
    inspectedEvent = null;
    renderer.focus(d.visit, "neighborhood");
    scale = "neighborhood";
    renderScale();
    $("inspector").hidden = true;
    $("journal").classList.remove("mobile-open");
    const s = settlementOf(d.visit);
    $("location-note").textContent =
      `${s?.name || label(d.visit)} · select a person or a surviving trace`;
  }
  if (d.possibilities) {
    const w = world(),
      place = w.settlements.find((s) => s.id === d.possibilities);
    if (place && viewTick === null) {
      const options = getInterventions(w).filter(
        (i) =>
          i.targetId === place.id ||
          place.structures.some((b) => b.id === i.targetId) ||
          w.routes.some(
            (r) =>
              r.id === i.targetId && (r.from === place.id || r.to === place.id),
          ),
      );
      modal(
        `<div class="eyebrow">CHANGE WHAT IS POSSIBLE</div><h2>${esc(place.name)}</h2><p>Open a possibility. The inhabitants will choose what to do with it.</p>${options.map((i) => `<div class="intervention"><h3>${esc(i.title)}</h3><p>${esc(i.description)}</p><div class="reason">${esc(i.reason)}</div><button data-intervention="${esc(i.id)}" ${i.available ? "" : "disabled"}>${i.available ? "Make possible" : "Conditions not met"}</button></div>`).join("")}`,
      );
    }
  }
  if (d.follow) {
    const exists = history.followed.includes(d.follow);
    if (!exists && history.followed.length >= 12) {
      toast(
        "Keep up to twelve threads close. Unfollow one before adding another.",
      );
      return;
    }
    history = {
      ...history,
      followed: exists
        ? history.followed.filter((id) => id !== d.follow)
        : [...history.followed, d.follow],
    };
    persist();
    renderJournal();
    inspectEntity(d.follow, false);
  }
  if (d.event) showEvent(d.event);
  if (d.thread) {
    const t = world().threads.find((t) => t.id === d.thread);
    if (t) {
      const id =
        t.entityIds.find((id) => world().characters.some((c) => c.id === id)) ||
        t.entityIds[0];
      if (!history.followed.includes(id) && history.followed.length < 12)
        history = { ...history, followed: [...history.followed, id] };
      inspectEntity(id);
      persist();
      renderJournal();
    }
  }
  if (d.intervention && viewTick === null) {
    const i = getInterventions(world()).find((i) => i.id === d.intervention);
    if (i?.available) {
      $("modal").close();
      pause();
      try {
        history = applyCommand(history, {
          type: "intervene",
          intervention: { kind: i.kind, targetId: i.targetId },
        });
        persist();
        render();
        const e = world().events.at(-1);
        if (e) showEvent(e.id);
        sound.chime(2);
        toast(
          "The possibility is open. The inhabitants will decide what to do with it.",
        );
      } catch (e) {
        toast(e.message);
      }
    }
  }
  if (d.scale) {
    scale = d.scale;
    renderer.setScale(scale);
    renderScale();
  }
  if (d.visitDay !== undefined) timeTravel(Number(d.visitDay));
  if (d.timelineEvent) {
    const e = currentWorld(history).events.find(
      (e) => e.id === d.timelineEvent,
    );
    if (e) {
      timeTravel(e.tick);
      showEvent(e.id);
    }
  }
  if (d.branch) {
    history = selectBranch(history, d.branch);
    resetSession();
    viewTick = null;
    selectedId = null;
    inspectedEvent = null;
    $("inspector").hidden = true;
    $("modal").close();
    persist();
    render();
  }
  const action = d.action;
  if (action === "close-inspector" || action === "dismiss-intro") {
    $("inspector").hidden = true;
    selectedId = null;
    inspectedEvent = null;
  }
  if (action === "close-journal") $("journal").classList.remove("mobile-open");
  if (action === "close-modal") $("modal").close();
  if (action === "export") exportSave();
  if (action === "import") $("import-file").click();
  if (action === "branches") showBranches();
  if (action === "branch-present") branchNow();
  if (action === "new-world") newWorldForm();
  if (action === "create-world") {
    const seed = Number($("seed").value);
    if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) {
      toast("Choose an integer seed from 0 through 4294967295.");
      return;
    }
    const candidate = openingWorld({
      seed,
      climate: $("climate").value,
      density: $("density").value,
      temperament: $("temperament").value,
    });
    const old = history,
      oldProtection = recoveryProtected;
    recoveryProtected = false;
    history = candidate;
    resetSession();
    if (!persist().ok) {
      history = old;
      recoveryProtected = oldProtection;
      resetSession();
      return;
    }
    viewTick = null;
    selectedId = null;
    inspectedEvent = null;
    $("modal").close();
    render();
    renderer.overview();
    intro();
  }
});
$("play").onclick = () => start();
$("step").onclick = () => {
  pause();
  step();
};
$("fast-forward").onclick = () => start(true);
$("speed").onchange = (e) => {
  speed = Number(e.target.value);
  if (playing) schedule();
};
$("timeline-slider").oninput = (e) => timeTravel(Number(e.target.value));
$("return-present").onclick = () => {
  viewTick = null;
  selectedId = null;
  inspectedEvent = null;
  $("inspector").hidden = true;
  render();
};
$("branch-here").onclick = branchNow;
$("branches").onclick = showBranches;
$("help").onclick = showHelp;
$("settings").onclick = showSettings;
$("zoom-in").onclick = () => renderer.zoomBy(1.4);
$("zoom-out").onclick = () => renderer.zoomBy(1 / 1.4);
$("overview").onclick = () => {
  renderer.overview();
  scale = "region";
  renderScale();
};
$("mobile-journal").onclick = () => {
  $("journal").classList.toggle("mobile-open");
  $("inspector").hidden = true;
};
$("sound-toggle").onclick = async () => {
  try {
    const on = await sound.toggle();
    $("sound-toggle").textContent = on ? "♫" : "♪";
    $("sound-toggle").setAttribute(
      "aria-label",
      on ? "Mute sound" : "Enable sound",
    );
    toast(
      on ? "Sound on. Soft tones mark consequential moments." : "Sound muted.",
    );
  } catch {
    toast("Sound is not available in this browser.");
  }
};
$("modal-content").addEventListener("change", (e) => {
  if (e.target.id === "attention") {
    history = { ...history, attention: e.target.value };
    persist();
  }
  if (e.target.id === "horizon") {
    horizon = Number(e.target.value);
    $("fast-forward").title =
      `Advance up to ${horizon} days, stopping for followed events`;
  }
  if (e.target.id === "quality") renderer.setQuality(e.target.value);
  if (e.target.id === "reduced-motion")
    renderer.setReducedMotion(e.target.checked);
  if (e.target.id === "volume") sound.setVolume(Number(e.target.value) / 100);
});
$("import-file").onchange = async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  pause();
  try {
    if (file.size > 5 * 1024 * 1024)
      throw new Error("Save is larger than the 5 MB import limit");
    const candidate = parseHistory(await file.text());
    const result = storage
      ? saveHistory(storage, candidate)
      : { ok: false, error: "Storage unavailable" };
    if (!result.ok) throw new Error(result.error);
    history = candidate;
    recoveryProtected = false;
    resetSession();
    viewTick = null;
    selectedId = null;
    inspectedEvent = null;
    $("modal").close();
    $("inspector").hidden = true;
    render();
    renderer.overview();
    toast("History validated and restored. Time is paused.");
  } catch (err) {
    toast(
      `Import rejected: ${err.message}. The open session has not been replaced.`,
    );
  }
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    pause();
    persist();
  }
});
window.addEventListener("pagehide", () => {
  pause();
  persist();
});
document.addEventListener("keydown", (e) => {
  if (e.defaultPrevented) return;
  if (
    ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName) ||
    $("modal").open
  )
    return;
  if (e.code === "Space") {
    e.preventDefault();
    start();
  }
  if (e.key === "Escape") {
    $("inspector").hidden = true;
    $("journal").classList.remove("mobile-open");
    selectedId = null;
    inspectedEvent = null;
  }
  if (e.key === "0") renderer.overview();
  if (e.key === "+" || e.key === "=") renderer.zoomBy(1.3);
  if (e.key === "-") renderer.zoomBy(1 / 1.3);
  const directions = {
    ArrowLeft: [60, 0],
    ArrowRight: [-60, 0],
    ArrowUp: [0, 60],
    ArrowDown: [0, -60],
  };
  if (directions[e.key]) {
    e.preventDefault();
    renderer.pan(...directions[e.key]);
  }
});
render();
persist();
if (!loaded.history) intro();
else toast("Welcome back. Your world has waited, unchanged.");
if (loaded.error) toast(loaded.error);
if ("serviceWorker" in navigator)
  window.addEventListener("load", () =>
    navigator.serviceWorker
      .register(new URL("../sw.js", import.meta.url))
      .catch(() => {
        /* Development runs without a generated offline worker. */
      }),
  );
