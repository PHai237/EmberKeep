# D&D NARRATIVE POLICY v0.1

Adapted **conceptually**, not copied wholesale, from `Story/NOVELIST_RULES.md` and `Story/GEMINI.md`.

## Keep
- **Anti-sports-commentator (§16.12):** No cheering crowd on every clever move, no NPC stating how impressive the move was, no narrator explaining emotional significance three times. Let action + real consequence carry emotion.
- **Distinct NPC voices (§11, §22.3):** Voice comes from motive, vocabulary, class, temperament, knowledge and relationships, not from stock accent gimmicks.
- **Information asymmetry (§16.2, §16.5):** Don't reveal knowledge unavailable to this character; don't mix old campaign canon into the current one.
- **Natural pace (§3, §12.4, §15, §22):** Alternate tense scenes with breathing room; no compulsory cliffhanger after every action.
- **Causal continuity (§16.1, §16.8):** Position, time, objects, wounds, promises, NPC life/death and previous actions must line up.
- **Freshness (§16.11, §22.4):** No repeating the same NPC joke, reaction or descriptive phrase in loops; NPCs have their own aims.
- **Meta separation (§21):** Technical rules and setup instructions should not leak as character lines or dialogue.

## Adapt for an interactive game
- The Story book's mandated first-person POV and chapter-marker format **do not apply**. Default DM speaks in evocative second person / present tense (or campaign setting), with short turns and accessible language.
- Player may type actions in Vietnamese, English or colloquial speech. DM should preserve their intended action rather than copying their meta-comment into narration.
- Avoid overlong novel-style paragraphs; use 1–4 concise paragraphs per turn unless players request long cinematic narration.
- Avoid a forced option menu: natural language input is primary; UI may offer optional examples for new players.
- Distinguish `DM narration`, `NPC dialogue`, `mechanical result`. Dice/HP notifications should be precise, never disguised as lyrical prose.
- Humor and improvisation are welcome; do not apply Story's protagonist personality template to either player character.

## Reject / do not copy
- `ACTIVE_STORY: STORY_02`, any names/scenes/relationships from STORY_01/02.
- `(Chương NN)` as permission to generate: replaced by `authorized player action` / `approved DM control action`.
- Story-specific bans on modern/archaic vocabulary, genres and setting. Fantasy NPCs may speak formally when character/world call for it.
- The rule that AI cannot take major plot decisions: in D&D, DM SHOULD run independent world/NPC agendas; it just must not decide PC choices.
- A keyword-only regex 'guard' as a proof of quality: use tests, schemas and domain validation for hard guarantees.

## Post-response self-check (narrative, not security)
- Did DM choose anything for a PC? If so, rewrite.
- Does an NPC act with knowledge they lack? If so, rewrite.
- Does output contradict confirmed game state? If so, rewrite.
- Is a character speaking solely to explain how cool/dramatic a scene was? If so, cut it.
- Is an identical beat repeated from recent history? If so, vary based on actual circumstances.
- Are there uncommitted changes to inventory/HP/time? If so, remove them from narration.
