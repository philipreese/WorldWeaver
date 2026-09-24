# Recorded data and statistics

The simulation and command history are the source of truth. `src/stats.js` adds a read-only view of existing records; it creates no saved fields, timers, telemetry, RPG levels, or additional simulation systems. Calling statistics cannot change a save or advance time.

## Canonical records

| Record | Data already retained | Meaning and limits |
| --- | --- | --- |
| World | Simulation version, seed, deterministic RNG, integer day, creation settings | One clock. No elapsed wall-clock simulation. A tick is one day. |
| Place | Stable identity, region, coordinates, habitat, food, energy, materials, knowledge score, populations by form, culture, institution, structures | Synthetic bodies and collective nodes are different counting units; they are never added to organic residents as a fictitious population total. Resource stocks and knowledge scores use game model units. |
| Structure | Stable identity, kind, location, construction day, founding event, optional abandonment day and form | Ruins and abandoned structures persist. A ruin is not automatically an abandoned building; an ancient trace can already exist at the founding survey. |
| Character | Stable identity, birth/death days, role, location, activity target, care/curiosity/duty, commitments, directed relationship records, known events, personal memories | Focal characters are part of the aggregate population, not extra residents. A memory refers to an actual recorded event. Knowledge does not imply firsthand witnessing. |
| Culture and institution | Stable identity, members/places, practices, interpretations, status, event history | Institutions may change or collapse while people, practices, and infrastructure persist. `changed` institutions can still function. |
| Event | Identity, day, category, participants, causes, observed effects, optional decision context, interpretations | Observations, recorded decisions, and cultural accounts stay distinct. Resource effects in explanation prose are not parsed back into numerical measurements. |
| Power and channel | Emergence event/day, activity, modeled strength, last response, interpretations; stored and transferred network charge | Material response counts come from actual emergence/redistribution events. Strength is a simulation variable, not a combat level or proof of consciousness. |
| Thread | Identity, referenced entities/event, open/resolved status | Existing unresolved situations; not invented player objectives. |
| History | Versioned initial settings, immutable branch heads, command logs, checkpoints, parent/fork metadata, follow list, attention setting, session day | `advance` and `intervene` commands are sufficient for reconstruction. Twenty-command checkpoints accelerate local timeline access. Forks retain their inherited prefix and preserve the source future. |

Portable saves contain initial settings, branches and command logs, head fingerprints, and player preferences. Import validates and replays every branch to rebuild checkpoints and heads; it never trusts imported snapshots. Compatibility requires save format 1, simulation 1.0.0, and exact replay fingerprints. Incompatible or changed pre-release transcripts are rejected without replacing current state. Retention is bounded to 6,000 days per branch, 1,200 commands across retained branches, eight branches, 24 follows, and a 4 MB portable file.

## Statistics DTO, version 1

`getWorldStats(world, history?)` and `getPersonStats(world, characterId)` return:

```js
{
  version: 1,
  scope: 'world', // or 'person'
  tick: 13,
  entityId: null, // stable character ID for a person
  name: 'The Quiet Basin',
  stats: [
    { id: 'time.days', label: 'Recorded history', value: 13, unit: 'days' }
  ]
}
```

Every `value` is a finite number, rounded to at most two decimal places for display; canonical data is unchanged. `unit` is optional. IDs are stable integration keys; labels are display text. The returned DTO owns its arrays and records, so consumers may format it without mutating the world. Non-character IDs return `null` from `getPersonStats`. Non-finite source values throw instead of being presented as plausible zeroes.

| Stat ID family | Meaning |
| --- | --- |
| `time`, `regions`, `settlements`, `population` | Snapshot day, recorded/occupied places, and separate organic/synthetic/collective counts |
| `characters`, `structures`, `routes`, `cultures`, `institutions`, `threads`, `events` | Counts from the supplied snapshot. World relationships count unique person pairs; memories count per-person holdings, so the same event can be remembered by several people. `structures.built` excludes day-zero structures. |
| `resources`, `knowledge` | Summed local reserves and knowledge scores; mean habitat includes every recorded place. Knowledge sums are not a count of unique discoveries. |
| `power`, `network` | Recorded power responses, current modeled state, and retained channel counters. `power.materialResponses` includes emergence and subsequent redistributions. |
| `history` | Optional archive and command information. Retained branch count is labeled as archive metadata. Other values cover only commands represented through the snapshot day; a crossing advance contributes only elapsed days. Same-day interventions also require their event to exist in the snapshot. Pass history with the snapshot's branch selected. |
| `person`, `motive`, `relationship.<otherId>.strength` | Completed years and days lived, living status (1 or 0), actual motives, known events/memories, relationships, appearances/decisions, institutional ties, and directed relationship strength |

Age uses 365 simulation days per year and stops at a recorded death day. No age is guessed for a deceased character without a death record. An appearance count means the person is named in an event, not that they performed an action. Institutional ties include historical memberships; continuing ties exclude collapsed institutions.

Historical views pass their restored snapshot directly to these functions. They never read a later world head for population, culture, power, memory, or relationship facts. The optional history argument supplies archive metadata and actual commands, not a substitute current world.

For future features, use stable entity/stat IDs and the recorded causal graph. Data that is not retained—player places visited, a list of people met, real playtime, combat skills, per-event numeric resource deltas—must not be inferred from visibility, prose, or later state. If a future feature needs new canonical measurements, add them deliberately with versioned replay and save compatibility work.

## Appearance and guide preferences

Portable save format 1 accepts two optional, separately versioned metadata fields. They never enter simulation snapshots, commands, events, or head fingerprints. Saves without them retain their previous exact serialization; older app builds will reject saves containing these new fields, so transfer to the current build.

`personalization: {version: 1, people: {id: {color}}, homes: {id: {color?, decoration}}}` uses the six allowlisted colors and four decoration choices in `src/customization.js`. Only actual character IDs and home-kind structure IDs in the retained archive are accepted, with bounded maps and strict field validation. Original colors and no decoration remove the override. Preferences apply to every branch and historical view; they are not evidence that a coat or decoration existed on a recorded day.

`guide: {version: 1, completed: [], dismissed: false}` records explicit interface actions using the six allowlisted step IDs. It is a resumable introduction, not a learning score, playtime measure, or a list of entities visited. Restarting the guide changes these preferences only. Temporary context such as a historical view or branch limit is never saved. Both fields travel through autosave, recovery and export/import; neither infers completion from a later world state.
