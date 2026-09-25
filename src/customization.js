/** Presentation-only vocabulary. These tokens never enter simulation state. */
export const STYLE_COLORS = Object.freeze([
  { id: 'amber', label: 'Amber', coat: '#dba768', shade: '#8e603d', accent: '#f5d795', trim: '#e8d6b8' },
  { id: 'jade', label: 'Jade', coat: '#78b79c', shade: '#436c61', accent: '#bce3bb', trim: '#e2dfb8' },
  { id: 'sky', label: 'Sky', coat: '#79b7d1', shade: '#416c85', accent: '#bfeafa', trim: '#d9dce7' },
  { id: 'rose', label: 'Rose', coat: '#ce9199', shade: '#804e64', accent: '#f1c0b3', trim: '#efdcbb' },
  { id: 'lilac', label: 'Lilac', coat: '#aa95ca', shade: '#61527f', accent: '#d5c4ed', trim: '#e8d4c4' },
  { id: 'ivory', label: 'Ivory', coat: '#ddd3b5', shade: '#918772', accent: '#f2ead1', trim: '#aabfca' },
].map(color => Object.freeze(color)));

export const STYLE_COLOR_IDS = Object.freeze(STYLE_COLORS.map(color => color.id));
export const HOME_DECORATIONS = Object.freeze([
  { id: 'none', label: 'None' },
  { id: 'planter', label: 'Planter' },
  { id: 'lantern', label: 'Lantern' },
  { id: 'bunting', label: 'Bunting' },
].map(decoration => Object.freeze(decoration)));
export const HOME_DECORATION_IDS = Object.freeze(HOME_DECORATIONS.map(decoration => decoration.id));
export const GUIDE_STEP_IDS = Object.freeze(['meet', 'style', 'watch', 'why', 'possibility', 'branch']);
export const PERSONALIZATION_LIMITS = Object.freeze({ people: 32, homes: 128 });

/** Missing, original, or unknown colors resolve to the renderer's own palette. */
export function resolveStyleColor(token) {
  return STYLE_COLORS.find(color => color.id === token) ?? null;
}
