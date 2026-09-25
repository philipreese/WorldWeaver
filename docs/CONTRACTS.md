# Shared implementation contract

The build brief is authoritative. Plain JavaScript ES modules, Canvas 2D world, semantic HTML controls, no runtime dependencies or services. Node 22+ build/server/test scripts. Stable IDs and one integer simulation clock; one tick represents a day (24 simulated hours). No wall-clock input to simulation. Start with Tier 1 and only enable Tier 2 after the integrated gate.

## World and records

`createWorld({engineVersion='2.0.0', seed=8417, tier=1, climate='temperate', temperament='careful', density='balanced'}={})` returns JSON-only World. `advance(world, days=1)` and `intervene(world, command)` return a NEW world without mutating input. `getInterventions(world)` returns `{id, kind, targetId, title, description, available, reason}` records, including disabled alternatives. Commands are `{kind:'open-route'|'reveal-relic'|'restore-habitat'|'offer-refuge', targetId:string}`. Invalid commands throw before mutation. `entityLabel(world,id)` handles every entity type. `getEntity(world,id)` returns an entity or null.

World fields: `version:'1.0.0'|'2.0.0'`, `seed`, `rng` (uint32), `tick`, `tier`, `config`, `regions`, `settlements`, `characters`, `routes`, `cultures`, `institutions`, `power` (null or object), `events`, `threads`, `flags`.

- Region: `{id,name,x,y,color,description}`; world coordinates approx x=0..1200, y=0..800.
- Settlement: `{id,name,regionId,x,y,habitat,energy,materials,food,population,synthetics,collective,knowledge,cultureId,institutionId,structures}`. Resources/habitat 0..100; populations nonnegative. `structures`: `{id,name,kind,x,y,builtAt,eventId,abandonedAt?}`; x/y are LOCAL coordinates about -150..150; kinds `home,archive,garden,workshop,spire,bridge,ruin,conduit,nest,memorial`. Abandoned structures persist.
- Character: `{id,name,role,settlementId,x,y,activity,motives:{care,curiosity,duty},commitment,relationships:[{otherId,label,strength}],knowledge:[eventId],memories:[eventId],alive,bornAt,description}`. Positions LOCAL to settlement, updated by simulation. Renderer can interpolate but never invent modeled claims.
- Route: `{id,from,to,open,terrain,history:[eventId]}`.
- Culture: `{id,name,settlementIds,practice,interpretation}`.
- Institution: `{id,name,settlementId,members:[entityId],status:'active'|'changed'|'collapsed',practice,history:[eventId]}`.
- Power: `{id,name,settlementId,emergedAt,eventId,active,strength,interpretations:[{cultureId,text}],lastActAt}`.
- Thread: `{id,title,summary,entityIds,status:'open'|'resolved',eventId}`.
- Event: `{id,tick,kind,category:'personal'|'cultural'|'infrastructural'|'civilizational',title,text,entities:[entityId],settlementId,severity:1|2|3,causes:[eventId],observed:[string],decision?:{actorId,known:[string],motives:[string],alternatives:[{id,label,available,reason}],chosen:string},interpretations:[{cultureId,text}],family?:'relationships'|'discovery'|'obligations'|'institution'|'contact'|'recovery'}`.

Every event claim must describe actual state transition, with recorded decision-time facts and references. Explanations use `observed`, `decision`, and `interpretations` as separately labeled layers. No text claims an unrecorded event. Opening lore is labeled lore. Initial structures point to real founding events at tick 0. Opening dilemma happens early (day 3–5); route intervention changes alternatives. Six recurring characters minimum. Tier 1 one form only.

Simulation exports from `src/sim/world.js`: createWorld, advance, intervene, getInterventions, getEntity, entityLabel. Narrative helper module optional, owned by simulation agent. Deterministic scenes are brief and resolve against state.

## History and persistence

Exports `src/persistence/history.js`:
- `createHistory(config={}, simulationVersion='2.0.0')` => `{format:'worldweaver',saveVersion:1,simulationVersion:'2.0.0',activeBranchId:'b1',nextBranchId:2,branches:[{id,name,parentId:null,forkTick:0,commands:[],checkpoints:[{commandIndex:0,world}],head:world}],followed:['s-hearth','c-nera'],attention:'balanced',session:{lastSeenTick:0}}`.
- `currentWorld(history)` => active branch head.
- `applyCommand(history, command)` immutable, commands are `{type:'advance',days}` or `{type:'intervene',intervention}`; branch command entry `{atTick,command}`. Max bounded history (e.g. 6000 ticks, 1200 commands, 8 branches), throws actionable export-first message at limits; no silent trim.
- `worldAt(history,tick,branchId=active)` reconstructs state at integer tick, including interventions at that tick. Read-only view enforced by UI. Checkpoints every 20 commands.
- `forkHistory(history,tick,name)` branches from tick with independent history, preserves source; `selectBranch(history,id)`.
- `serializeHistory(history)` string; `parseHistory(text)` fully validates structural bounds, versions, finite values, IDs/references, and deterministic consistency before accepting. Must reject invalid/malicious/implausible saves, prototype properties and excessive payloads. No eval. Don't trust imported head/checkpoints over replay.
- `saveHistory(storage,history)` => `{ok:true}` or `{ok:false,error}`; `loadHistory(storage)` => `{history:null|History,error:null|string}`. Staged/verified write preserves previous valid slot on quota/error, recovery drills. UI always pauses on reload.

## World renderer

`src/view/world-view.js`: `export class WorldView { constructor(canvas,{onSelect,onScaleChange}={}); setWorld(world); select(entityId); focus(entityId,scale='settlement'); overview(); setScale('region'|'settlement'|'neighborhood'); zoomBy(factor); pan(dx,dy); setQuality('auto'|'low'|'high'); setReducedMotion(bool); destroy(); }`.
Callbacks `onSelect(entityId)`; `onScaleChange(scale)`. `setWorld` accepts current or historical snapshot. Region/settlement/neighborhood visually distinct smooth zoom, touch drag/pinch and click, keyboard optional. World state never advances during rendering. Use device DPR cap and frame scheduling. `focus(character,'neighborhood')` tracks actual activity, but player can pan to disengage. Accessible DOM alternative provided by lead.

Visual identity: THE QUIET BASIN. Ink-blue atmospheric landscape, luminous amber habitation, jade collective ecologies, icy cyan synthetic structures, enormous ancient crescent/ring ruins; warm off-white typography; thin desaturated teal borders. An observatory field journal, not a dashboard grid. Original, tactile, stylized isometric illustration. Regions Reed Basin (southwest), Glass Reach (east), Ash Fold (north). Hearth (s-hearth) at (420,470), Lattice (s-lattice) at (840,360), Choir (s-choir) at (580,200), remote abandoned trace at (190,280). Names may be expanded but keep these IDs/coordinates for UI.

## Director

`src/director.js` exports `shouldStop(event,followed,attention='balanced')` (follow-linked entities + severity; quiet=3, balanced=2, attentive=1), `makeDigest(world,followed,lastSeenTick)` => `{title,summary,events,threads}`, and `relatedEvents(world,entityId)`.

Lead owns app.js, index.html, CSS, audio, build scripts and integration. Simulation agent owns src/sim/**. Persistence agent owns src/persistence/** and tests/history.test.js. Renderer agent owns src/view/**. Director/narrative-review agent owns src/director.js, tests/director.test.js, and docs/PLAYER_GUIDE.md (coordinate questions; do not duplicate simulation).


Engine dispatch is mandatory for all world operations. The byte-preserved original modules in `src/sim/legacy/` serve version 1.0.0 histories. Version 2.0.0 adds `world.ecology`, settlement ecology and optional event `evidence`; the same immutable command/replay contract applies. See [recorded data](DATA_MODEL.md) for ledger scope and [simulation correction](SIMULATION_CORRECTION.md) for remaining limitations.
