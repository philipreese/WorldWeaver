# The Quiet Basin — player guide

Start with Nera. She keeps Hearth's seeds safe, counts plates before people, and has a seed room that's getting wet. Across a blocked path, Oren may know how to help.

Want a little company? Open **✦ Guide**. It offers one small action at a time in three chapters: meet the neighbors, notice what changes, and try another possibility. You can leave it, come back, or choose **Start the guide again** without losing your world. Watching is always a valid choice.

Select someone and choose **Choose a look** to try a coat color. **Make their home cozy** offers trim colors and a planter, lantern, or bunting for the doorstep. Shared homes share decorations. **Original** restores their original color; **None** removes a decoration. Your choices stay with the saved world across all its tellings and earlier days. Return to the present before changing a look.

## Your first three minutes

1. **Meet someone.** Choose **Meet Nera**, then **Walk with them**. Look around her home. Tap a building to learn its story. Time is paused, so you can take your time.
2. **Watch—or lend a hand.** Open Nera's card, choose **Lend a hand**, and find **Open the path**. Press **Try this** to clear the Silt Saddle between Hearth and Lattice. You can also leave things alone and see what Nera does.
3. **See what happens.** Press **Next moment**. The world pauses when something important happens to Nera or Hearth. Read the short scene, then visit the place to see what changed. Press **Next moment** again whenever you're ready.

Found someone you like? **Follow** keeps their big moments close. Try Ivo and Ves in the mending yard: Ivo saves bent nails, and Ves has rather a lot of questions. **Stories** offers places to start. On a phone, **Journal** opens your list of people and stories.

Curious why someone made a choice? Open their story in **History**, then **Why did this happen?** You can see what happened, what they knew, and what other choices they had. Different communities' beliefs are kept separate from what actually happened. Later, the timeline and **Branch here** let you try another future while keeping the first one.

You can stop whenever you like. Nothing happens while you're away, and the world is paused when you return.

## More controls, when you need them

| Control | Action |
| --- | --- |
| **Play** / **Space** | Allow time to run, or pause it |
| **+1 day** | Advance exactly one day, then remain paused |
| **1× / 4× / 12×** | Choose the pace of automatic days |
| **Next moment** | Advance to the selected horizon, stopping sooner for a followed event |
| **Basin / Settlement / Streets** | Switch camera scale |
| Drag / arrow keys | Move the camera |
| Pinch / **+ / −** | Zoom |
| Overview icon / **0** | Recover the basin overview |
| Timeline slider | Explore a recorded day without changing its history |
| **Return to present** | Leave a historical view |
| **Branch here** | Continue from the viewed day and retain the original future |
| **Escape** | Close inspection and the mobile journal |
| Sound icon | Enable or mute sound; volume is in settings |

In **World settings → Time, motion & picture settings → How far can Next moment go?**, choose how far ahead to look: 7, 14, or 30 days. The default is 14. **When should time stop?** lets you choose big turning points, meaningful changes, or small moments too. The people and places you follow decide which stories stop time. You can explore freely while paused.

## Try another future

Use the default world: seed **8417**, **Temperate**, **Balanced**, and **Careful**. For another starting configuration, open **World settings → Shape another beginning**. Export the current world before replacing it. A branch already retains its source configuration; do not make a separate new world for this comparison.

1. Let the opening archive decision occur with the Hearth–Lattice passage closed. Examine Nera's recorded alternatives and the resulting physical trace.
2. Move the timeline slider to **day 3**, before the decision, and select **Branch here**. The original future remains preserved.
3. On the new branch, select Hearth, choose **Lend a hand → Open the path → Try this**, then use **+1 day** to reach day 4.
4. Compare Nera's alternatives, Oren's location, the archive's condition, and the structures in Hearth. Follow their later recovery events to see what the changed contact made possible.

Use the branch button beside the timeline, or **World settings → View branches**, to switch between the two tellings. The branch only changes an available route. Nera's motives and circumstances still resolve the dilemma. Other founding conditions can produce a different choice even when the same passage is available.

For the default configuration, the simulation produces these different outcomes:

| What you inspect | No opening intervention | Passage opened before day 4 |
| --- | --- | --- |
| Nera's decision | **The vessels above the water**; raise the vessels | **Nera makes room for a stranger**; accept Oren's repair |
| Oren | Remains at Lattice | Moves to Hearth |
| Physical trace | **The Dry Loft** | **Oren's Open Workshop** and **The Welcome Landing** |
| Later recovery | Familiar raised beds | Channels using transmitted knowledge |

These outcomes have been checked directly against the deterministic engine. They are not a claim of completed manual playtesting. A **Curious** founding disposition with the passage closed offers a third case: **The archive takes root**, leaving the former seed room as a ruin beside **The Living Archive**.

To reproduce the two opening outcomes from the repository without a browser:

```sh
node --input-type=module -e "import {createWorld,advance,intervene} from './src/sim/world.js'; const past=advance(createWorld({seed:8417,tier:2}),3); for(const open of [false,true]){const w=advance(open?intervene(past,{kind:'open-route',targetId:'r-hearth-lattice'}):past,1); const e=w.events.find(e=>e.kind==='seed-decision'); console.log(open?'Open passage':'Closed passage',e.title,e.decision.chosen,w.characters.find(c=>c.id==='c-oren').settlementId);}"
```

## Follow an explanation to its roots

In the open-passage telling, find **Oren's Open Workshop** under Hearth's **Buildings & old places**, then choose **Why this place exists**. The link opens **Nera makes room for a stranger**. Open **Why did this happen?** to see Oren's move, the materials used, and what Nera knew when she chose. The repair leaf had arrived, and the closed path was no longer an obstacle.

Inside **Why did this happen?**, find **How this began · earlier records**. Open **A pattern with a meal attached**, then **A usable line through the silt**, then **The first shared survey**; expand **Why did this happen?** at each step to find the next link. The other root, **Water in the seed room**, records the original damage and the contents of Oren's earlier letter. The explanation chain reaches actual events rather than a retrospective guess about Nera's motives.

For another discovery, visit **Old Hollow**, inspect **The Empty Drying Hall**, and choose **Lend a hand → Uncover the chamber**. Tavi and Ivo can inspect the exposed chamber; their discovery remains connected to the abandoned place and its earlier residents.

## Three forms, one shared channel

In a Tier 2 world, visit Lattice's cyan synthetic arrays and Choir's jade root rooms. Their populations behave differently:

| Form | What it needs | How its home grows |
| --- | --- | --- |
| Emberkin, organic inhabitants | Food and viable habitat | Households build homes and gardens |
| Vessels, synthetic bodies | Energy, ceramic material, and maintained shells | Maintained patterns are copied into bodies and arrays |
| Chorus, collective nodes | Wet connected habitat and nutrients | New root rooms occupy additional ground |

For a reproducible route through the shared history, use the default Tier 2 settings and open the Silt Saddle on **day 2**. Continue advancing after each director stop; use **History** to inspect other events that happened on the same day.

| Day in this example | What to find |
| --- | --- |
| 4 | **A promise with three signatures** creates **The Common Channel**, an institution across all three forms. Inspect **The Common Sluice** at Hearth. |
| 8 | **A debt you can reproduce** records **The Open Pattern**, a new organic practice at Lattice. Hearth retains the Warm Table custom. |
| 13 | **The channel answers out of turn** records **The Undersong**. Visit **The Answering Arch** at Choir and follow the power. |
| 22, 32, 42 | The Undersong redistributes real reserves. Read the measured changes separately from the communities' interpretations. |
| 42 | **The ledger gives up its throne** ends the Common Channel's central authority. Its conduits, populations, and local maintenance survive; the Undersong continues acting. |

These dates describe one checked run, not scheduled milestones. The power needs a functioning shared network, transmitted knowledge, accumulated charge, and participating forms. Watching without intervening also works: in the default passive run, inhabitants open the passage on day 14, the shared institution forms on day 15, and the Undersong appears on day 24. No intervention is required to unlock this history.

To follow the material chain, inspect the Undersong's emergence record, expand **Why did this happen?**, then look under **How this began · earlier records** for the shared channel, cultural divergence, and recovered gardens. Different communities offer different accounts of the same pulse. Those accounts are interpretations; the observed energy and habitat changes do not prove consciousness.

After the shared channel exists, **Lend a hand → Make room** may become available at Hearth. In the day-2 passage example, try it on **day 4**, then advance one day. **Neighbors with different mornings** records two synthetic bodies and three collective nodes relocating to Hearth, with their original communities' counts reduced accordingly. Inspect **The Neighbor Array** and **The Borrowed Room**. The intervention first makes a suitable place; inhabitants decide whether its conditions support the move.

Reproduce the main sequence directly:

```sh
node --input-type=module -e "import {createWorld,advance,intervene} from './src/sim/world.js'; let w=advance(createWorld({seed:8417,tier:2}),2); w=intervene(w,{kind:'open-route',targetId:'r-hearth-lattice'}); w=advance(w,58); for(const e of w.events.filter(e=>['common-channel-founded','culture-diverged','power-emerged','power-redistribution','channel-authority-ended'].includes(e.kind))) console.log(e.tick,e.kind,e.title); console.log('Institution:',w.institutions.find(i=>i.id==='i-confluence').status,'Power active:',w.power.active);"
```

## Reading a place

Use **Basin** scale to see the connections, **Settlement** to see a place's arrangement, and **Streets** to meet people and inspect structures. Recover your orientation with the overview control. Exploration works while paused. The journal also lists people and structures, so precise selection on the canvas is not required.

Built and abandoned structures remain part of history. An old foundation may outlive an institution, and a changing institution does not erase its people. Following a place reconnects you with its recorded events.

## Time, history, and keeping a world

Pause freely. Speed changes how quickly allowed days run; it does not change the rules. The world also pauses when the app is hidden. Historical views are read-only; branch before continuing from the past.

In **World settings**, choose **Export history** to transfer or retain a world, or **Import history** to restore a portable save. Import validates the file before replacing the current history. Autosave errors are shown explicitly; export if browser storage is unavailable. Retained history is bounded, so export before reaching its limits.

The production build is designed to run offline after its first successful asset cache on HTTPS or localhost. It needs no account, API key, or runtime language model. Offline behavior still requires the browser verification listed in the implementation-status note.

A [browser preview](https://philipreese.github.io/WorldWeaver/) is available for testing; the required release is still incomplete. For running it, see the repository README (`npm run dev`, then `http://localhost:4173`). These are play instructions and checked simulation examples; [implementation status](IMPLEMENTATION_STATUS.md) records completed checks and the remaining browser, touch, and playtesting work. The team's [story, art, and playtest guide](EXPERIENCE_GUIDE.md) describes the intended feel and the questions still to test with players.

## Numbers and feedback

Curious about the bigger picture? Open **World stats** at the bottom of the journal. Select a person and open **Traits & memories** for age, care, curiosity, duty, memories, and relationships. More detailed numbers live in expandable sections. Looking at the past shows the numbers for that day.

If something goes wrong, choose **World settings → Report a problem**. Write what happened and download the report. It includes your saved world and version details so the problem can be reproduced. You decide whether to share the file.
