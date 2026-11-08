# Technical architecture & delivery order

## Logical diagram
```
Browser A ─┐
           ├── HTTPS API / Session Server ─── database (campaign, players, events, snapshots)
Browser B ─┘           │          │
                       │          ├── auth/permissions + turn state machine
                       │          ├── deterministic rules + random dice service
                       │          └── context builder + memory retrieval
                       │                        │
                       └── DMProvider adapter ─┼── MockDM (default, always free)
                                                └── Gemini API (only verified Free Tier)
```

## MVP phases
**Phase 1 — Offline vertical slice:** Build rules and state as pure TypeScript. Two sample PCs; one room; one NPC; one check; one combat; load/save local JSON. Mock DM only. Unit tests verify event replay and invariants. No external services required.

**Phase 2 — AI adapter:** Add strict JSON schema, model request budget and context selection; configure Gemini API via server environment variable. Call model only after checking free plan/model/quota. On `429` or invalid output, gracefully pause or retry (bounded), never charge silently.

**Phase 3 — Online two-player:** Introduce campaign/room IDs, invite tokens, guest player identity and persistence; add RLS/auth/permissions. Server authoritative dice and events, idempotent commands, optimistic concurrency. Easy character creation and mobile-friendly interface.

**Phase 4 — Rule coverage & polish:** SRD classes, features, spells, monsters; combat UX; fast session resume, human-readable journal and scene cards.

## UX requirements
- 'Tạo phòng' → 'Mời bạn' → 'Tạo nhân vật' → 'Bắt đầu' in a few clicks.
- New players get optional contextual guidance (what dice, AC and skill checks mean).
- Distinct channels: player actions, DM narration, out-of-character talk, system/dice.
- Each player sees the SAME public scene but may receive private clues; never show DM-only records in frontend/devtools/API.
- Recover from refresh/disconnect, duplicate requests, concurrent actions, AI timeout and quota exhaustion.
- Do not require IDE, terminal or Google login from guest player.

## Database choice and cost
A practical choice is Supabase Free for auth/Postgres + Realtime and Cloudflare Free for static frontend / server functions, but **confirm current free limits and keep an export/import path**. No stack is automatically unlimited or permanently free. Keep API keys server-side and never configure billing autopay just to support this project.

## AI response contract (illustration)
```json
{
  "narration": "Ánh đuốc hắt lên ổ khóa cũ. Chiếc chìa không khớp.",
  "npc_speech": [],
  "proposed_check": { "kind": "dexterity", "skill": "sleight_of_hand", "dc": 13 },
  "suggested_events": [],
  "dm_private_notes": "The guard is behind the western door."
}
```
The backend validates check and applies rule-specific logic. `dm_private_notes` NEVER goes to player client. DM does not decide success before the engine rolls.
