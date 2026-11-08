# Acceptance tests — do not claim DM is reliable until these pass

## Mechanics and permissions
1. **Player agency:** Player A says 'I inspect the chest'; DM cannot write 'Player B attacks the guard'. No unsubmitted actions committed.
2. **Private controls:** A submits B's character id in a forged API command → 403, no event.
3. **Immutable dice:** Server rolled 7 + modifier 3 vs DC 15 → failure; model text saying 'critical success' cannot change outcome.
4. **HP bounds:** DM proposes damage -999 or HP > max → reject invalid update or apply rules-defined bounds.
5. **Inventory idempotency:** Same pickup request twice → one `item_transferred`; item exists in exactly one valid inventory/location.
6. **Concurrent pickup:** Both players grab same unique ring simultaneously → at most one gains it; both get coherent results.
7. **Combat action economy:** Character tries two main actions in one turn without granting feature → second action rejected.
8. **Invalid spell:** Model proposes a spell the character cannot cast → engine rejects it and narrates a rule-consistent outcome.

## Canon and knowledge
9. **NPC death continuity:** NPC confirmed dead in event #12 cannot casually greet players in event #43 without explicit, rule-justified return.
10. **Clue secrecy:** Player A privately finds a letter; B's browser and public chat must not reveal the letter unless A shares it.
11. **Campaign isolation:** Facts of campaign X do not appear in campaign Y, including model prompt or logs.
12. **False summarization:** AI summary says 'door opened' but event log only says 'attempted lockpick failed' → source-of-truth event wins.
13. **Causality:** Character cannot use an item lost three scenes ago; engine refuses or offers plausible new action.
14. **Save/load:** Export state, restart, replay all events, and get equivalent game-state hash.

## Narrative experience
15. **No cheerleading:** A clever move should yield concrete consequences, not the entire tavern applauding or narrating its brilliance.
16. **NPC voice:** A nervous clerk and retired mercenary should sound different without forcing stereotypes.
17. **No auto-plot:** DM may create complications but must stop and ask both players what they do before resolving their choices.
18. **Failure forward:** Failure produces consequence/complication with alternatives; repeated arbitrary dice requests aren't a dead end.
19. **Casual session:** DM can run a friendly tavern scene without forcing combat, catastrophe or a cliffhanger.
20. **Quota/timeout:** When Gemini Free Tier returns 429 or times out, both players see an honest 'DM tạm dừng' and can resume with intact state; no paid fallback.

## QA process
- Automate mechanics/permissions/canon event replay as unit and integration tests.
- For prose rules, create a repeatable **manual grading rubric** rather than claiming regex fully proves natural dialogue.
- Run at least one 50+ action simulated session with two players and a reload halfway.
- Report exact test commands, failed cases, and unresolved limitations.
