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
import { getWorldStats, getPersonStats } from "./stats.js";
import {
  characterPortrait,
  personHook,
  friendlyIntervention,
} from "./presentation.js";
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
let buildInfo = { commit: "development", branch: "local" };
let lastNotice = "";
fetch(new URL("../build-info.json", import.meta.url))
  .then((response) => (response.ok ? response.json() : null))
  .then((info) => {
    if (info && typeof info.commit === "string") buildInfo = info;
  })
  .catch(() => {});
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
  lastNotice = text;
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
          `<article class="thread-card"><div class="thread-number">A STORY TO FOLLOW</div><h3>${esc(t.title)}</h3><p>${esc(t.summary)}</p><button class="text-button" data-thread="${esc(t.id)}">Take a look <span aria-hidden="true">↗</span></button></article>`,
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
  const person = w.characters.some((c) => c.id === id);
  return `<div class="entity-row">${person ? characterPortrait(e) : `<span class="entity-symbol">${esc((e?.name || "?").slice(0, 1))}</span>`}<button data-entity="${esc(id)}"><strong>${esc(label(id, w))}</strong><small>${esc(person ? personHook(e) : e?.practice || e?.activity || (e?.population !== undefined ? "A place to visit" : "Part of this world's story"))}</small></button></div>`;
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
  let html = isPerson
    ? `<div class="portrait-heading">${characterPortrait(e)}<div><div class="eyebrow">${e.alive ? "MEET A NEIGHBOR" : "A REMEMBERED LIFE"}</div><h2>${esc(e.name)}</h2><span class="muted-badge">${esc(e.role)}${e.alive ? "" : ` · remembered since day ${e.diedAt}`}</span></div></div>`
    : `<div class="eyebrow">${isSettlement ? "A PLACE THAT REMEMBERS" : isStructure ? "A PLACE WITH A STORY" : "PART OF THE STORY"}</div><h2>${esc(e.name || label(id, w))}</h2>`;
  if (isPerson) html += `<p class="character-hook">${esc(personHook(e))}</p>`;
  else if (isSettlement)
    html += `<p>${esc(w.regions.find((r) => r.id === e.regionId)?.name)} · ${e.population} Emberkin${w.tier > 1 ? ` · ${e.synthetics} Vessels · ${e.collective} Chorus nodes` : ""}</p><details class="story-details"><summary>How is this place doing?</summary><div class="resource-grid">${[
      ["Living ground", e.habitat],
      ["Food", e.food],
      ["Energy", e.energy],
      ["Materials", e.materials],
    ]
      .map(
        ([name, value]) =>
          `<div class="resource">${name}<span>${Math.round(value)}</span><div class="meter"><i style="width:${Math.max(0, Math.min(100, value))}%"></i></div></div>`,
      )
      .join(
        "",
      )}</div><p>${esc(w.cultures.find((c) => c.id === e.cultureId)?.practice || "A community still finding its own way.")}</p></details>`;
  else if (isStructure)
    html += `<span class="muted-badge">${esc(e.kind)} · ${e.abandonedAt !== undefined ? "ABANDONED" : "IN USE"}</span><p>${e.builtAt === 0 ? "First recorded on day" : "Built on day"} ${e.builtAt}${e.abandonedAt !== undefined ? `; abandoned on day ${e.abandonedAt}` : ""}. This place belongs to ${esc(s?.name)}. Its foundations preserve a recorded part of this history.</p><p>${esc(e.description || "")}</p>${e.lore ? `<div class="section-label">Lore · not recorded history</div><div class="interpretation">${esc(e.lore.replace(/^Lore: /, ""))}</div>` : ""}`;
  else
    html += `<p>${esc(e.practice || e.description || e.terrain || "An independent presence woven into the basin.")}</p>${e.status ? `<p>Status: ${esc(e.status)}</p>` : ""}`;
  html += `<div class="inspect-actions"><button data-follow="${esc(id)}">${history.followed.includes(id) ? "✓ Following" : "+ Follow"}</button><button class="primary" data-visit="${esc(id)}">${isPerson ? (e.alive ? "Walk with them" : "Visit their place") : "Explore streets"} ↗</button>${s && viewTick === null ? `<button data-possibilities="${esc(s.id)}">Lend a hand</button>` : ""}</div>`;
  if (isPerson)
    html += `<button class="text-button" data-person-stats="${esc(id)}">Traits & memories ↗</button>`;
  if (isSettlement && w.tier > 1) {
    html += '<details class="story-details"><summary>Who lives here?</summary>';
    if (e.population)
      html +=
        '<p class="tiny">Emberkin need food, livable ground, and room for growing households.</p>';
    if (e.synthetics)
      html += `<p class="tiny">Vessels use energy and ceramic repair material. Shell integrity: ${Math.round(e.syntheticIntegrity ?? 0)}%. Wet weather wears their bodies.</p>`;
    if (e.collective)
      html += `<p class="tiny">Chorus nodes live through wet connections and nutrients. Hydration: ${Math.round(e.collectiveHydration ?? e.habitat)}%. New rooms occupy more ground.</p>`;
    html += "</details>";
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
      `${e.alive ? `<p class="current-activity"><span class="muted">Right now:</span> ${esc(e.activity)}</p>` : ""}<details class="story-details"><summary>Get to know ${esc(e.name)}</summary><p>${esc(e.description)}</p><p><b>What matters to them:</b> ${esc(e.commitment)}</p><div class="section-label">Friends & connections</div>` +
      e.relationships
        .map(
          (r) =>
            `<button class="event-link" data-entity="${esc(r.otherId)}">${esc(label(r.otherId, w))}<small>${esc(r.label)}</small></button>`,
        )
        .join("") +
      "</details>";
  }
  if (isSettlement) {
    const occupants = w.characters.filter(
      (c) => c.settlementId === id && c.alive,
    );
    html +=
      '<div class="section-label">People you may meet</div>' +
      occupants.map((c) => entityRow(c.id, w)).join("");
    html +=
      '<div class="section-label">Buildings & old places</div>' +
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
    const options = getInterventions(w)
      .map(friendlyIntervention)
      .filter(
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
              `<div class="intervention"><h3>${esc(i.title)}</h3><p>${esc(i.description)}</p><div class="reason">${esc(i.reason)}</div><button data-intervention="${esc(i.id)}" ${i.available ? "" : "disabled"}>${i.available ? "Try this" : "Not available"}</button></div>`,
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
  let html = `<div class="eyebrow">DAY ${e.tick}</div><h2>${esc(e.title)}</h2><div class="scene">${esc(e.text)}</div><div class="inspect-actions"><button class="primary" data-visit="${esc(e.settlementId)}">Visit this place ↗</button><button data-visit-day="${e.tick}">Visit day ${e.tick}</button></div><details class="story-details" data-event-explanation><summary>Why did this happen?</summary><div class="section-label">Observed effects · what changed</div><ul class="explanation-list">${e.observed.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`;
  if (e.decision) {
    const d = e.decision;
    html +=
      `<div class="section-label">Recorded decision · ${esc(label(d.actorId, w))}</div><p>What they knew at the time:</p><ul class="explanation-list">${d.known.map((k) => `<li>${esc(k)}</li>`).join("")}</ul><p>${d.motives.map(esc).join(" · ")}</p><div class="section-label">What else could they do?</div>` +
      d.alternatives
        .map(
          (a) =>
            `<div class="choice ${a.id === d.chosen ? "chosen" : ""}"><strong>${a.id === d.chosen ? "✓ Chosen · " : a.available ? "Available · " : "Unavailable · "}${esc(a.label)}</strong>${esc(a.reason)}</div>`,
        )
        .join("");
  }
  if (e.interpretations.length) {
    html +=
      '<div class="section-label">Cultural interpretations · what people believe</div>';
    html += e.interpretations
      .map(
        (i) =>
          `<div class="interpretation"><small>${esc(label(i.cultureId, w))} believes:</small><br>${esc(i.text)}</div>`,
      )
      .join("");
  }
  if (e.causes.length)
    html +=
      '<div class="section-label">How this began · earlier records</div>' +
      e.causes
        .map((c) => w.events.find((x) => x.id === c))
        .filter(Boolean)
        .map(eventButton)
        .join("");
  html +=
    '<div class="section-label">People & places involved</div>' +
    e.entities
      .filter((id) => entity(id, w))
      .slice(0, 6)
      .map(
        (id) =>
          `<button class="text-button" data-entity="${esc(id)}">${esc(label(id, w))} ↗</button><br>`,
      )
      .join("") +
    "</details>";
  openInspector(html);
}
function intro() {
  const nera = world().characters.find((c) => c.id === "c-nera");
  renderer.focus(nera.id, "neighborhood");
  renderer.select(nera.id);
  scale = "neighborhood";
  renderScale();
  openInspector(
    `<div class="portrait-heading">${characterPortrait(nera)}<div><div class="eyebrow">WELCOME TO HEARTH</div><h2>Come meet Nera.</h2></div></div><p class="character-hook">She counts plates before people. She also has a problem: her seed room is getting wet.</p><p>Across a blocked path, Oren may know how to help.</p><div class="inspect-actions"><button class="primary" data-entity="c-nera">Meet Nera ↗</button><button data-action="dismiss-intro">Look around</button></div><p class="tiny">Time is paused. Explore as long as you like. Press <b>Next moment</b> when you’re ready.</p>`,
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
    `<div class="eyebrow">YOUR FIRST FEW MINUTES</div><h2>Follow someone.<br>See what happens.</h2><div class="guide-grid"><div><b>1 · Meet a neighbor</b><p>Tap Nera, then Walk with them. Drag to look around. Tap a building to find its story.</p></div><div><b>2 · Watch, or lend a hand</b><p>Open a path or uncover an old place. People choose what to do next. You can also just watch.</p></div><div><b>3 · See what happens</b><p>Press Next moment. Time stops when someone you follow has an important moment.</p></div><div><b>4 · Follow your curiosity</b><p>Ask Why did this happen? Or visit an earlier day and Branch here to try another future. Both are kept.</p></div></div><p>Meet the neighbors: <b>Emberkin</b> are people, <b>Vessels</b> are machine people, and <b>Chorus</b> live through connected root rooms.</p><details class="story-details"><summary>Camera & keyboard tips</summary><p>Drag or use arrow keys to move. Pinch or use + / − to zoom. The overview button brings the whole basin back.</p><p>Space pauses or plays; Escape closes a panel. Nothing happens while you’re away.</p></details><div class="modal-actions"><button class="primary" data-action="close-modal">Let’s explore</button><button data-action="report">Report a problem</button></div>`,
  );
}

function showSettings() {
  modal(
    `<div class="eyebrow">WORLD SETTINGS</div><h2>Your world, safely kept.</h2><p>Keep a copy of your world, or bring a saved one back. All its different futures come with it.</p><div class="modal-actions"><button data-action="export">Export history ↓</button><button data-action="import">Import history ↑</button><button data-action="branches">View branches</button><button data-action="stats">World stats</button></div><label class="field">Sound volume<input id="volume" type="range" min="0" max="60" value="${sound.volume * 100}"></label><details class="story-details"><summary>Time, motion & picture settings</summary><label class="field">When should time stop?<select id="attention"><option value="quiet" ${history.attention === "quiet" ? "selected" : ""}>Only turning points</option><option value="balanced" ${history.attention === "balanced" ? "selected" : ""}>Meaningful changes</option><option value="attentive" ${history.attention === "attentive" ? "selected" : ""}>Small moments too</option></select></label><label class="field">How far can Next moment go?<select id="horizon"><option value="7" ${horizon === 7 ? "selected" : ""}>Up to 7 days</option><option value="14" ${horizon === 14 ? "selected" : ""}>Up to 14 days</option><option value="30" ${horizon === 30 ? "selected" : ""}>Up to 30 days</option></select></label><label class="field">Picture detail<select id="quality"><option value="auto">Automatic</option><option value="low">Gentle on battery</option><option value="high">Full detail</option></select></label><label class="field">Reduce motion<input id="reduced-motion" type="checkbox" ${matchMedia("(prefers-reduced-motion: reduce)").matches ? "checked" : ""}></label></details><p class="tiny">Saves stay in this browser. Export a copy before clearing browser data or starting a new world.</p><button class="text-button" data-action="new-world">Shape another beginning →</button><div class="rule"></div><button data-action="report">Report a problem</button><p class="tiny">Build ${esc(buildInfo.commit.slice(0, 8))}</p>`,
  );
}
function showStats(personId = null) {
  const snapshot = world();
  const person = personId
    ? snapshot.characters.find((c) => c.id === personId)
    : null;
  const report = personId
    ? getPersonStats(snapshot, personId)
    : getWorldStats(snapshot, history);
  if (!report) return;
  const labels = {
    "characters.alive": "People you can follow",
    "population.organic": "Emberkin residents",
    "population.synthetic": "Vessel neighbors",
    "population.collective": "Chorus nodes",
    "structures.built": "New buildings",
    "events.total": "Moments in history",
    "history.branches": "Different futures kept",
    "person.ageDays": "Age in days",
    "person.alive": "Alive",
    "motive.duty": "Sense of duty",
    "power.materialResponses": "Times the Undersong answered",
  };
  const highlights = new Set(
    person
      ? [
          "person.ageYears",
          "motive.care",
          "motive.curiosity",
          "motive.duty",
          "person.memories",
          "person.relationships",
        ]
      : [
          "time.days",
          "characters.alive",
          "structures.built",
          "events.total",
          "history.branches",
          "power.materialResponses",
        ],
  );
  const grid = (items) =>
    `<dl class="stats-grid">${items
      .map((stat) => {
        const value =
          stat.id === "person.alive"
            ? stat.value
              ? "Yes"
              : "No"
            : Number.isInteger(stat.value)
              ? stat.value.toLocaleString()
              : stat.value.toFixed(1);
        const unit = stat.unit
          ? ` <small>${esc(stat.unit === "model units" ? "units" : stat.unit)}</small>`
          : "";
        return `<div class="stat-card"><dt>${esc(labels[stat.id] || stat.label)}</dt><dd>${value}${unit}</dd></div>`;
      })
      .join("")}</dl>`;
  const remaining = report.stats.filter(
    (stat) => !highlights.has(stat.id) && stat.id !== "history.commands",
  );
  const groups = person
    ? [["More of their story", remaining]]
    : [
        [
          "Places & neighbors",
          remaining.filter((stat) =>
            /^(regions|settlements|population|characters|structures|routes)\./.test(
              stat.id,
            ),
          ),
        ],
        [
          "Stories & traditions",
          remaining.filter((stat) =>
            /^(cultures|institutions|threads|events)\./.test(stat.id),
          ),
        ],
        [
          "Supplies & the shared channel",
          remaining.filter((stat) =>
            /^(resources|knowledge|power|network)\./.test(stat.id),
          ),
        ],
        [
          "This telling",
          remaining.filter((stat) => stat.id.startsWith("history.")),
        ],
      ];
  modal(
    `<div class="eyebrow">${person ? "TRAITS & MEMORIES" : "YOUR WORLD IN NUMBERS"} · DAY ${snapshot.tick}</div>${person ? `<div class="portrait-heading">${characterPortrait(person)}<h2>${esc(person.name)}</h2></div><p>These traits help shape their choices. Their memories grow as life happens.</p>` : "<h2>A world with a history.</h2><p>A closer look at the people, places, and changes in this telling.</p>"}${grid(report.stats.filter((stat) => highlights.has(stat.id)))}${groups
      .filter(([, items]) => items.length)
      .map(
        ([name, items]) =>
          `<details class="story-details"><summary>${name}</summary>${grid(items)}</details>`,
      )
      .join(
        "",
      )}<div class="modal-actions"><button data-action="close-modal">Back to the world</button></div>`,
  );
}
function showProblemReport() {
  modal(
    `<div class="eyebrow">HELP US MEND THINGS</div><h2>Something went wrong?</h2><p>Save a report you can share with the person testing the game. It includes this world’s history, game version, browser details, and your note.</p><label for="problem-note">What happened?</label><textarea id="problem-note" class="report-note" maxlength="2000" placeholder="What were you trying to do? What happened instead?"></textarea><p class="tiny">The report downloads to your device. It is not sent anywhere automatically.</p><div class="modal-actions"><button class="primary" data-action="download-report">Download report ↓</button><button data-action="close-modal">Back to the world</button></div>`,
  );
}
function exportProblemReport() {
  const report = {
    format: "worldweaver-problem-report",
    reportVersion: 1,
    build: buildInfo,
    note: $("problem-note").value.slice(0, 2000),
    browser: navigator.userAgent || "unknown",
    viewport: {
      width: window.innerWidth || null,
      height: window.innerHeight || null,
      pixelRatio: globalThis.devicePixelRatio || 1,
    },
    view: {
      day: world().tick,
      historicalDay: viewTick,
      camera: renderer.getViewState(),
    },
    saveStatus: $("save-state").textContent,
    lastNotice,
    stats: getWorldStats(world(), history),
    history: JSON.parse(serializeHistory(history)),
  };
  downloadFile(
    `worldweaver-report-day-${world().tick}.json`,
    JSON.stringify(report, null, 2),
  );
  toast("Report downloaded. Share it when you’re ready.");
}
function downloadFile(filename, contents) {
  const url = URL.createObjectURL(
    new Blob([contents], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  if (d.personStats) showStats(d.personStats);
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
      const options = getInterventions(w)
        .map(friendlyIntervention)
        .filter(
          (i) =>
            i.targetId === place.id ||
            place.structures.some((b) => b.id === i.targetId) ||
            w.routes.some(
              (r) =>
                r.id === i.targetId &&
                (r.from === place.id || r.to === place.id),
            ),
        );
      modal(
        `<div class="eyebrow">LEND A HAND</div><h2>${esc(place.name)}</h2><p>You can open a way forward. The neighbors decide what happens next.</p>${options.map((i) => `<div class="intervention"><h3>${esc(i.title)}</h3><p>${esc(i.description)}</p><div class="reason">${esc(i.reason)}</div><button data-intervention="${esc(i.id)}" ${i.available ? "" : "disabled"}>${i.available ? "Try this" : "Not available"}</button></div>`).join("")}`,
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
  if (action === "stats") showStats();
  if (action === "report") showProblemReport();
  if (action === "download-report") exportProblemReport();
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
