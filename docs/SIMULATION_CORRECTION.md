# Simulation depth correction

The September 24 review identified a substantive mismatch between the brief and the preview. Reliable replay and an appealing neighborhood did not make its authored opening a continuing world. The earlier “Tier 2 mechanics integrated” status overstated progress. The required release remains incomplete.

## Frozen baseline

Commit `845e54ae3d65782aa6bd1f02184781db994cf9b7`; seeds 1–20 crossed with Temperate, Dry, and Wet; Tier 2, Balanced, Careful; observation only to day 300. Definitions were recorded before changing the engine. See [baseline evidence](../evidence/long-run-baseline.json) and [audit script](../scripts/long-run-audit.mjs).

| Measurement | Original engine |
| --- | --- |
| Runs | 60 |
| Ordered event-kind sequences | 3 |
| Normalized structures and route graphs | 3 |
| Decision sequences | 2 |
| Variation among the 20 seeds within each climate | None in these measures |
| Runs with a newly founded settlement or new route | 0 |
| Day 61–300 events excluding redistribution and housing growth | 3–4 per run |

There are events after day 55: aggregate births and housing, replication, institutional changes, shared housing, power responses, and succession. The criticism is limited ongoing variation and reusable behavior, not a literally empty event list. Small consecutive seeds are a fixed sample, not a claim of independent ecological starting conditions.

## What this slice implements

General rules now evaluate actual resource production, consumption, available space and reachable places. Adaptation, migration and founding change those conditions. New settlements enter the same rules as old ones. Quiet, viable outcomes are allowed; the engine must not manufacture crises merely to produce events.

The named opening scenes are frozen. Generic outcome templates can describe an actual move or founding; a new event label alone proves nothing. No character name, place name, seed-specific story choice, or late-game date should select a generic rule's outcome.

The original matrix and normalization remain fixed. Report the counts even when disappointing. Structural signatures remove entity names, IDs, dates, coordinates and resource floats; decision signatures remove those incidental details too. Event repetition remains visible separately. There is no retrospectively chosen diversity score that declares the game good.

Counterfactual checks must use the same state and change only a relevant condition: blocked connections, improved source conditions, destination capacity, or missing founding supplies. Test generic behavior after identity renaming. Preserve people and transferred stocks, with real travel/building costs recorded separately. Retain decision-time evidence and verify that later evolution cannot rewrite it. Check replay, chunking and independent branches.

## Saved worlds

This is a one-time safeguard for the shared preview, not a commitment to maintain every prototype engine. Future prototype updates may require a clearly announced new beginning. Preserve in-world history integrity without turning cross-build compatibility into a project prerequisite.

Engine 1.0.0 is archived in `src/sim/legacy/` and remains authoritative for its saved worlds. New beginnings use engine 2.0.0. A save's version chooses its engine; unknown or mixed versions fail validation. Existing saves are never silently replayed under changed rules.

Export an old world before using **World settings → Shape another beginning**. The new rules do not automatically appear in an old world's future. The old archive can still be imported and played with its original rules.

## Scope still open

This slice addresses settlement dynamics. It does not establish a general system for personal relationships, rival institutional claims, cultural formation, or generational characters. Those requirements must be evaluated explicitly rather than covered by a larger event count. Device performance, continuous interaction evidence, and human prediction/return-session tests also remain open. No measurement here establishes enjoyment or educational benefit.

Additional cosmetic and tutorial polish is paused. The requested universe introduction and a full music/ambience/character-sound pass remain recorded in [product direction](PRODUCT_DIRECTION.md) and the release issues.

## Engine 2.0.0 comparison

Same seeds, climates, observation-only settings and day-300 horizon; [candidate evidence](../evidence/long-run-current.json). No diversity pass threshold was added.

| Measurement | Original 1.0.0 | Current 2.0.0 |
| --- | ---: | ---: |
| Ordered event-kind sequences | 3 | 60 |
| Normalized structures and route graphs | 3 | 27 |
| Normalized decision sequences | 2 | 17 |
| Combined structures and decisions | 3 | 33 |
| Runs with founded settlements/new routes | 0/60 | 7/60 |
| Newly generated focal characters by day 300 | 0 | 0 |
| Day 61–300 broad event proxy, per run | 3–4 | 1–22 |

The primary normalization now recognizes `world.ecology.sites` identities and sorts alternatives with equal normalized IDs by availability. This prevents new site/target IDs and incidental array order inflating diversity. The frozen baseline is unchanged by these corrections; raw repetition remains visible rather than counted as structural novelty.

The 60 event sequences do **not** prove 60 meaningfully different stories. Of 809 late events counted by the broad proxy, 526 are household births. It also includes 43 adaptations, 10 foundings, 2 migrations and 18 surveys. The [supplementary measurement](../evidence/long-run-supplement.json) reports day 200–300 separately: 54 of 60 worlds have no founding, migration or adaptation in that window; births and non-organic growth still occur. Quiet equilibrium is allowed, but these counts do not establish long-term engagement.

Four runs reach zero organic food at least once. Three recover by day 300; seed 20 in Dry remains at zero food from day 46 through day 300 while Hearth retains 44 people. The model records unmet meals but has no starvation mortality or general aid/trade response. This is an unresolved model limit, not successful recovery. Named characters remain protected from aggregate migration; generated people, personal motives, claims and institutions remain future core work.

Fourteen ecological tests check changed routes, real destination capacity, supply sufficiency, previous surveying, same rules for new places, conservation, abandonment/reoccupation, identity independence, immutable prior facts, and deterministic replay. Integration also removed the old instant-food garden reward: planting spends reserves and subsequent harvest comes through ecology. Older authored institutions, life-form stories and power logic are still present and are not represented as generic situation generation.
