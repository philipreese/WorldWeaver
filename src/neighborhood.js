/** Player-wide courtyard choices. Nothing in this module mutates the simulated world. */
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export const DECOR_ITEMS = freeze([
  { id: 'bench', label: 'Carved bench' },
  { id: 'planter', label: 'Wildflower planter' },
  { id: 'lantern', label: 'Firefly lantern' },
  { id: 'rug', label: 'Woven rug' },
  { id: 'cushions', label: 'Cozy cushions' },
  { id: 'birdbath', label: 'Stone birdbath' },
  { id: 'pet-bed', label: 'Glimmerfox bed' },
  { id: 'wind-chime', label: 'Shell wind chime' },
]);

// Coordinates belong to the canonical 1000 × 760 courtyard scene, not the world map.
export const DECOR_SLOTS = freeze([
  { id: 'porch-left', label: 'Left porch', x: 310, y: 415 },
  { id: 'porch-right', label: 'Right porch', x: 470, y: 415 },
  { id: 'garden-left', label: 'Left garden', x: 185, y: 492 },
  { id: 'garden-right', label: 'Right garden', x: 594, y: 473 },
  { id: 'lawn-left', label: 'Left lawn', x: 352, y: 570 },
  { id: 'lawn-right', label: 'Right lawn', x: 565, y: 593 },
]);

export const PET_COLORS = freeze([
  { id: 'amber', label: 'Amber', coat: '#dfa25c', shade: '#945339', accent: '#ffe7ac' },
  { id: 'frost', label: 'Frost', coat: '#b5d9dd', shade: '#56778e', accent: '#edfaff' },
  { id: 'moss', label: 'Moss', coat: '#9fbd7f', shade: '#55714f', accent: '#e0efb6' },
  { id: 'plum', label: 'Plum', coat: '#b9a0d0', shade: '#73557d', accent: '#f2dcfa' },
]);

export const PET_ACCESSORIES = freeze([
  { id: 'none', label: 'Just fluff' },
  { id: 'scarf', label: 'Little scarf' },
  { id: 'bow', label: 'Ribbon bow' },
  { id: 'flower', label: 'Wildflower' },
]);

// Ports are unrotated; clockwise turns map n → e → s → w.
// The middle-left inlet and middle-right outlet permit either an upper or a
// lower route. Unconnected tiles do not leak, because no water reaches them.
export const CHANNEL_TILES = freeze(Array.from({ length: 9 }, (_, index) => ({
  id: `channel-${index}`,
  kind: [1, 4, 7].includes(index) ? 'straight' : 'elbow',
  ports: [1, 4, 7].includes(index) ? ['n', 's'] : ['n', 'e'],
})));
export const DEFAULT_CHANNEL_TURNS = freeze([1, 0, 2, 2, 0, 0, 3, 1, 3]);
const DIRECTIONS = ['n', 'e', 's', 'w'];
export const NEIGHBORHOOD_LIMITS = freeze({ name: 28, plays: 1_000_000 });
const PET_NAME_LIMIT = NEIGHBORHOOD_LIMITS.name;
const PLAY_LIMIT = NEIGHBORHOOD_LIMITS.plays;
const SLOT_IDS = DECOR_SLOTS.map(slot => slot.id);
const ITEM_IDS = DECOR_ITEMS.map(item => item.id);
const COLOR_IDS = PET_COLORS.map(color => color.id);
const ACCESSORY_IDS = PET_ACCESSORIES.map(accessory => accessory.id);
const dangerousKeys = new Set(['__proto__', 'prototype', 'constructor']);

function fail(message) { throw new Error(message); }
function record(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(`${label} must be an object.`);
  for (const key of Object.keys(value)) if (!keys.includes(key) || dangerousKeys.has(key)) fail(`${label} contains unsupported field “${key}”.`);
  for (const key of keys) if (!Object.hasOwn(value, key)) fail(`${label} is missing “${key}”.`);
}
function integer(value, minimum, maximum, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail(`${label} must be an integer from ${minimum} to ${maximum}.`);
  return value;
}
function choice(value, values, label) {
  if (!values.includes(value)) fail(`${label} is not supported.`);
  return value;
}
function coordinate(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) fail(`${label} must be a finite position between 0 and 1.`);
  return value;
}
function petName(value) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || [...value].length > PET_NAME_LIMIT || /[\p{Cc}\p{Cf}]/u.test(value)) fail(`Companion name must be readable text of 1–${PET_NAME_LIMIT} characters, without surrounding spaces.`);
  return value;
}
function turnsList(value) {
  if (!Array.isArray(value) || value.length !== 9 || Object.keys(value).length !== 9) fail('Channel turns must contain exactly nine rotations.');
  return Array.from({ length: 9 }, (_, index) => integer(value[index], 0, 3, 'Channel rotation'));
}

export function defaultNeighborhood() {
  return freeze({
    version: 1,
    items: {},
    companion: { name: 'Pip', color: 'amber', accessory: 'none', tosses: 0, lastPlay: null },
    channelTurns: [...DEFAULT_CHANNEL_TURNS],
    visited: false,
  });
}

/** Validate the entire candidate before a caller can replace an existing state. */
export function validateNeighborhood(value) {
  record(value, ['version', 'items', 'companion', 'channelTurns', 'visited'], 'Courtyard');
  if (value.version !== 1) fail('Unsupported courtyard version.');
  if (typeof value.visited !== 'boolean') fail('Courtyard visit must be true or false.');
  if (!value.items || typeof value.items !== 'object' || Array.isArray(value.items) || ![Object.prototype, null].includes(Object.getPrototypeOf(value.items))) fail('Courtyard items must be a placement map.');
  const slots = Object.keys(value.items);
  if (slots.length > SLOT_IDS.length) fail('Courtyard contains too many furnishings.');
  for (const slotId of slots) choice(slotId, SLOT_IDS, 'Courtyard slot');
  const items = {};
  for (const slotId of SLOT_IDS) {
    if (!Object.hasOwn(value.items, slotId)) continue;
    const item = value.items[slotId];
    record(item, ['itemId', 'rotation'], 'Courtyard furnishing');
    items[slotId] = { itemId: choice(item.itemId, ITEM_IDS, 'Furnishing'), rotation: integer(item.rotation, 0, 3, 'Furnishing rotation') };
  }
  const pet = value.companion;
  record(pet, ['name', 'color', 'accessory', 'tosses', 'lastPlay'], 'Companion');
  const tosses = integer(pet.tosses, 0, PLAY_LIMIT, 'Companion throws');
  let lastPlay = null;
  if (pet.lastPlay !== null) {
    record(pet.lastPlay, ['id', 'x', 'y', 'kind'], 'Companion play');
    const id = integer(pet.lastPlay.id, 1, PLAY_LIMIT, 'Companion play identity');
    if (id !== tosses) fail('Companion play identity must match its throw count.');
    lastPlay = { id, x: coordinate(pet.lastPlay.x, 'Throw x'), y: coordinate(pet.lastPlay.y, 'Throw y'), kind: choice(pet.lastPlay.kind, ['fetch'], 'Companion play kind') };
  } else if (tosses !== 0) fail('A companion with recorded throws must retain its last play.');
  return freeze({
    version: 1,
    items,
    companion: { name: petName(pet.name), color: choice(pet.color, COLOR_IDS, 'Companion color'), accessory: choice(pet.accessory, ACCESSORY_IDS, 'Companion accessory'), tosses, lastPlay },
    channelTurns: turnsList(value.channelTurns),
    visited: value.visited,
  });
}

/** Immutable metadata actions never advance a day, create an event or repair habitat. */
export function reduceNeighborhood(value, action) {
  const source = validateNeighborhood(value);
  if (!action || typeof action !== 'object') fail('Choose a courtyard activity.');
  const next = { ...source, items: { ...source.items }, companion: { ...source.companion }, channelTurns: [...source.channelTurns] };
  switch (action.type) {
    case 'place':
      record(action, ['type', 'slotId', 'itemId'], 'Place action');
      choice(action.slotId, SLOT_IDS, 'Courtyard slot');
      next.items[action.slotId] = { itemId: choice(action.itemId, ITEM_IDS, 'Furnishing'), rotation: 0 };
      break;
    case 'remove':
      record(action, ['type', 'slotId'], 'Remove action');
      choice(action.slotId, SLOT_IDS, 'Courtyard slot');
      delete next.items[action.slotId];
      break;
    case 'rotate': {
      record(action, ['type', 'slotId'], 'Rotate action');
      choice(action.slotId, SLOT_IDS, 'Courtyard slot');
      const item = source.items[action.slotId];
      if (!item) fail('Place a furnishing before rotating it.');
      next.items[action.slotId] = { ...item, rotation: (item.rotation + 1) % 4 };
      break;
    }
    case 'move': {
      record(action, ['type', 'fromSlotId', 'toSlotId'], 'Move action');
      choice(action.fromSlotId, SLOT_IDS, 'Source slot');
      choice(action.toSlotId, SLOT_IDS, 'Destination slot');
      const item = source.items[action.fromSlotId];
      if (!item) fail('Choose a furnishing before moving it.');
      const displaced = source.items[action.toSlotId];
      next.items[action.toSlotId] = item;
      if (displaced) next.items[action.fromSlotId] = displaced;
      else delete next.items[action.fromSlotId];
      break;
    }
    case 'name':
      record(action, ['type', 'name'], 'Name action');
      next.companion.name = petName(action.name);
      break;
    case 'pet-color':
      record(action, ['type', 'color'], 'Companion color action');
      next.companion.color = choice(action.color, COLOR_IDS, 'Companion color');
      break;
    case 'pet-accessory':
      record(action, ['type', 'accessory'], 'Companion accessory action');
      next.companion.accessory = choice(action.accessory, ACCESSORY_IDS, 'Companion accessory');
      break;
    case 'toss': {
      record(action, ['type', 'x', 'y'], 'Throw action');
      const id = integer(source.companion.tosses + 1, 1, PLAY_LIMIT, 'Companion throws');
      next.companion.tosses = id;
      next.companion.lastPlay = { id, x: coordinate(action.x, 'Throw x'), y: coordinate(action.y, 'Throw y'), kind: 'fetch' };
      break;
    }
    case 'channel-turn': {
      record(action, ['type', 'index'], 'Channel action');
      const index = integer(action.index, 0, 8, 'Channel tile');
      next.channelTurns[index] = (next.channelTurns[index] + 1) % 4;
      break;
    }
    case 'visit':
      record(action, ['type'], 'Visit action');
      next.visited = true;
      break;
    default:
      fail('That courtyard activity is not supported.');
  }
  return validateNeighborhood(next);
}

export function channelPorts(index, turns) {
  integer(index, 0, 8, 'Channel tile');
  const rotations = turnsList(turns);
  return CHANNEL_TILES[index].ports.map(direction => DIRECTIONS[(DIRECTIONS.indexOf(direction) + rotations[index]) % 4]);
}

/** Trace only reciprocal connections carrying source water; reaching the exit alone is insufficient if water leaks. */
export function channelFlow(turns) {
  const rotations = turnsList(turns);
  const ports = CHANNEL_TILES.map((tile, index) => tile.ports.map(direction => DIRECTIONS[(DIRECTIONS.indexOf(direction) + rotations[index]) % 4]));
  if (!ports[3].includes('w')) return { connected: false, wetCells: [], leaks: [{ index: 3, direction: 'w' }] };
  const wet = new Set([3]), pending = [3], leaks = [];
  let reachedOutlet = false;
  while (pending.length) {
    const index = pending.shift(), row = Math.floor(index / 3), column = index % 3;
    for (const direction of ports[index]) {
      if (index === 3 && direction === 'w') continue;
      if (index === 5 && direction === 'e') { reachedOutlet = true; continue; }
      const targetRow = row + (direction === 'n' ? -1 : direction === 's' ? 1 : 0);
      const targetColumn = column + (direction === 'w' ? -1 : direction === 'e' ? 1 : 0);
      const target = targetRow * 3 + targetColumn;
      const opposite = DIRECTIONS[(DIRECTIONS.indexOf(direction) + 2) % 4];
      if (targetRow < 0 || targetRow > 2 || targetColumn < 0 || targetColumn > 2 || !ports[target].includes(opposite)) {
        leaks.push({ index, direction });
      } else if (!wet.has(target)) {
        wet.add(target);
        pending.push(target);
      }
    }
  }
  return { connected: reachedOutlet && leaks.length === 0, wetCells: [...wet].sort((left, right) => left - right), leaks };
}
