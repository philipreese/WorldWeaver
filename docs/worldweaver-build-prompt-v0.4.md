**Worldweaver — build prompt v0.4**

Working title. Design scope frozen for the first build. Complete first build brief for an autonomous build team. The target is a cohesive, playable browser game with one bounded world and real reason to return. Make ordinary implementation decisions autonomously within the available tools and permissions.

Read section 3 first. Everything else exists to serve it.

**1. The experience.** A world whose civilizations develop their own histories. The player sets initial conditions, follows people and communities, asks the world why things happened, and occasionally changes what is possible. Settlements, cultures, relationships, and apparent divine powers evolve through connected systems that the player can inspect.

The long-run payoff is a place: settlements the inhabitants built, that the player can move through at street scale, whose form records what happened to the people who built them. Exploring that place is as much the game as investigating how it came to be.

The game rewards curiosity, attachment, and experiment. It must stay enjoyable in a five-minute visit and a two-hour session, and the player can leave at any point without losing history or acquiring a maintenance backlog.

Use Malazan Book of the Fallen as a tonal reference: historical breadth, intersecting cultures, compassion, individual lives inside enormous events. Create an original setting, cast, terminology, and mythology. The setting should feel ancient, strange, inhabited, and technologically uneven: living structures, inherited machines, distributed intelligences, unfamiliar ecologies, cities built on the remains of earlier ones. Nothing in it should read as rehashed sword-and-sorcery.

One environment, one rule set, one connected history, one visual language. Every feature must serve the loop in section 3; cut any that does not.

**2. The player's role.** The player is an observer outside the world's pantheon, with limited influence. Civilizations and their divine powers act independently.

World creation is the one place the player shapes the world with a heavy hand: meaningful choices about environment, founding populations, and a compact set of life traits. It is a one-time act, not upkeep. During play, inhabitants design and run their own settlements. The player never chooses a character's answer to a dilemma, dictates a culture's beliefs, or places buildings.

Interventions change what is possible, not what is chosen. The set is small and expressive: open a route, alter a habitat, reveal a resource or relic, create conditions for refuge. Each intervention requires world conditions rather than timers or currencies: a route can only be opened where the terrain allows a passage, a relic only revealed where earlier history left one, a refuge only where the habitat could support it. This keeps interventions inside the fiction and gives each one a location and a reason. Show the player where interventions are currently possible and why. No cooldowns, no currencies, no repetitive actions.

The immediate effect of an intervention should be understandable: a player who opens a route to reach a struggling settlement should expect it to help, and it is satisfying when it does. What follows from that — who uses the route, what it carries, who resents it — is where the world is allowed to surprise. Aim for understandable immediate effects, consequential choices, and open later developments.

Observation must remain a complete way to play. Pause, speed, timeline, and branching are player tools outside the fiction.

**3. The core loop and the director.** This is the game. Four player verbs:

- *Explore.* Move through settlements at neighborhood scale, follow inhabitants through their activities, inspect landmarks and surviving traces of earlier eras, and connect discoveries in the environment to recorded history. These interactions must work comfortably on touch. The first integrated milestone must demonstrate a visit that gives the player something meaningful to discover.
- *Follow.* The player maintains a small follow list of people, settlements, cultures, places, and apparent powers. Following an entity is how the player declares what they care about. The follow list is the central interface object, always reachable.
- *Ask why.* Major events and consequential character decisions carry a concise explanation linked to the records that support it: the conditions, the information the actor had, their motives and commitments, and the alternatives they had. Record that context at decision time; it cannot be reconstructed afterward. This is the same machinery that enforces the narrative-fact invariant in section 6. Start with major events and focal-character decisions; extend coverage where it serves attachment. Do not attempt to explain every state change.
- *Ask what if.* Interventions and branching. The player changes a condition or continues from an earlier moment and watches history diverge.

The explanation view distinguishes three things and never collapses them: observed effects, recorded decisions, and cultural interpretations. It must not casually settle questions the fiction keeps open, such as whether an apparent divine intelligence is conscious.

The recurring session:

- Enter to a short digest: a recap of what developed during the last active session, and the threads left unresolved then. Nothing advances while the player is away.
- Pick a thread, or simply visit somewhere. Understand its current situation through the world, the follow view, and an explanation.
- Explore, or make one intervention.
- Advance time. Fast-forward stops when something happens to a followed entity that the director judges worth the player's attention.
- See the consequence in the world and in the followed lives. Ask why.
- Continue, revisit, or branch.

The narrative director owns attention. It decides when fast-forward stops, what the digest says, which situations are surfaced, and how threads are reconnected across sessions. Its calibration is the pacing of the game: too sensitive and the player is interrupted for everything; too loose and history slides past unread. Make its thresholds derive from the follow list, and let the player tune them coarsely.

Surface existing unresolved threads when they matter; they are a primary reason to return. Do not manufacture them. Closure, quiet periods, and a session spent visiting a place the player has come to care about are equally legitimate ways for a session to end. Optional ambitions (help two forms of life coexist, understand a migration) are framed as threads the player can adopt, not objectives assigned.

A meaningful discovery or action must be available within the opening few minutes of a fresh world. The shipped opening world should start with several open threads already visible.

**4. Scope of the first release.** Ship one finite, connected world with several distinct regions and a handful of developing settlements. Scope is controlled by system depth, not map size. Build in this order and do not advance a tier until the previous one is playable end to end.

*Tier 1 — internal milestone.* One form of life fully individuated (focal characters, relationships, memories, settlements). One region-scale environment with legible settlement growth and abandonment. One neighborhood where the player can navigate, follow activity, and inspect a historical trace. The follow list, explanations for major events and focal decisions, digest, fast-forward with director stops, and two or three conditional interventions. Deterministic simulation with checkpoints, autosave, timeline viewing, and proven basic branching (the interface can be finished later; the mechanism must work here). This tier must be enjoyable to revisit, but it is not the release.

*Tier 2 — the required first release.* Two more forms of life, mechanically and visually distinct: synthetic beings and a collective or distributed form. They may be aggregated (no individual focal characters) provided their needs, replication, vulnerabilities, and occupation of space visibly differ and they interact with the first form. One emergent power, fully realized per section 7. Cultural divergence within one form of life. One mixed community or institution across forms. Institutions that can change or collapse while populations and traditions persist. Finished branching. The neighborhood-scale world described in section 10.

*Tier 3 — optional expansion, only after Tier 2 works well.* Focal characters for a second form of life. A second, different kind of emergent power. One bounded heritable trait changing outcomes across generations. Physical adaptation, learned cultural change, and technological development as visibly distinct processes.

The completion standard is Tier 2. If Tier 2 is not reached, the deliverable is incomplete and the handoff must say so; a polished Tier 1 is not the game. Additional continents, realms, and larger populations are for later releases.

Keep a recurring cast of roughly six to ten focal characters at a time, with continuity beyond individual lifetimes. Aggregate population where appropriate; keep explicit identities for whatever the player follows.

**5. Simulation and physical continuity.** Implement a compact set of interacting needs and flows: habitat, energy, sustenance or materials, connectivity, population, and transmitted knowledge. Different forms of life use these primitives differently.

Inhabitants choose settlement sites, build and adapt structures, exchange resources, migrate, and respond to shortages and opportunities. Architecture reflects form of life, environment, capability, and history. Contact between cultures can change capabilities, practices, or settlement form.

Choose enough causal detail to make interventions interesting and explanations informative. A connection changes trade or migration; a resource change changes viability; a migration transfers knowledge; shared infrastructure creates dependence. Every such relationship must be inspectable.

Working solutions keep working without player upkeep. Quiet periods are allowed and should read as quiet, not empty. Collapse, displacement, conflict, and extinction may occur through the world's own conditions and actors. Refuge, cooperation, recovery, and preservation must have effects of equal weight. No timer manufactures crises.

Persist physical traces: abandoned sites, reused foundations, infrastructure, landmarks, cultural practices. A change of government does not erase the identity and history of the people living there.

**6. Characterization and narrative.** Authored situations and voices, resolved by the simulation. The factual invariant constrains what a scene claims happened; it does not require every scene to justify itself through a material state change. A quiet conversation that makes the player care about someone is doing its job.

Focal characters have roles, motives, commitments that can conflict, relationships, knowledge, and memories of relevant events. Show personality through actions, habits, recognizable places, distinctive voices, and short scenes. Include humor, tenderness, hesitation, private misunderstandings, and ordinary disagreement alongside consequential dilemmas. The player should recognize someone before opening their biography.

Situations are cast from eligible existing people and institutions and require valid conditions and participants. Cover at least six families spanning relationships, discovery, competing obligations, institutional change, contact between communities, and recovery. Their stakes and resolutions must come from the participants' motives, relationships, and available alternatives in this particular world, not from a fixed list of endings with names swapped in. Keep authored text short and specific. Acknowledge repetition rather than hiding it.

A character can act only on information they could possess. NPC choices follow from motives, relationships, knowledge, and available alternatives. Player interventions change the alternatives, never the choice.

Protected invariant: a narrative claim about an action or outcome refers to an event that actually occurred. If a scene says a passage opened, the passage is usable. If someone moved, they moved. Significant choices affect later state. Explanations must be able to reach the underlying event from any scene that makes a claim.

Stories continue through families, communities, institutions, places, objects, and long-lived beings. A future character can inherit a real relationship, obligation, practice, or consequence. Different communities may hold competing accounts of the same recorded events, and those accounts affect what they do next.

Authored scenes and text variation are prepared during development. The delivered game runs without runtime language-model calls.

**7. Emergent powers and ambiguous meaning.** Divine powers can arise from worship, gather worship around an older phenomenon, or emerge where belief, collective behavior, and material systems become inseparable. Whether a power is literal, metaphysical, or a name a culture gave to something else may remain open.

Powers exist as places, networks, recurring phenomena, collective minds, or other setting-appropriate forms. They have independent behavior and relationships to particular communities. Their emergence depends on world conditions and history, never on a universal faith threshold or a fixed date.

A power must have observable material effects on inhabitants, infrastructure, resources, routes, or institutions. A name plus chronicle entries is not a power. Tier 2 requires one fully realized power; Tier 3 a second of a different kind.

Cultures may reinterpret a power, disagree about it, carry its practices elsewhere, or change their relationship to it. A power or its traces can outlive its founding institution.

Keep mechanical rules consistent while allowing metaphysical uncertainty. Separate observed events from attributed interpretations: a chronicle may say a community believes a miracle occurred; it must not establish that belief as objective causation. Explanations show the observed and recorded chain; cultural interpretation is layered on top and labeled as such. Patterns may remain unexplained to the player without making controls or practical consequences inscrutable.

**8. Time and attention.** The world advances only when the player allows it. Pause whenever the app is hidden or backgrounded; restore paused on reopening; never advance by elapsed wall-clock time.

One simulation clock for the whole world. Camera, graphics quality, and frame rate never change history.

Provide manual pause, adjustable speed, and bounded fast-forward toward a chosen milestone. Fast-forward stops for director-selected events affecting followed entities; those moments are marked on the timeline for revisiting. Minor changes accumulate into the digest rather than interrupting.

Exploration works while paused. Decorative motion may continue when it cannot change state.

Exclude attendance rewards, daily obligations, paid progression, waiting gates, and repetitive collection. Late-game scale must not scale chores. New possibilities come from conditions, discoveries, encounters, and consequences.

**9. History, replay, and saves.** Build reproducible history in from the start: stable identities, explicit simulation time, controlled randomness, versioned state, checkpoints, and a command or event log sufficient for faithful reconstruction. Prefer checkpoints plus command log over full snapshots; branches are cheap once replay is deterministic.

The timeline restores earlier world states for read-only exploration. Continuing from a past point creates a branch and preserves the original future. Replaying unchanged inputs from the same state reproduces the same history.

Provide markers for personal, cultural, infrastructural, and civilizational events. The player can follow the history of any entity or place through the timeline and explanations.

Ship a ready-to-explore opening world with recorded development, plus creation controls for alternate beginnings. Authored lore that predates recorded simulation is presented as lore or in-world account, never as replayable history.

Autosave during play and after consequential actions. Save everything needed to restore characters, relationships, powers, chronology, and branches. Report save failure accurately and preserve the last valid save.

Provide portable export and import. Validate before replacing anything; invalid or incompatible files leave existing worlds intact. Preserve simulation-version information and explain compatibility limits.

Bound memory and storage deliberately. Offer archival or export before discarding retained history. Do not promise unbounded retention or silently erase branches.

**10. Visual experience, sound, and controls.** Two requirements, both mandatory: the simulation is readable — a player can see growth, abandonment, connection, and difference between forms of life without opening a panel — and the world is extraordinary: luminous, tactile science fiction with mystery, warmth, and monumental scale, worth exploring for its own sake. When the two conflict in a specific decision, readability decides that decision. Beauty is never the feature that gets cut to fund another system. Choose a stylized, economical rendering approach the team can execute well at every scale rather than an ambitious one that reads as mush. Consistent lighting, materials, proportions, animation, interface, and sound across civilizations.

The world must be compelling at regional, settlement, and neighborhood scales, with smooth navigation, a useful overview, movement to selected places, and close inspection of inhabitants and architecture. The neighborhood scale is where the player meets the payoff in section 1; it is not polish. Camera exploration must be comfortable on touch.

Major simulation changes have visible consequences. Decorative activity may stand in for aggregated activity, but inspection must match modeled state.

Design phones, tablets, and computers together: portrait and landscape layouts, readable scenes, large controls, no dependence on precision dragging or hover. Make it easy to recover camera orientation, pause, find a followed entity, and return to overview.

Scale rendering to device capability while preserving identical simulation and player capability at every setting. Target sustained 30 fps on a representative phone and 60 fps on a capable desktop; treat these as measurements to establish.

Restrained, reactive sound with clear mute and volume. Respect reduced-motion preferences. Present essential information without forcing long text panels over the world.

**11. Delivery and engineering.** Browser-first, servable statically, installable, and playable offline after initial load and asset caching. Portable saves for device transfer; cloud sync is out of scope.

Choose libraries and a stack available in the environment. Keep asset paths compatible with subpath hosting. Document development, production-build, and preview commands. Core play requires no paid services, accounts, API keys, runtime AI, or always-on server.

Separate simulation, narrative state, and rendering enough for reproducible saves, testing, and responsive controls. Rendering is never the source of truth. Use bounded updates and work scheduling so simulation does not lock interaction.

Price rigor by the failure. Test ordinary mechanics proportionately. Give extra attention to quiet failures that would invalidate history, invent narrative facts, lose saves, or corrupt branches: write those invariants beside the implementation and test rejection and recovery paths. Do not let architecture delay a playable integrated world.

**12. Collaboration and implementation.** Use available subagents for substantial, separable work. The lead owns product identity, shared contracts, integration, and the final experience. Agree on entity identities, commands, state views, and event semantics before parallel work depends on them.

Useful responsibilities: simulation and persistence; environment and rendering; characters, mythology, and narrative; director and interaction; integrated verification. Combine to suit the team.

First integrate one complete causal sequence: one settlement, a handful of recurring characters, one authored dilemma with several plausible resolutions, running through simulation, visualization, explanation, narrative, saving, and a branch between two of those resolutions. The team should be able to experience different histories, recognize why they diverged, and care about at least one participant. Include a continuous neighborhood visit: move through the settlement, follow one participant during actual activity, inspect a landmark tied to a recorded event, and revisit that location in an earlier world state. Demonstrate that the visit reveals something about the place or its inhabitants. Then complete Tier 1, then Tier 2. Tier 3 only after Tier 2 works well.

Use the supplied repository or workspace; if none, create a local project and deliver source and a runnable build. Work autonomously on reversible tasks. Public publishing and external deployment require separate authorization. No account creation or remote repository is a prerequisite.

If this brief is used for independent model comparison, do not inspect another contestant's repository. Public documentation and ordinary libraries are permitted.

**13. Evidence of completion.** Verify with representative scenarios and retain enough to reproduce:

- A new player can enter, understand the controls, follow something, make or observe a meaningful change, and ask why within a short first session.
- Different forms of life respond differently to the same environment. Where Tier 3 is reached, adaptation, cultural change, and technology have distinct effects.
- A character faces a valid dilemma; an intervention changes the available alternatives; the resulting decision changes world state and later events; the explanation shows the chain, including what the character knew and what else they could have done.
- Contact between communities creates a consequential exchange, disagreement, cooperation, or divergence visible in the world, not only in the log.
- An emergent power arises under valid conditions, acts independently, has material effects, and its cultural interpretations are labeled as interpretation. The explanation view does not settle what the power is.
- Advancing history changes places while leaving recognizable traces and identities. Following an entity reconnects the player with its past. An institution changes or collapses while its people and practices persist.
- Reopening restores a paused world unchanged. Fast-forward stops behave as specified. Report stops per hour of simulated time and interruptions per hour of real play, and note which followed entities and speeds those figures were measured under.
- Saving, importing, replaying, and branching preserve state. A branch leaves its source future intact. Invalid imports, incompatible versions, and failed saves never silently overwrite valid data.
- Touch, camera, text, and sustained performance are exercised. Distinguish real-device testing, emulation, automated checks, and unverified conditions.
- Production build works under a subpath; cached play works offline; exports import into a separate browser context.
- The neighborhood scale is worth visiting on its own. Demonstrate navigation through the place, following an inhabitant, inspecting a historical trace, and reaching its recorded history. Retain representative screenshots for appearance and a short continuous walkthrough capture of the working application for interaction. Distinguish touch input, emulation, and mouse or keyboard input in the evidence.
- Second-look tests. Take one situation family, deliberately change a relevant condition between two runs, and confirm the resolution changes for reasons the explanation shows; note that unrelated state changes may legitimately produce the same decision. Have a tester predict an intervention's immediate effect and, separately, speculate about later consequences; record both, and report them without treating any particular hit rate as the target. Across three short sessions on the same world, record whether each offered something worthwhile and how it was found.
- Distinguish human playtesting from agent walkthroughs in every qualitative claim. Do not invent participants or report confidence from tiny samples.

Automated tests for invariants and causal paths, alongside rendered inspection and playtesting. Test counts do not establish usability, beauty, or enjoyment. If real phone access is unavailable, complete other verification and say so.

**14. Final handoff.** Deliver complete source, required assets, a runnable production build, setup instructions, a short player guide, representative starting worlds, and a concise account of implemented behavior, tier reached, verification, and remaining limitations.

Show the rendered game with representative screenshots and a short continuous walkthrough capture, including neighborhood interactions. Include a reproducible example of a meaningful alternate history with instructions for finding the relevant people, places, and consequences, and one example explanation from a scene back to its root causes.

Report elapsed time and usage only where reliably measured. Resolve implementation choices yourself; surface genuine blockers or materially conflicting requirements clearly.

The completion standard is a world the player reopens because they care about someone in it and want to see the place they made: history that holds, inhabitants whose choices matter, powers with consequences, and enough beauty and depth that answering one question raises the next.
