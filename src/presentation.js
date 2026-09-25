// Presentation only: these hooks paraphrase the cast's authored descriptions.
// They never add events, thoughts, or decisions to the simulation's history.
import { resolveStyleColor } from './customization.js';

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
export function characterPortrait(person, style) {
  const original = cast[person.id] || cast["c-lio"];
  const color = resolveStyleColor(style?.color);
  const p = color ? { ...original, coat: color.coat } : original;
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
  if (id === "c-senn" && style?.accessory !== 'cap')
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
  const scarf = ["c-ves", "c-daro", "c-mira"].includes(id) || style?.accessory === 'scarf'
    ? `<path d="M30 67Q48 80 67 67L64 80L51 77L61 96H48L39 77L32 79Z" fill="${color?.accent || (id === "c-ves" ? "#56699a" : id === "c-daro" ? "#e7bd75" : "#d4dfc1")}"/>`
    : "";
  const accessory = style?.accessory === 'cap'
    ? '<g data-portrait-accessory="cap"><path d="M24 29Q27 9 48 9Q69 9 72 29Z" fill="#6fa89b" stroke="#ccdcba" stroke-width="1.5"/><path d="M23 27Q49 33 78 26L80 32Q51 41 23 33Z" fill="#42796d" stroke="#a9c9a0" stroke-width="1.5"/><path d="M49 11V27" stroke="#a9c9a0" stroke-width="1.3"/></g>'
    : style?.accessory === 'flower'
      ? '<g data-portrait-accessory="flower"><path d="M65 29Q80 27 77 16" fill="none" stroke="#b2ce94" stroke-width="3"/><ellipse cx="77" cy="28" rx="8" ry="3.5" fill="#83b395" transform="rotate(-32 77 28)"/><g fill="#e6aac3" stroke="#f7d6c6" stroke-width="1"><ellipse cx="69" cy="16" rx="4" ry="8"/><ellipse cx="69" cy="16" rx="8" ry="4" transform="rotate(35 69 16)"/><ellipse cx="69" cy="16" rx="8" ry="4" transform="rotate(-35 69 16)"/></g><circle cx="69" cy="16" r="3.5" fill="#ffe0a0"/></g>'
      : '';
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
  return `<svg class="character-portrait" viewBox="0 0 96 100" aria-hidden="true" focusable="false"><circle cx="48" cy="48" r="45" fill="#294549"/><circle cx="48" cy="48" r="43" fill="none" stroke="${p.coat}" stroke-opacity=".4"/><path d="M14 99Q14 68 37 65H59Q83 67 84 99Z" fill="${p.coat}"/><path d="M41 57H56V70Q49 78 41 70Z" fill="${p.skin}"/><ellipse cx="28" cy="44" rx="4" ry="6" fill="${p.skin}"/><ellipse cx="68" cy="44" rx="4" ry="6" fill="${p.skin}"/><ellipse cx="48" cy="43" rx="21" ry="25" fill="${p.skin}"/>${hair}${accessory}<path d="M33 36Q39 33 43 36M53 36Q58 33 63 36" fill="none" stroke="${p.hair}" stroke-width="2" stroke-linecap="round"/><ellipse cx="39" cy="44" rx="2.2" ry="3" fill="#283139"/><ellipse cx="58" cy="44" rx="2.2" ry="3" fill="#283139"/><path d="M48 44L46 51H50" fill="none" stroke="#87594e" stroke-width="1.6" stroke-linecap="round"/>${beard}<path d="M41 56Q49 ${id === "c-oren" ? 58 : 64} 57 56" fill="none" stroke="#614542" stroke-width="2" stroke-linecap="round"/>${glasses}${scarf}${prop}</svg>`;
}

/** A safe, compact preview of the same optional woodwork and doorstep cosmetics
 * used by the world renderer. All injected colors come from the fixed palette. */
export function homeStylePreview(home, style) {
  if(home?.kind!=='home')return '';
  const color=resolveStyleColor(style?.color),trim=color?.coat||'#d8b27b',accent=color?.accent||'#f1d6a0';
  const abandoned=home.abandonedAt!=null;
  const window=abandoned?'#243b3f':'#ffe0a0';
  let decoration='';
  if(style?.decoration==='planter'){
    decoration=`<path d="M0 9L6 5.5L12 9V14L6 17.5L0 14Z" fill="${trim}" stroke="${accent}" stroke-width=".6"/><path d="M0 9L6 12.5L12 9L6 5.5Z" fill="${accent}"/><ellipse cx="6" cy="9" rx="5" ry="2.3" fill="#48644e"/>`;
    for(const [x,y]of [[2,4],[6,1],[10,4]])decoration+=`<path d="M${x} 9V${y}" stroke="#a1c98b" stroke-width=".7"/><ellipse cx="${x-1}" cy="${y+2}" rx="1.8" ry=".7" fill="#b5d799"/><g fill="${trim}"><ellipse cx="${x-1.2}" cy="${y}" rx="1.2" ry="1"/><ellipse cx="${x+1.2}" cy="${y}" rx="1.2" ry="1"/><ellipse cx="${x}" cy="${y-.9}" rx="1.2" ry="1"/><ellipse cx="${x}" cy="${y+.9}" rx="1.2" ry="1"/></g><ellipse cx="${x}" cy="${y}" rx=".65" ry=".55" fill="${accent}"/>`;
  }
  if(style?.decoration==='lantern')decoration=`<path d="M-12 6V-17Q-17-21-17-15" fill="none" stroke="${trim}" stroke-width=".85"/>${abandoned?'':'<ellipse cx="-17" cy="-10" rx="10" ry="8" fill="#ffe3a1" opacity=".12"/>'}<path d="M-20-13L-17-15L-14-13V-8L-17-6L-20-8Z" fill="${abandoned?'#6a7a70':'#ffdda0'}" stroke="${trim}" stroke-width=".7"/><path d="M-17-14V-7M-20-12.5H-14M-20-8.5H-14" stroke="${trim}" stroke-width=".55"/>`;
  if(style?.decoration==='bunting'){
    decoration='<path d="M-17-21Q-7-11 0-14Q8-12 17-21" fill="none" stroke="#ddd3b5" stroke-width=".65"/>';
    for(const [i,x,y]of [[0,-14,-18.6],[1,-8,-15.2],[2,-2,-14],[3,5,-14.5],[4,11,-16.6]])decoration+=`<path d="M${x-1.9} ${y}L${x+1.9} ${y-.1}L${x+.2} ${y+4.4}Z" fill="${i%2?accent:trim}" stroke="#f2e1b7" stroke-opacity=".35" stroke-width=".3"/>`;
  }
  const paint=color?`<path d="M-13-9L-4-4V-7L-13-12Z" fill="${trim}" stroke="${accent}" stroke-width=".5"/><path d="M-8.8 5.5V-8L-2.3-4.2V8.5M2-10.3L13.7-16.3M-17-23L0-14L17-23" fill="none" stroke="${trim}" stroke-width="1.4" stroke-linejoin="round"/>`:'';
  return `<svg class="home-style-preview" viewBox="0 0 180 138" aria-hidden="true" focusable="false"><rect x="1" y="1" width="178" height="136" rx="16" fill="#19353e"/><ellipse cx="93" cy="112" rx="67" ry="18" fill="#294b49"/><g transform="translate(90 101) scale(2.35)" stroke-linejoin="round"><ellipse cx="8" cy="8" rx="25" ry="10" fill="#061820" opacity=".4"/><path d="M-15.5-22L0-12V10L-15.5 0Z" fill="${abandoned?'#42575a':'#7b7562'}" stroke="#ead4a8" stroke-opacity=".55" stroke-width=".5"/><path d="M0-12L15.5-22V0L0 10Z" fill="${abandoned?'#2d444b':'#44575a'}" stroke="#ead4a8" stroke-opacity=".55" stroke-width=".5"/><path d="M-18-23L0-35L18-23L0-14Z" fill="${abandoned?'#647373':'#a69876'}" stroke="#ead4a8" stroke-opacity=".55" stroke-width=".8"/><path d="M18-23L0-35V-14Z" fill="${abandoned?'#3c5558':'#7b8068'}" stroke="#ead4a8" stroke-opacity=".45" stroke-width=".5"/><path d="M-8-7L-3-4V8L-8 5Z" fill="${abandoned?'#20373e':'#d8b27b'}"/><path d="M4-12L6.6-13.4V-9L4-7.6ZM7.8-13.4L10.4-14.8V-10.4L7.8-9ZM11.6-14.8L14.2-16.2V-11.8L11.6-10.4Z" fill="${window}"/><path d="M-20 5L-15 2L-10 5V10L-15 13L-20 10Z" fill="#778473" stroke="#c5c9a0" stroke-width=".5"/><ellipse cx="-15" cy="4" rx="4" ry="2" fill="#8daf7f"/><path d="M-13 3V-6" stroke="#9ca68a" stroke-width=".6"/><ellipse cx="-13" cy="-7" rx="3" ry="1.7" fill="#bac794"/><path d="M-13-9L-4-4V-7L-13-12Z" fill="#b69b70" stroke="#e6caa7" stroke-width=".4"/><g${abandoned?' opacity=".38"':''}>${paint}${decoration}</g></g></svg>`;
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
