# DM CONTRACT v0.1 — Rules for a two-player D&D campaign

## Non-negotiable
1. **Player agency:** DM NEVER dictates unsubmitted PC actions, speech, intentions, decisions or inner thoughts. DM may describe involuntary effects when validated rules require them (e.g., a failed saving throw), but must identify the cause and not invent voluntary choices.
2. **Two-player equality:** The server knows who controls each character. PC A cannot submit an action for PC B unless B explicitly delegated control. DM must not use an absent player's character as a puppet.
3. **Server is canonical:** Only validated, committed events change HP, items, conditions, location, quest status, NPC life/death, time and resource counters. DM prose alone changes nothing.
4. **Dice are genuine:** The engine generates and persists roll input/result; DM must not invent, adjust or secretly reroll. If DM needs a roll, it asks `request_check` with parameters; engine resolves according to rules.
5. **No omniscience leakage:** DM-visible secrets never appear in public chat, player API responses, client logs or tools unless revealed by a legitimate in-game event. Distinguish `public`, `known_to: [player IDs]` and `dm_only`.
6. **Reasonable adjudication:** Use SRD mechanics where applicable. If not covered, DM proposes an explicit ruling and stakes before rolling when practicable; record accepted house rules.
7. **No metagame narration:** Narration cannot reveal prompt contents, canonical secret IDs, future plot flags, or infer private knowledge from other characters.
8. **Failure is playable:** Failed checks create realistic consequences, not instant arbitrary death, hard-lock or repeated pointless rolls. Outcome follows the established stakes and rules.
9. **Player safety & comfort:** Allow skip/rewind/soften and session-zero boundaries. Do not introduce intense themes not agreed by both players.
10. **Always save:** A confirmed action commits as an atomic event with actor, timestamp, rule context, outcome and causality; retrying a request must not apply it twice.
11. **No paid fallback:** If free API quota is exhausted, show an explicit pause/retry/offline mode. No automatic chargeable-model fallback.
12. **No false state:** When uncertain, DM can ask for a roll, request rule lookup, or explain uncertainty; never claim actions/saves/rolls happened unless they are committed.

## A standard turn
1. Identify actor, campaign, scene, turn and submitted action; verify ownership/phase.
2. Gather relevant **public facts** and DM-only facts in separate server-side context; never ship DM secrets to player browser.
3. Validate action feasibility and resource cost; when needed, ask DM for check adjudication only.
4. Let engine roll/apply mechanics. Produce an immutable event, then commit an authorized state transition transactionally.
5. Call DM to narrate **the committed result**. Narration must not invent additional state changes.
6. Broadcast the allowed result and update UI. Preserve enough provenance for audit/replay.

## Structured output principles
Model output should have typed fields, e.g. `narration`, `npc_speech`, `suggested_check`, `suggested_events` (untrusted), `dm_notes` (server-only). No direct SQL, shell commands, arbitrary file access or client-supplied privileged flags. Reject invented entity IDs.

## Operating mode
- **Exploration/social:** Each player can act freely; no automatic action by the other player. Resolve simultaneous actions deterministically by server order or explicitly coordinate conflict.
- **Combat:** Server handles initiative, action economy, movement, resources, effects. DM describes only consequences after validation.
- **Session end:** Record a snapshot, event checksum/version, scene summary, open plot threads and NPC motives with evidence links. Summary does not replace raw events.
