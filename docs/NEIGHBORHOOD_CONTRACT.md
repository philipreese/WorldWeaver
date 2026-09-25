# Hands-on neighborhood implementation contract

Issue #8 first increment. One close-up Hearth courtyard connects furnishing, a player companion and a real habitat intervention. Browser-native Canvas 2D and semantic HTML; no runtime dependencies. This document records the implemented interfaces and their boundaries.

## State and meaning

Keep simulation engine versions unchanged. Furnishings and the player's visiting companion are optional, archive-wide metadata, like existing appearance choices. They travel with the player between tellings; they are not resident population, resources, births or settlement events. Label this accurately and do not expose player-wide counters as historical-world statistics. Historical views cannot perform activities. Restore the spring through the existing `applyCommand(..., {type:'intervene', intervention:{kind:'restore-habitat',targetId:'s-hearth'}})` path; record the actual world event and respect intervention availability. No new named story milestones.

`src/neighborhood.js` exports:

- `DECOR_ITEMS`: bounded array `{id, label}` for at least eight distinctive furnishings (bench, planter, lantern, rug, cushions, birdbath, pet bed, wind chime). IDs are stable.
- `DECOR_SLOTS`: six positions `{id,label,x,y}` in canonical 1000×760 scene coordinates. Agree exact positions with the scene agent.
- `PET_COLORS`, `PET_ACCESSORIES`: arrays `{id,label,...}`. Companion is an original small glimmerfox named Pip by default.
- `CHANNEL_TILES`: a 3×3 board of tile definitions; `DEFAULT_CHANNEL_TURNS`; `channelFlow(turns)` returns `{connected, wetCells, leaks}`. Entry is west of cell 3, exit east of cell 5. Rotation is clockwise; fixed source/outlet. Use genuine connected-path rules, not a click counter. Supply a solvable opening with a short solution and at least one alternate valid route if practical.
- `defaultNeighborhood()` => `{version:1, items:{[slotId]:{itemId,rotation}}, companion:{name,color,accessory,tosses,lastPlay}, channelTurns:[nine integers], visited:boolean}`. `lastPlay` is null or `{id,x,y,kind:'fetch'}`. Toss positions are normalized lawn coordinates in [0,1]. Presentation interpolates the deterministic fetch response; wall-clock time never changes world history or a saved outcome.
- `validateNeighborhood(value)` => validated clean copy, rejects unsupported fields/identities, invalid names, bad rotations/nonfinite numbers and excessive data. Fail before replacing valid state.
- `reduceNeighborhood(value, action)` => immutable validated copy. Actions: `{type:'place',slotId,itemId}`, `{type:'remove',slotId}`, `{type:'rotate',slotId}`, `{type:'move',fromSlotId,toSlotId}` (swap occupied slots), `{type:'name',name}`, `{type:'pet-color',color}`, `{type:'pet-accessory',accessory}`, `{type:'toss',x,y}`, `{type:'channel-turn',index}`, `{type:'visit'}`.

History exports `getNeighborhood(history)` (defaults without attaching metadata) and `setNeighborhood(history, action)`. Round-trip optional `neighborhood` in validated saves and retain it across branches. Existing files without it replay identically. Storage failures remain accurately reported. No separate storage service.

Extend person styles with optional `accessory` and export `PERSON_ACCESSORIES` plus `setPersonAccessory(history,id,accessory)` for at least none/cap/scarf/flower. Existing color changes preserve accessories. Keep old unmodified exports valid. Lead adds portrait controls; scene agent may add matching original-world visuals.

## Scene

`export class NeighborhoodView` in `src/view/neighborhood-view.js`:

- `constructor(canvas,{onSelect}={})`.
- `setState({world, neighborhood, mode, selectedItemId, selectedSlotId, historical, waterRunning, reducedMotion})`.
- `setVisible(bool)` and `destroy()`.
- `onSelect` emits `{type:'slot',slotId}`, `{type:'pet'}`, `{type:'lawn',x,y}` (normalized), `{type:'channel',index}`, or `{type:'house'}`. UI interprets modes.

Modes: `welcome`, `decorate`, `companion`, `water`. Render a beautiful warm isometric courtyard: tactile amber home, lanterns, layered plants, distant ruins, running water when the world supports it, and an expressive glimmerfox. Camera framing may change by mode so touch targets remain usable. Canvas hit targets account for CSS size, DPR and resizing; support pointer/touch tap without requiring drag. Object placement is visible in the actual scene. Companion fetch is repeatable and animated, with immediate reduced-motion results. Cap DPR and suspend hidden animation. The renderer never changes save or simulation state. Do not draw named inhabitants at invented locations.

## Interaction surface

`export class NeighborhoodUI` in `src/neighborhood-ui.js`:

- `constructor(container,{onAction,onRestore,onExit,onPersonStyle,onAdvance,onInspect}={})`: creates semantic controls and its own Canvas/NeighborhoodView. Canvas ID `neighborhood-canvas`.
- `update({world, neighborhood, historical, restoration, saveOk, reducedMotion})`. `restoration` is the current restore-habitat intervention `{available,reason,...}`. Current water comes from `world.flags.habitatRestored`, not saved puzzle preview.
- `show(mode='welcome')`, `hide()`, `isVisible()` and `destroy()`.

The UI invokes `onAction(action)` for metadata changes, `onRestore()` only when the board connects and restoration is available, `onExit()` to explore the larger basin, `onPersonStyle()` for existing character customization, `onAdvance()` for one day, `onInspect()` for the real spring record. Callbacks return `{ok:boolean,error?:string}` where relevant. Failed saving must not show a saved confirmation. Use a clear brief opening and three activity choices, not a compulsory wizard. Keep time controls out of the main activity bar; explain once that activities do not advance the world's days. Offer optional next-day after water repair to see the wider response.

Provide tap-based inventory and placement/move/rotation controls, a name input plus pet color/accessory choices and throw action, and a reachable channel board with DOM keyboard alternatives. Rotate actual scene tiles; preview water follows connectivity. An explicit open-water button commits the real intervention; inspecting a solved board or loading an old world never triggers a command. Already-restored gardens stay working and do not demand repeat repair. All controls at least 44 CSS px, responsive portrait/landscape, reduced motion, clear focus and accessible names. Escape leaves an activity or returns to world; do not trap players behind onboarding.

Lead mounts this surface in `#world-shell`, defaults the first visit to it, and keeps an always-reachable Courtyard button. Hide competing world panels while visible; advanced exploration remains one action away. The top-level save indicator and settings/export remain accessible. Close the surface before entering history. Preserve existing guide and app handlers.

## Content organization

The current bounded catalogs are JavaScript exports. A future content pass can move furnishing, palette, companion and starting-world definitions into validated JSON, with illustrations and audio stored as separate assets. Simulation, connectivity, interaction and rendering remain code. Preserve stable IDs and validate source data before a build; changing file organization must not change saved outcomes or replay fingerprints.

## Compatibility details

The courtyard house projects the valid `k-hearth-table` home trim. A restored world with no matching connected preview board displays an installed working path without changing player metadata. Loading a prior throw displays its completed outcome rather than replaying the interaction. Both scene renderers stop scheduling animation while hidden.

## Optional Three.js comparison

The same `NeighborhoodUI` accepts an injected `ViewClass` and `viewOptions`. The optional 3D renderer receives validated JSON scene assets and the existing projection state. It implements the same selection events and visibility lifecycle, plus `resetCamera()`. A failed custom renderer gets a fresh canvas before the original 2D view is constructed. Comparison navigation uses the same tab and is blocked while choices are unsaved. See [the test guide](THREE_COURTYARD_TEST.md).
