# Story → D&D mapping (based on uploaded Story(1).zip)

| Story file/section | Decision | D&D translation |
|---|---|---|
| `GEMINI.md` §0 Active Story | Adapt | `campaign_id`, `scene_id` plus isolation; no cross-campaign canon |
| `GEMINI.md` §1 Write permissions | Adapt | actions only from correct player + valid phase + permission |
| `GEMINI.md` §3 Source hierarchy | Keep + strengthen | committed events/state > summary > AI suggestion; explicit approved house rules |
| `GEMINI.md` §4 Anti-NPC idle loop | Keep | NPC schedules, agendas, varied behavior and genuine relationships |
| `GEMINI.md` §6 Post-write audit | Keep + strengthen | event validation and narrative consistency checks before delivery |
| `NOVELIST_RULES.md` §11 | Keep | distinct NPC voice/agency |
| `NOVELIST_RULES.md` §16.2/16.5 | Adapt | no head-hopping/memory leakage; no first-person mandatory voice |
| `NOVELIST_RULES.md` §16.12 | Keep strongly | ban commentator/highlight reel dialogue and forced crowd reactions |
| `NOVELIST_RULES.md` §21 | Adapt | no player meta instructions in NPC dialogue |
| `NOVELIST_RULES.md` §22 | Keep flexibly | satisfying causal arcs without forced drama and cliffhangers |
| `MASTER_STORY_RULES.md` | Keep the pattern | lightweight router file that points to rules, never duplicates all policies |
| `guard_novel.py` | Inspiration only | server validators + authorization + state machine; not keyword regex |
| `audit_story.py` | Inspiration only | real state invariants and replayable event integrity tests |
| `CHARACTERS.md` | Adapt | PC sheet, NPC sheet, relationship graph, `known_to` |
| `CANON_TRACKER.md` | Adapt | canonical facts with provenance/effective event |
| `TIMELINE.md` | Adapt | append-only game events + derived timeline |
| `WORLDBUILDING.md` | Adapt | campaign setting & world rules, separate DM secrets |
| `READER_SYNC/` & `graphify-out/` | Exclude from MVP | reading/publishing tooling and caches don't belong in game runtime |

## Important audit observations
- `guard_novel.py` bases many write permissions on command names and keyword matching. That may help an IDE workflow but is not a security boundary for a multiplayer web application.
- `audit_story.py` checks required files and a few fixed names in STORY_02; it does **not** verify entire continuity or prove absence of canon contradictions. Do not carry its `PASS` notion into D&D mechanically.
- Canon in Story is primarily prose/Markdown; in D&D, mutable game state should be typed data and derived from immutable events, while readable notes are secondary.
