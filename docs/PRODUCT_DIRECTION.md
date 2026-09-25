# Owner follow-ups to the first-build brief

Updated 2026-09-25. These requirements supplement [brief v0.4](worldweaver-build-prompt-v0.4.md); the required release is still Tier 2.

- **Middle-school appeal:** approachable controls, recognizable people, warm and unusual places, short scenes, and humor. Put detailed explanations and numbers behind optional controls. Enjoyment still needs human playtesting.
- **A good first visit:** establish the place, player's practical role and one optional activity through the scene. Let the player perform an action and see a result before introducing detailed history and branching. The existing three-chapter guide remains skippable, resumable and reachable on phones; its next revision must support direct play beyond the introduction.
- **Personalization:** the preview has six coat colors, home trim, and doorstep planters, lanterns, or bunting. Preserve faces and familiar silhouettes. Shared homes share decorations. Existing choices are saved appearance preferences across all tellings, including historical views; they do not create historical events or choose inhabitants' decisions. The next slice adds a bounded living space with objects to place and rearrange, broader personal styles and an interactive companion; these are planned, not implemented.
- **Learning through play:** invite players to notice needs, dependencies, competing priorities, evidence, and different outcomes. Branches make “what if?” experiments possible. Curiosity prompts refer to things actually present in the world. Avoid compulsory lessons, school-like scoring, or assertions that the game has proven educational benefits.
- **Useful data:** retain stable entity IDs, causal events, decisions, relationships, memories, and versioned statistics views. Save cosmetics and guide progress separately from simulation history. Add new measurements deliberately when a future feature needs them; do not infer activities that were never recorded.
- **Supporting tools:** reproducible histories, recovery tests, build IDs, local problem-report exports, a story/art guide, and release evidence. Reports stay on the player's device until shared. No external analytics service is installed.
- **Review and phone access:** commit work to the review branch, keep issues and a draft PR current, and publish the branch through GitHub Pages so the owner can play before merge.

Original release gates still apply: history invariants, a continuous neighborhood visit, real device controls and performance, browser offline/transfer checks, and human prediction/return-session playtests. Cosmetics and tutorials do not substitute for them.

## Review correction and next priorities

The first preview demonstrated an authored opening and reliable history, but its long-running world was too limited. The earlier “Tier 2 mechanics integrated” wording overstated the result. The temporary freeze on cosmetic work and tutorial polish supported the measured household correction in [the simulation report](SIMULATION_CORRECTION.md). The next slice now permits focused visual and interaction work in one neighborhood; broader polish must not displace the remaining simulation gaps in [#5](https://github.com/philipreese/WorldWeaver/issues/5). Keep the freeze on additional fixed story milestones. New generic rule outcomes must arise from actual needs, resources, available space, and connections; naming another scene does not meet this requirement.

The introduction must also establish the universe: where the player is, who lives here, and the player's role. Introduce those through people, places, and activities; preserve the mysteries that make exploration worthwhile. This belongs in the next hands-on slice. More explanatory text alone does not supply an enjoyable activity.

A future audio pass should provide music, environmental ambience, and a much wider range of character/activity sounds. The current soft event tones are only a placeholder. Plan sound around places, people, weather, and activity, with separate music/effects controls and a comfortable muted experience. Audio expansion is deferred while the underlying world is being corrected.


## Prototype pace and the next playable slice

Owner clarification: nobody needs to play every path or exhaust the prototype before development continues. Ask for brief, focused visits to learn whether people care about the cast, understand an action and its consequence, and want to return. Automated mechanical checks belong to development. The full device/release evidence checklist is for declaring a release, not permission to build the next feature. Do not wait for an owner playthrough sign-off.

Prototype saves may become incompatible as the design changes. Announce a reset requirement clearly and offer export before replacing a world; never silently reinterpret a saved past. The captured 1.0.0 engine is a temporary safeguard for the already shared preview, not a promise to retain every prototype engine or maintain a migration platform. Keep in-world rewind and alternate futures correct; avoid further compatibility expansion until the design stabilizes.

The owner suggested that contact with civilizations or regions beyond the basin could sustain later play. Following the hands-on neighborhood slice in [#8](https://github.com/philipreese/WorldWeaver/issues/8), [#7](https://github.com/philipreese/WorldWeaver/issues/7) explores one outside community with a distinct need and practice, encountered through a visitor or reachable route. Trade, exchanged knowledge, and conflicting obligations should change familiar people and places over several encounters. Begin with a bounded neighboring community; a fully simulated continent is unnecessary for testing this idea. This extends Tier 2 contact without adding the optional Tier 3 systems.

The household work supplies useful consequences for that contact. Diversity counts and an indefinitely active closed basin are not the product goal. Build a short, engaging interaction whose outcome follows actual needs, access, knowledge and relationships; use a focused playtest to guide the next iteration. More geography alone would leave the same authored-event limitation, so the encounter's rules should be reusable by other communities.

## Immediate priority: hands-on neighborhood play

[Issue #8](https://github.com/philipreese/WorldWeaver/issues/8) defines the next development experiment. Its loop is **choose an activity, do it in the scene, see a response, choose what to do next**. The following scope is planned, not implemented:

- One living space with a bounded set of furniture, garden or yard objects to place and rearrange; broaden personal styles beyond coat colors.
- One companion species with naming/appearance choices and repeatable interaction, such as tossing a toy and seeing it fetch or investigate. No feeding schedules, attendance requirements or neglect penalties.
- One reusable environmental interaction, such as reconnecting a water channel. The action produces an immediate visible result under actual world conditions; inhabitants independently decide how to use the opportunity. Avoid precision dragging, arbitrary click gates and fixed-day scenes.
- A visual pass on that same neighborhood: richer plants and architecture, stronger lighting and depth, expressive inhabitants and visible activity. No rendering-engine rewrite is assumed.

Start with the smallest connected example. Activities remain available after the tutorial; avoid a short scripted task chain that ends in observation alone. The first visit should let a player find an action, carry it out, understand its effect and choose another activity without opening history or statistics panels. A short uncoached visit tests this; developer checks do not establish enjoyment.

This refines the observer framing in brief section 2: direct furnishing and companion interactions are in scope, while inhabitants still choose their actions and design/run their settlements. Environmental interventions change their opportunities. Observation remains a complete optional way to play. Preserve paused time, touch access and trustworthy history. Presentation-only choices can remain outside simulation history; any interaction that changes the world or claims meaningful creature behavior needs matching modeled state. Prototype resets may be announced under the existing policy.

The required Tier 2 release and simulation gaps remain open. This planning update adds no gameplay and claims no new playtest results.
