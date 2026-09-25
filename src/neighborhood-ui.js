import {
  DECOR_ITEMS,
  DECOR_SLOTS,
  PET_COLORS,
  PET_ACCESSORIES,
  NEIGHBORHOOD_LIMITS,
  channelPorts,
  channelFlow,
  defaultNeighborhood,
} from "./neighborhood.js";
import { NeighborhoodView } from "./view/neighborhood-view.js";

const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
const MODES = ["welcome", "decorate", "companion", "water"];
const DIRECTIONS = { n: "north", e: "east", s: "south", w: "west" };
const TILE_NAMES = [
  "Upper left",
  "Upper middle",
  "Upper right",
  "Middle left",
  "Center",
  "Middle right",
  "Lower left",
  "Lower middle",
  "Lower right",
];
const TOSS_SPOTS = [
  { x: 0.72, y: 0.38 },
  { x: 0.24, y: 0.68 },
  { x: 0.84, y: 0.73 },
  { x: 0.33, y: 0.27 },
  { x: 0.56, y: 0.82 },
];

// These little line drawings are interface symbols. The actual objects live in
// the courtyard renderer, so choosing a furnishing never substitutes a menu
// illustration for a change in the scene.
function icon(name, className = "") {
  const drawings = {
    decorate: '<path d="M4 13h16v4H4zM6 13V7h12v6M6 17v4m12-4v4M8 7V4m8 3V4"/>',
    companion: '<path d="m5 14-1-8 6 4m9 4 1-8-6 4M5 14c0-5 14-5 14 0 0 7-14 7-14 0Z"/><path d="m10 16 2 2 2-2M8 13h.01M16 13h.01"/>',
    water: '<path d="M12 3C10 7 5 11 5 15a7 7 0 0 0 14 0c0-4-5-8-7-12Z"/><path d="M9 16c0 2 1 3 3 3"/>',
    bench: '<path d="M3 13h18v4H3zM5 13V6h14v7M5 17v4m14-4v4M5 9h14"/>',
    planter: '<path d="M6 13h12l-2 8H8zM5 13h14M12 13V4m0 5C6 10 5 5 6 4c5 0 6 5 6 5Zm0 2c6 1 7-4 6-5-5 0-6 5-6 5Z"/>',
    lantern: '<path d="M6 8h12v11H6zM5 8h14L15 4H9zM12 4V2M5 21h14M10 17v-5h4v5z"/>',
    rug: '<path d="m3 8 14-4 4 12-14 4zM5 7 4 4m5 2L8 3m5 2-1-3m-4 19 1 2m3-3 1 2m3-3 1 2"/><path d="m8 10 6-2 3 6-6 2z"/>',
    cushions: '<path d="M3 9q7-3 13 0l-1 11q-7-2-12 0zM8 9V4q7-2 13 1l-1 11-5 1"/><path d="m5 12 2 1m5 3 1 1"/>',
    birdbath: '<path d="M3 10h18c-1 5-17 5-18 0ZM12 14v6m-5 1h10M14 7c-3-5 2-5 3-3l3 1-3 2v3"/>',
    "pet-bed": '<path d="M3 12c0-6 18-6 18 0v6c0 5-18 5-18 0zM3 15c0 5 18 5 18 0M8 11c3-2 5-2 8 0"/>',
    "wind-chime": '<path d="M12 2v4M4 8l8-3 8 3ZM6 8v10m4-10v13m4-13v10m4-10v12M5 18h2m2 3h2m2-3h2m2 2h2"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    rotate: '<path d="M20 10A8 8 0 1 0 19 18M20 4v6h-6"/>',
    move: '<path d="M12 3v18M3 12h18m-13-5 4-4 4 4m-8 10 4 4 4-4M7 8l-4 4 4 4m10-8 4 4-4 4"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    house: '<path d="m3 11 9-8 9 8M6 9v12h12V9M10 21v-7h4v7"/>',
    sparkle: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>',
  };
  return `<svg class="nh-icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${drawings[name] || drawings.sparkle}</svg>`;
}

function pipeIcon(ports) {
  const ends = { n: [24, 0], e: [48, 24], s: [24, 48], w: [0, 24] };
  const lines = ports.map((port) => `<path d="M24 24L${ends[port].join(" ")}"/>`).join("");
  return `<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round">${lines}</g><circle cx="24" cy="24" r="4" fill="currentColor"/></svg>`;
}

export class NeighborhoodUI {
  constructor(container, callbacks = {}, {
    ViewClass = NeighborhoodView,
    viewOptions = {},
    comparisonEnabled = false,
    rendererName = "Illustrated",
  } = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.comparisonEnabled = Boolean(comparisonEnabled);
    this.rendererName = rendererName;
    this.isThree = ViewClass !== NeighborhoodView;
    this.rendererFallback = "";
    this.mode = "welcome";
    this.visible = false;
    this.busy = false;
    this.selectedItemId = null;
    this.selectedSlotId = null;
    this.movingFrom = null;
    this.helpOpen = false;
    this.detailState = new Map();
    this.state = {
      world: null,
      neighborhood: defaultNeighborhood(),
      historical: false,
      restoration: { available: false, reason: "The spring is not available yet." },
      saveOk: true,
      reducedMotion: false,
    };
    container.classList.add("neighborhood-surface");
    container.hidden = true;
    container.setAttribute("tabindex", "-1");
    container.innerHTML = `
      <header class="nh-header">
        <button class="nh-home" type="button" data-nh-action="home" aria-label="Courtyard welcome">
          ${icon("house")}<span><small>A CORNER OF THE QUIET BASIN</small><strong>Hearth courtyard</strong></span>
        </button>
        <div class="nh-header-actions">
          <button class="nh-help-button" type="button" data-nh-action="help" aria-expanded="false" aria-controls="nh-help">A little help</button>
          <button class="nh-exit" type="button" data-nh-action="exit">Explore basin ${icon("arrow")}</button>
        </div>
      </header>
      <aside id="nh-help" class="nh-help" hidden aria-label="About your visit">
        <div><h2>You have a place here.</h2>
          <p>Hearth is home to the Emberkin. Beyond these rooftops, living machines and colonies that think together share the valley.</p>
          <p>You’re a visitor: make this courtyard yours, play with your companion, or help the spring reach the garden. The neighbors make their own choices. Explore the basin to meet them.</p>
          <p class="nh-help-note">There’s no chore list. Decorating and playing don’t advance the world’s days. Your courtyard and companion stay with you when you explore another telling.</p>
        </div>
        <button type="button" data-nh-action="help" aria-label="Close courtyard help">${icon("close")}</button>
      </aside>
      <nav class="nh-activities" aria-label="Courtyard activities">
        <button type="button" data-nh-mode="decorate">${icon("decorate")}<span>Make it yours</span></button>
        <button type="button" data-nh-mode="companion">${icon("companion")}<span>Play with Pip</span></button>
        <button type="button" data-nh-mode="water">${icon("water")}<span>Help water flow</span></button>
      </nav>
      <div class="nh-main">
        <div class="nh-stage">
          <canvas id="neighborhood-canvas" tabindex="0" aria-label="Hearth courtyard. Activities also have keyboard controls in the adjacent panel."></canvas>
          <div class="nh-test-controls" hidden aria-label="Compare courtyard views"></div>
          <p class="nh-scene-tip" id="nh-scene-tip"></p>
        </div>
        <aside class="nh-tools" aria-label="Courtyard activity controls"><div class="nh-panel"></div></aside>
      </div>
      <div class="nh-messages">
        <p class="nh-save-warning" role="alert" hidden>These changes aren’t saved. Keep this tab open and export your world from Settings.</p>
        <p class="nh-status" role="status" aria-live="polite" aria-atomic="true"></p>
      </div>`;
    this.canvas = container.querySelector("#neighborhood-canvas");
    this.panel = container.querySelector(".nh-panel");
    this.stageTip = container.querySelector(".nh-scene-tip");
    this.status = container.querySelector(".nh-status");
    this.saveWarning = container.querySelector(".nh-save-warning");
    const canvas = this.canvas;
    const onSelect = (selection) => this._selectScene(selection);
    try {
      this.view = new ViewClass(canvas, { ...viewOptions, onSelect, onError: (error) => {
        if (this.canvas === canvas && this.isThree) this._useIllustratedFallback(error);
      } });
    } catch (error) {
      if (ViewClass === NeighborhoodView) throw error;
      this._useIllustratedFallback(error);
    }
    this.view.setVisible(false);
    this._renderComparison();
    this.handlers = {
      click: (event) => this._click(event),
      change: (event) => this._change(event),
      submit: (event) => this._submit(event),
      keydown: (event) => this._key(event),
    };
    for (const [name, handler] of Object.entries(this.handlers))
      container.addEventListener(name, handler);
    this._render();
  }

  update(nextState) {
    this.state = { ...this.state, ...nextState };
    if (!this.state.neighborhood) this.state.neighborhood = defaultNeighborhood();
    this._render();
  }

  show(mode = "welcome") {
    this.visible = true;
    this.container.hidden = false;
    this._setMode(mode);
    this.view.setVisible(true);
    this.container.focus?.({ preventScroll: true });
  }

  hide() {
    this.visible = false;
    this.container.hidden = true;
    this.view.setVisible(false);
  }

  isVisible() {
    return this.visible;
  }

  getDiagnostics() {
    return {
      renderer: this.isThree ? "three" : "illustrated",
      mode: this.mode,
      status: this.canvas.dataset.renderStatus || (this.isThree ? "starting" : "ready"),
      error: this.rendererError ? String(this.rendererError.message || this.rendererError).slice(0, 300) : null,
    };
  }

  _useIllustratedFallback(error) {
    if (!this.isThree) return;
    this.isThree = false;
    try { this.view?.destroy(); } catch { /* Recovery must survive a broken GPU. */ }
    // Context type is permanent for a canvas. Discard WebGL dimensions,
    // diagnostics and event handlers while keeping the activity and save state.
    const cleanCanvas = this.container.ownerDocument.createElement("canvas");
    cleanCanvas.id = this.canvas.id;
    cleanCanvas.tabIndex = 0;
    this.canvas.replaceWith(cleanCanvas);
    this.canvas = cleanCanvas;
    this.view = new NeighborhoodView(cleanCanvas, { onSelect: selection => this._selectScene(selection) });
    this.rendererName = "Illustrated fallback";
    this.rendererFallback = "The 3D view couldn’t draw here. The illustrated courtyard is ready to play. Your choices are kept.";
    this.rendererError = error;
    this.comparisonEnabled = true;
    this._renderComparison();
    this._render();
    this.view.setVisible(this.visible);
  }

  _renderComparison() {
    const controls = this.container.querySelector(".nh-test-controls");
    this.container.dataset.renderer = this.isThree ? "three" : "canvas";
    controls.hidden = !this.comparisonEnabled;
    if (!this.comparisonEnabled) return;
    const location = this.container.ownerDocument?.defaultView?.location || globalThis.location;
    const hrefFor = (renderer) => {
      const url = new URL(location?.href || "https://worldweaver.invalid/");
      url.searchParams.set("renderer", renderer);
      return `${url.pathname}${url.search}${url.hash}`;
    };
    controls.innerHTML = `<div class="nh-test-row">
      <span class="nh-test-label">${escape(this.rendererName)}</span>
      <nav class="nh-test-links" aria-label="Courtyard picture style">
        <a href="${escape(hrefFor("canvas"))}" data-nh-renderer="canvas" ${!this.isThree ? 'aria-current="page"' : ""}>Illustrated</a>
        <a href="${escape(hrefFor("three"))}" data-nh-renderer="three" ${this.isThree ? 'aria-current="page"' : ""}>3D test</a>
      </nav>
      ${this.isThree ? '<button type="button" data-nh-action="reset-view">Reset view</button>' : ""}
    </div>
    ${this.isThree ? '<p class="nh-test-hint">Drag to turn · pinch or scroll to zoom. Tap to play.</p>' : ""}
    ${this.rendererFallback ? `<p class="nh-test-fallback" role="status">${escape(this.rendererFallback)}</p>` : ""}`;
  }

  destroy() {
    for (const [name, handler] of Object.entries(this.handlers))
      this.container.removeEventListener(name, handler);
    this.view.destroy();
    this.container.innerHTML = "";
    this.container.classList.remove("neighborhood-surface");
    this.container.hidden = true;
    this.visible = false;
  }

  _setMode(mode) {
    this.mode = MODES.includes(mode) ? mode : "welcome";
    this.selectedItemId = null;
    this.selectedSlotId = null;
    this.movingFrom = null;
    this._announce("");
    this._render();
    this.container.querySelector(".nh-tools").scrollTop = 0;
  }

  _isRestored() {
    return Boolean(this.state.world?.flags?.habitatRestored);
  }

  _canAct() {
    return !this.state.historical && !this.busy;
  }

  _announce(message, error = false) {
    this.status.textContent = message;
    this.status.classList.toggle("nh-status-error", error);
    this.status.hidden = !message;
  }

  _perform(callback, args, success) {
    if (!this._canAct() || typeof callback !== "function") return;
    const complete = (result) => {
      this.busy = false;
      this._render();
      if (result?.ok === false) {
        this._announce(result.error || "That change could not be saved. Keep this tab open and export your world from Settings.", true);
      } else if (this.state.saveOk === false) {
        this._announce("Your changes are in this visit, but aren’t saved. Keep this tab open and export your world from Settings.", true);
      } else {
        this._announce(success);
      }
    };
    try {
      const result = callback(...args);
      if (result && typeof result.then === "function") {
        this.busy = true;
        this._render();
        result.then(complete, (error) => complete({ ok: false, error: error?.message || "That change could not be made." }));
      } else complete(result);
    } catch (error) {
      complete({ ok: false, error: error?.message || "That change could not be made." });
    }
  }

  _action(action, message) {
    this._perform(this.callbacks.onAction, [action], message);
  }

  _chooseSlot(slotId) {
    if (!DECOR_SLOTS.some((slot) => slot.id === slotId)) return;
    if (this.movingFrom && this._canAct()) {
      const fromSlotId = this.movingFrom;
      this.movingFrom = null;
      this.selectedSlotId = slotId;
      if (fromSlotId === slotId) {
        this._render();
        this._announce("Same spot. Everything stays where it is.");
      } else {
        this._action({ type: "move", fromSlotId, toSlotId: slotId }, "A new arrangement. You can keep moving things around.");
      }
    } else if (this.selectedItemId && this._canAct()) {
      const itemId = this.selectedItemId;
      const item = DECOR_ITEMS.find((entry) => entry.id === itemId);
      this.selectedItemId = null;
      this.selectedSlotId = slotId;
      this._action({ type: "place", slotId, itemId }, `${item.label} placed. Select it to turn it or move it.`);
    } else {
      this.selectedSlotId = slotId;
      this._announce("");
      this._render();
    }
  }

  _selectScene(selection) {
    if (!this.visible || !selection) return;
    if (selection.type === "house") {
      this._setMode("decorate");
    } else if (selection.type === "pet") {
      this._setMode("companion");
    } else if (selection.type === "slot") {
      if (this.mode !== "decorate") this._setMode("decorate");
      this._chooseSlot(selection.slotId);
    } else if (selection.type === "lawn" && this.mode === "companion") {
      this._toss(selection.x, selection.y);
    } else if (selection.type === "channel") {
      if (this.mode !== "water") this._setMode("water");
      this._turnChannel(selection.index);
    }
  }

  _toss(x, y) {
    if (!this._canAct()) return;
    this._action({ type: "toss", x, y }, `${this.state.neighborhood.companion.name} is on it! Tap another patch of grass to play again.`);
  }

  _turnChannel(index) {
    if (!this._canAct() || this._isRestored()) return;
    this._action({ type: "channel-turn", index }, "Stone turned. Follow the water from the spring.");
  }

  _click(event) {
    if (!this.visible) return;
    const comparisonLink = event.target.closest?.("[data-nh-renderer]");
    if (comparisonLink && this.container.contains(comparisonLink) && this.state.saveOk === false) {
      event.preventDefault();
      this._announce("Save or export this world before switching views, so your changes stay with you.", true);
      return;
    }
    const button = event.target.closest?.("button");
    if (!button || !this.container.contains(button) || button.disabled) return;
    if (button.dataset.nhMode) {
      this._setMode(button.dataset.nhMode);
      return;
    }
    if (button.dataset.nhItem) {
      this.selectedItemId = button.dataset.nhItem;
      this.movingFrom = null;
      this._announce("");
      this._render();
      return;
    }
    if (button.dataset.nhColor) {
      this._action({ type: "pet-color", color: button.dataset.nhColor }, "A fresh little coat of color.");
      return;
    }
    if (button.dataset.nhAccessory) {
      this._action({ type: "pet-accessory", accessory: button.dataset.nhAccessory }, "Looking rather splendid.");
      return;
    }
    if (button.dataset.nhChannel !== undefined) {
      this._turnChannel(Number(button.dataset.nhChannel));
      return;
    }
    switch (button.dataset.nhAction) {
      case "home":
        this._setMode("welcome");
        break;
      case "reset-view":
        if (this.isThree) this.view.resetCamera?.();
        break;
      case "exit":
        this.callbacks.onExit?.();
        break;
      case "help":
        this.helpOpen = !this.helpOpen;
        this._render();
        if (!this.helpOpen) this.container.querySelector(".nh-help-button").focus();
        break;
      case "cancel-placement":
        this.selectedItemId = null;
        this.movingFrom = null;
        this._render();
        break;
      case "rotate":
        if (this.selectedSlotId) this._action({ type: "rotate", slotId: this.selectedSlotId }, "Turned to face a new way.");
        break;
      case "move":
        this.movingFrom = this.selectedSlotId;
        this.selectedItemId = null;
        this._render();
        break;
      case "remove":
        if (this.selectedSlotId) this._action({ type: "remove", slotId: this.selectedSlotId }, "Put away. You can place it again whenever you like.");
        break;
      case "person-style":
        if (this._canAct()) this.callbacks.onPersonStyle?.();
        break;
      case "toss": {
        const spot = TOSS_SPOTS[this.state.neighborhood.companion.tosses % TOSS_SPOTS.length];
        this._toss(spot.x, spot.y);
        break;
      }
      case "restore":
        // Looking at a solved layout must never apply a world command. Only
        // this explicit action may restore water, using current availability.
        if (!this._isRestored() && this.state.restoration?.available && channelFlow(this.state.neighborhood.channelTurns).connected)
          this._perform(this.callbacks.onRestore, [], "The spring is open. See what Hearth makes of it.");
        break;
      case "advance":
        this._perform(this.callbacks.onAdvance, [], "A day passed. Hearth’s neighbors keep making their own choices.");
        break;
      case "inspect":
        this.callbacks.onInspect?.();
        break;
    }
  }

  _change(event) {
    if (!this.visible) return;
    if (event.target.matches?.("[data-nh-slot-picker]") && event.target.value)
      this._chooseSlot(event.target.value);
  }

  _submit(event) {
    if (!this.visible || !event.target.matches?.("[data-nh-name-form]")) return;
    event.preventDefault();
    const name = event.target.querySelector("[name=companion-name]").value.trim();
    this._action({ type: "name", name }, `Hello, ${name}.`);
  }

  _key(event) {
    if (!this.visible || event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    if (this.helpOpen) {
      this.helpOpen = false;
      this._render();
      this.container.querySelector(".nh-help-button").focus();
    } else if (this.selectedItemId || this.movingFrom) {
      this.selectedItemId = null;
      this.movingFrom = null;
      this._render();
    } else if (this.mode !== "welcome") {
      this._setMode("welcome");
      this.container.querySelector(".nh-home").focus();
    } else this.callbacks.onExit?.();
  }

  _render() {
    const active = this.container.ownerDocument?.activeElement;
    const focusKey = active?.dataset?.nhFocus;
    const inputState = active?.tagName === "INPUT"
      ? { value: active.value, start: active.selectionStart, end: active.selectionEnd }
      : null;
    for (const detail of this.panel.querySelectorAll("details[data-nh-detail]"))
      this.detailState.set(detail.dataset.nhDetail, detail.open);

    const name = this.state.neighborhood.companion.name;
    this.container.dataset.mode = this.mode;
    this.container.querySelector("#nh-help").hidden = !this.helpOpen;
    this.container.querySelector(".nh-help-button").setAttribute("aria-expanded", String(this.helpOpen));
    for (const button of this.container.querySelectorAll(".nh-activities [data-nh-mode]")) {
      button.setAttribute("aria-pressed", String(button.dataset.nhMode === this.mode));
      if (button.dataset.nhMode === "companion")
        button.querySelector("span").textContent = `Play with ${name}`;
    }
    this.saveWarning.hidden = this.state.saveOk !== false;
    const notice = this.state.historical
      ? '<p class="nh-historical">You’re visiting an earlier day. Return to the present to change this place.</p>'
      : "";
    this.panel.innerHTML = notice + this[`_${this.mode}Panel`]();
    for (const detail of this.panel.querySelectorAll("details[data-nh-detail]"))
      if (this.detailState.has(detail.dataset.nhDetail))
        detail.open = this.detailState.get(detail.dataset.nhDetail);
    if (focusKey) {
      const replacement = [...this.panel.querySelectorAll("[data-nh-focus]")]
        .find((element) => element.dataset.nhFocus === focusKey);
      if (replacement && !replacement.disabled) {
        if (inputState && replacement.tagName === "INPUT") {
          replacement.value = inputState.value;
          replacement.setSelectionRange?.(inputState.start, inputState.end);
        }
        replacement.focus?.({ preventScroll: true });
      }
    }
    const tips = {
      welcome: "Your corner of a world that keeps growing.",
      decorate: this.movingFrom
        ? "Tap a new spot. If it’s occupied, the two objects swap."
        : this.selectedItemId
          ? "Tap a marked spot to place it."
          : "Choose something below, or tap a furnishing to move it.",
      companion: `Tap the grass. ${name} will chase your sunseed.`,
      water: this._isRestored()
        ? "The spring is flowing into Hearth."
        : "Tap the channel stones to turn them. Follow the water.",
    };
    this.stageTip.textContent = tips[this.mode];
    this.view.setState({
      ...this.state,
      mode: this.mode,
      selectedItemId: this.selectedItemId,
      selectedSlotId: this.selectedSlotId,
      historical: this.state.historical,
      waterRunning: this._isRestored(),
    });
  }

  _welcomePanel() {
    const name = escape(this.state.neighborhood.companion.name);
    return `<div class="nh-panel-intro"><span class="nh-eyebrow">COME ON IN</span><h2>Make yourself at home.</h2><p>You’re a visitor in Hearth, a village with a life of its own. This courtyard is your corner: make it cozy, play with a friend, or help the garden grow.</p></div>
      <div class="nh-welcome-choices">
        <button type="button" data-nh-mode="decorate">${icon("decorate")}<span><strong>Make it yours</strong><small>Arrange a cozy courtyard</small></span>${icon("arrow")}</button>
        <button type="button" data-nh-mode="companion">${icon("companion")}<span><strong>Meet ${name}</strong><small>A small fox. A very big tail.</small></span>${icon("arrow")}</button>
        <button type="button" data-nh-mode="water">${icon("water")}<span><strong>${this._isRestored() ? "Visit the spring" : "Help water flow"}</strong><small>${this._isRestored() ? "See what changed in Hearth" : "Turn the stones. Bring back the spring."}</small></span>${icon("arrow")}</button>
      </div>
      <p class="nh-footnote">Take your time. Decorating and playing don’t advance the days.</p>`;
  }

  _decoratePanel() {
    const disabled = this._canAct() ? "" : "disabled";
    const selected = this.state.neighborhood.items[this.selectedSlotId];
    const selectedItem = selected && DECOR_ITEMS.find((item) => item.id === selected.itemId);
    const pendingItem = DECOR_ITEMS.find((item) => item.id === this.selectedItemId);
    const inventory = DECOR_ITEMS.map((item) => `<button type="button" class="nh-item" data-nh-item="${escape(item.id)}" data-nh-focus="item-${escape(item.id)}" aria-pressed="${this.selectedItemId === item.id}" ${disabled}>${icon(item.id)}<span>${escape(item.label)}</span></button>`).join("");
    const slots = DECOR_SLOTS.map((slot) => {
      const item = this.state.neighborhood.items[slot.id];
      const label = DECOR_ITEMS.find((entry) => entry.id === item?.itemId)?.label || "Empty";
      return `<option value="${escape(slot.id)}" ${this.selectedSlotId === slot.id && !pendingItem && !this.movingFrom ? "selected" : ""}>${escape(slot.label)} · ${escape(label)}</option>`;
    }).join("");
    let selection = '<p class="nh-instruction">Choose something, then tap a spot in the courtyard.</p>';
    if (pendingItem || this.movingFrom) {
      selection = `<div class="nh-placement"><p>${this.movingFrom ? "Choose another spot. Occupied spots swap." : `Where should the ${escape(pendingItem.label.toLowerCase())} go?`}</p><button type="button" data-nh-action="cancel-placement" data-nh-focus="cancel-placement">Cancel</button></div>`;
    } else if (selectedItem) {
      selection = `<div class="nh-object-controls"><div><strong>${escape(selectedItem.label)}</strong><span>${escape(DECOR_SLOTS.find((slot) => slot.id === this.selectedSlotId)?.label)}</span></div><div class="nh-object-buttons"><button type="button" data-nh-action="rotate" data-nh-focus="rotate" ${disabled}>${icon("rotate")}Turn</button><button type="button" data-nh-action="move" data-nh-focus="move" ${disabled}>${icon("move")}Move</button><button type="button" data-nh-action="remove" data-nh-focus="remove" ${disabled}>Put away</button></div></div>`;
    } else if (this.selectedSlotId) {
      selection = '<p class="nh-instruction">A little room for something lovely. Choose a furnishing.</p>';
    }
    return `<div class="nh-panel-intro"><span class="nh-eyebrow">A PLACE OF YOUR OWN</span><h2>Cozy looks good here.</h2></div>
      <div class="nh-inventory" role="group" aria-label="Furnishings">${inventory}</div>
      ${selection}
      <label class="nh-slot-label" for="nh-slot-picker">Or choose a spot here</label>
      <select id="nh-slot-picker" data-nh-slot-picker data-nh-focus="slot-picker" ${disabled}><option value="" ${pendingItem || this.movingFrom || !this.selectedSlotId ? "selected" : ""}>Choose a courtyard spot…</option>${slots}</select>
      <button type="button" class="nh-neighbor-style" data-nh-action="person-style" data-nh-focus="person-style" ${disabled}>${icon("sparkle")}Dress a neighbor ${icon("arrow")}</button>`;
  }

  _companionPanel() {
    const pet = this.state.neighborhood.companion;
    const disabled = this._canAct() ? "" : "disabled";
    const colors = PET_COLORS.map((color) => `<button type="button" class="nh-pet-color" data-nh-color="${escape(color.id)}" data-nh-focus="color-${escape(color.id)}" aria-pressed="${pet.color === color.id}" ${disabled}><i style="--pet-color:${escape(color.coat)}"></i><span>${escape(color.label)}</span></button>`).join("");
    const accessories = PET_ACCESSORIES.map((accessory) => `<button type="button" data-nh-accessory="${escape(accessory.id)}" data-nh-focus="accessory-${escape(accessory.id)}" aria-pressed="${pet.accessory === accessory.id}" ${disabled}>${escape(accessory.label)}</button>`).join("");
    return `<div class="nh-panel-intro"><span class="nh-eyebrow">YOUR TRAVELING COMPANION</span><h2>${escape(pet.name)}, the glimmerfox.</h2><p>Tap the grass to toss a sunseed. Watch that tail go.</p></div>
      <button type="button" class="nh-primary nh-throw" data-nh-action="toss" data-nh-focus="toss" ${disabled}>${icon("sparkle")}${pet.tosses ? "Throw another sunseed" : "Throw a sunseed"}${icon("arrow")}</button>
      <form class="nh-name-form" data-nh-name-form><label for="nh-companion-name">What shall we call you?</label><div><input id="nh-companion-name" name="companion-name" type="text" value="${escape(pet.name)}" maxlength="${NEIGHBORHOOD_LIMITS.name}" required autocomplete="off" data-nh-focus="pet-name" ${disabled}><button type="submit" data-nh-focus="name-submit" ${disabled}>Name</button></div></form>
      <fieldset class="nh-pet-colors"><legend>Coat color</legend><div>${colors}</div></fieldset>
      <fieldset class="nh-pet-accessories"><legend>A little something extra</legend><div>${accessories}</div></fieldset>
      <p class="nh-footnote">No feeding clock. No chores. Just a friend who’s glad you’re here.</p>`;
  }

  _waterPanel() {
    const disabled = this._canAct() ? "" : "disabled";
    if (this._isRestored()) {
      return `<div class="nh-panel-intro"><span class="nh-eyebrow">A LITTLE HELP, A REAL CHANGE</span><h2>The spring is singing.</h2><p>Water is flowing into Hearth again. The neighbors will decide what to make of it.</p></div>
        <div class="nh-water-success">${icon("water")}<span>The spring is open.<br><small>You don’t need to repair it again.</small></span></div>
        <button type="button" class="nh-primary" data-nh-action="inspect" data-nh-focus="inspect">See what changed ${icon("arrow")}</button>
        <button type="button" class="nh-secondary" data-nh-action="advance" data-nh-focus="advance" ${disabled}>Let one day pass</button>
        <p class="nh-footnote">Curious what comes next? Pass a day when you’re ready, or keep playing here.</p>`;
    }
    const flow = channelFlow(this.state.neighborhood.channelTurns);
    const available = Boolean(this.state.restoration?.available);
    const tiles = TILE_NAMES.map((name, index) => {
      const ports = channelPorts(index, this.state.neighborhood.channelTurns);
      return `<button type="button" class="nh-channel-tile ${flow.wetCells.includes(index) ? "is-wet" : ""}" data-nh-channel="${index}" data-nh-focus="channel-${index}" aria-label="${name} stone, openings ${ports.map((port) => DIRECTIONS[port]).join(" and ")}. Turn clockwise." ${disabled}>${pipeIcon(ports)}</button>`;
    }).join("");
    let flowText = "Start at the spring on the left. Keep the water inside the channels.";
    if (flow.connected) flowText = "A clear path to the garden. Ready when you are.";
    else if (flow.wetCells.length) flowText = "The water spills onto the stones. Turn the next channel to catch it.";
    const unavailable = !available
      ? `<p class="nh-unavailable">${escape(this.state.restoration?.reason || "The spring cannot be opened right now.")}</p>`
      : "";
    return `<div class="nh-panel-intro"><span class="nh-eyebrow">HELP THE GARDEN GROW</span><h2>A way for the water.</h2><p>Tap the stones to turn them. Join the spring on the left to the garden on the right.</p></div>
      <p class="nh-flow-state ${flow.connected ? "is-connected" : ""}">${icon("water")}<span>${flowText}</span></p>
      <button type="button" class="nh-primary" data-nh-action="restore" data-nh-focus="restore" ${!this._canAct() || !flow.connected || !available ? "disabled" : ""}>Open the spring ${icon("arrow")}</button>
      ${unavailable}
      <details class="nh-channel-controls" data-nh-detail="channels"><summary>Channel controls <span>Keyboard-friendly</span></summary><div class="nh-channel-labels"><span>← Spring</span><span>Garden →</span></div><div class="nh-channel-board" role="group" aria-label="Channel stones, three rows from top to bottom">${tiles}</div><p>These turn the same stones you see in the courtyard.</p></details>
      <p class="nh-footnote">Opening the spring helps the real settlement. No time limit—try as many paths as you like.</p>`;
  }
}
