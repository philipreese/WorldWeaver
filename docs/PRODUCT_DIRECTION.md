# Owner follow-ups to the first-build brief

2026-09-24. These requirements supplement [brief v0.4](worldweaver-build-prompt-v0.4.md); the required release is still Tier 2.

- **Middle-school appeal:** approachable controls, recognizable people, warm and unusual places, short scenes, and humor. Put detailed explanations and numbers behind optional controls. Enjoyment still needs human playtesting.
- **A good first visit:** a skippable, resumable guide in three chapters: meet the neighbors, notice what changes, and try another possibility. Present one useful action at a time. Keep the guide reachable on phones and allow it to restart without resetting the world.
- **Personalization:** begin with six coat colors, home trim, and doorstep planters, lanterns, or bunting. Preserve faces and familiar silhouettes. Shared homes share decorations. These are saved appearance preferences across all tellings, including historical views; they do not create historical events or choose inhabitants' decisions. Furniture layouts, names, new outfits, and further decorations remain possible future work.
- **Learning through play:** invite players to notice needs, dependencies, competing priorities, evidence, and different outcomes. Branches make “what if?” experiments possible. Curiosity prompts refer to things actually present in the world. Avoid compulsory lessons, school-like scoring, or assertions that the game has proven educational benefits.
- **Useful data:** retain stable entity IDs, causal events, decisions, relationships, memories, and versioned statistics views. Save cosmetics and guide progress separately from simulation history. Add new measurements deliberately when a future feature needs them; do not infer activities that were never recorded.
- **Supporting tools:** reproducible histories, recovery tests, build IDs, local problem-report exports, a story/art guide, and release evidence. Reports stay on the player's device until shared. No external analytics service is installed.
- **Review and phone access:** commit work to the review branch, keep issues and a draft PR current, and publish the branch through GitHub Pages so the owner can play before merge.

Original release gates still apply: history invariants, a continuous neighborhood visit, real device controls and performance, browser offline/transfer checks, and human prediction/return-session playtests. Cosmetics and tutorials do not substitute for them.

## Review correction and next priorities

The first preview demonstrated an authored opening and reliable history, but its long-running world was too limited. The earlier “Tier 2 mechanics integrated” wording overstated the result. Freeze additional authored story milestones, cosmetic work, and tutorial polish until reusable state-driven behavior has been measured. New generic rule outcomes must arise from actual needs, resources, available space, and connections; naming another scene does not meet this requirement.

The introduction must also establish the universe: where the player is, who lives here, and the player's role. Introduce those through people, places, and small encounters; preserve the mysteries that make exploration worthwhile. This requirement is recorded for the next introduction pass, after the simulation work.

A future audio pass should provide music, environmental ambience, and a much wider range of character/activity sounds. The current soft event tones are only a placeholder. Plan sound around places, people, weather, and activity, with separate music/effects controls and a comfortable muted experience. Audio expansion is deferred while the underlying world is being corrected.


## Prototype pace and the next playable slice

Owner clarification: nobody needs to play every path or exhaust the prototype before development continues. Ask for brief, focused visits to learn whether people care about the cast, understand an action and its consequence, and want to return. Automated mechanical checks belong to development. The full device/release evidence checklist is for declaring a release, not permission to build the next feature. Do not wait for an owner playthrough sign-off.

Prototype saves may become incompatible as the design changes. Announce a reset requirement clearly and offer export before replacing a world; never silently reinterpret a saved past. The captured 1.0.0 engine is a temporary safeguard for the already shared preview, not a promise to retain every prototype engine or maintain a migration platform. Keep in-world rewind and alternate futures correct; avoid further compatibility expansion until the design stabilizes.

The owner suggested that contact with civilizations or regions beyond the basin could sustain later play. Proposed next slice: one outside community with a distinct need and practice, encountered through a visitor or reachable route. Trade, exchanged knowledge, and conflicting obligations should change familiar people and places over several encounters. Begin with a bounded neighboring community; a fully simulated continent is unnecessary for testing this idea. This extends Tier 2 contact without adding the optional Tier 3 systems.

The household work supplies useful consequences for that contact. Diversity counts and an indefinitely active closed basin are not the product goal. Build a short, engaging interaction whose outcome follows actual needs, access, knowledge and relationships; use a focused playtest to guide the next iteration. More geography alone would leave the same authored-event limitation, so the encounter's rules should be reusable by other communities.
