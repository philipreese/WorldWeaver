// Presentation only: these hooks paraphrase the cast's authored descriptions.
// They never add events, thoughts, or decisions to the simulation's history.
const cast = {
  "c-nera": {
    coat: "#d2a266",
    skin: "#d8a276",
    hair: "#403c35",
    hook: "Keeps the seeds safe. Counts plates before people.",
  },
  "c-senn": {
    coat: "#9dc58a",
    skin: "#d9af7d",
    hair: "#61523c",
    hook: "Talks to seedlings. Doesn’t trust neat rows.",
  },
  "c-ivo": {
    coat: "#cf9166",
    skin: "#cfaa89",
    hair: "#d8dcc8",
    hook: "Fixes old things. Keeps every bent nail.",
  },
  "c-tavi": {
    coat: "#83bacc",
    skin: "#bd8b66",
    hair: "#2b3d44",
    hook: "Tidy headings. Very untidy notes.",
  },
  "c-daro": {
    coat: "#d49b90",
    skin: "#a77554",
    hair: "#343e3b",
    hook: "Braids mats. Believes nobody should eat alone.",
  },
  "c-ves": {
    coat: "#e0bd68",
    skin: "#e7ba89",
    hair: "#6b4f3b",
    hook: "Learning to mend things. Never runs out of questions.",
  },
  "c-oren": {
    coat: "#93a9c9",
    skin: "#ba8d69",
    hair: "#413d36",
    hook: "Carries repair plans. Unfortunately, also bridge puns.",
  },
  "c-mira": {
    coat: "#97c8b5",
    skin: "#c49d7c",
    hair: "#314741",
    hook: "Keeps the water moving. Calls the mud “research”.",
  },
  "c-lio": {
    coat: "#dcc278",
    skin: "#cda27c",
    hair: "#594433",
    hook: "Writes repair notes on cuffs. Then washes them.",
  },
};
export function personHook(person) {
  return cast[person.id]?.hook || person.description;
}
export function characterPortrait(person) {
  const p = cast[person.id] || cast["c-lio"];
  const id = person.id;
  let hair = `<path d="M28 43Q24 15 47 15Q72 15 69 43L62 31Q49 36 36 28Z" fill="${p.hair}"/>`;
  if (id === "c-nera" || id === "c-mira")
    hair =
      `<circle cx="${id === "c-nera" ? 62 : 34}" cy="17" r="10" fill="${p.hair}"/>` +
      hair;
  if (id === "c-daro")
    hair += [29, 40, 52, 64]
      .map(
        (x, i) =>
          `<circle cx="${x}" cy="${22 + (i % 2) * 3}" r="9" fill="${p.hair}"/>`,
      )
      .join("");
  if (id === "c-senn")
    hair +=
      '<path d="M25 26L33 11H62L72 26" fill="#d8be7a"/><ellipse cx="48" cy="28" rx="37" ry="7" fill="#ead49a"/><path d="M28 23H68" stroke="#799568" stroke-width="4"/>';
  const glasses =
    id === "c-tavi"
      ? '<g fill="none" stroke="#ead6ab" stroke-width="2"><circle cx="39" cy="43" r="8"/><circle cx="58" cy="43" r="8"/><path d="M47 42H50"/></g>'
      : "";
  const beard =
    id === "c-ivo"
      ? '<path d="M30 48Q34 68 48 70Q62 67 66 48L57 53L48 50L38 53Z" fill="#d8dcc8"/>'
      : "";
  const scarf = ["c-ves", "c-daro", "c-mira"].includes(id)
    ? `<path d="M30 67Q48 80 67 67L64 80L51 77L61 96H48L39 77L32 79Z" fill="${id === "c-ves" ? "#56699a" : id === "c-daro" ? "#e7bd75" : "#d4dfc1"}"/>`
    : "";
  let prop = "";
  if (id === "c-senn" || id === "c-nera")
    prop =
      '<path d="M76 90V72" stroke="#c4df9d" stroke-width="3"/><path d="M76 82Q59 77 65 67Q80 70 76 82M77 78Q88 64 92 72Q90 81 77 78" fill="#b9d794"/>';
  if (id === "c-tavi" || id === "c-oren")
    prop =
      '<path d="M65 70L89 67V91L65 94Z" fill="#e6d8ae" stroke="#748b88" stroke-width="2"/><path d="M70 76L84 74M70 81L83 80M70 86L79 85" stroke="#81958e" stroke-width="2"/>';
  if (id === "c-ivo" || id === "c-ves" || id === "c-lio")
    prop =
      '<path d="M77 91V75M70 73H86L85 67H72Z" stroke="#e7dfc2" fill="#8da5a3" stroke-width="3" stroke-linejoin="round"/>';
  return `<svg class="character-portrait" viewBox="0 0 96 100" aria-hidden="true" focusable="false"><circle cx="48" cy="48" r="45" fill="#294549"/><circle cx="48" cy="48" r="43" fill="none" stroke="${p.coat}" stroke-opacity=".4"/><path d="M14 99Q14 68 37 65H59Q83 67 84 99Z" fill="${p.coat}"/><path d="M41 57H56V70Q49 78 41 70Z" fill="${p.skin}"/><ellipse cx="28" cy="44" rx="4" ry="6" fill="${p.skin}"/><ellipse cx="68" cy="44" rx="4" ry="6" fill="${p.skin}"/><ellipse cx="48" cy="43" rx="21" ry="25" fill="${p.skin}"/>${hair}<path d="M33 36Q39 33 43 36M53 36Q58 33 63 36" fill="none" stroke="${p.hair}" stroke-width="2" stroke-linecap="round"/><ellipse cx="39" cy="44" rx="2.2" ry="3" fill="#283139"/><ellipse cx="58" cy="44" rx="2.2" ry="3" fill="#283139"/><path d="M48 44L46 51H50" fill="none" stroke="#87594e" stroke-width="1.6" stroke-linecap="round"/>${beard}<path d="M41 56Q49 ${id === "c-oren" ? 58 : 64} 57 56" fill="none" stroke="#614542" stroke-width="2" stroke-linecap="round"/>${glasses}${scarf}${prop}</svg>`;
}

export function friendlyIntervention(option) {
  const copy = {
    "open-east": [
      "Open the path",
      "Clear the Silt Saddle so people can travel between Hearth and Lattice. Oren’s repair plans could come with them.",
    ],
    "reveal-memory": [
      "Uncover the chamber",
      "Brush away the silt at Old Hollow. Its rain chamber may hold something worth finding.",
    ],
    "restore-reed": [
      "Restore the spring",
      "Let water reach Hearth’s old garden channels. The people will decide how to use it.",
    ],
    "offer-refuge": [
      "Make room",
      "Prepare a place by the river where machine people and living roots could become neighbors.",
    ],
  }[option.id];
  return copy ? { ...option, title: copy[0], description: copy[1] } : option;
}
