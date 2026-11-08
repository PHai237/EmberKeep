# Emberkeep v0.2.0 — Chat-first prototype

## What's new

- Two-column, ChatGPT-style layout: tools and characters on the left; DM/player messages and interactive suggestions in the middle; a compact composer at the bottom.
- Real event log presented as player messages, DM narration and system confirmations. The journal drawer still contains the complete chronological event history.
- MockDM suggestions are derived from canonical campaign state (`src/dm/choices.ts`). Free-text messages are **intent only**; they are never mistaken for completed state-changing actions.
- XP and character level are no longer hard-coded to level 1. The two PCs receive 50 XP each after defeating the rat and 250 XP each upon completing the introductory quest; they reach level 2. Full class leveling choices are future work.
- Small demo gold/item economy: Sera sells torch, healing potion and rations, with validated purchases, sales, and healing-potion consumption. Currency and ownership are stored as game events and survive save/load. Prices are **demo fixtures**, not an official complete D&D economy.
- Battle concludes when the only opponent is defeated, allowing the quest to finish.
- Vietnamese display uses native Segoe UI / Noto Sans fallback with normal letter spacing and generous line-height; no external font dependency.
- Saves from v0.1.x are replayed with default gold/XP values; old events are preserved.
- Source remains completely offline: no API key, paid API, backend or actual online multiplayer.

## Getting started

```powershell
npm install
npm test
npm run build
npm run dev
```

To test the economy: select Aria, talk to Sera, open the **Giao dịch** sidebar tab, buy a potion, check it under **Túi đồ**, then sell it or use it after taking damage in combat. To complete the quest, investigate the chest, collect the key, defeat the rat, and open the courtyard door.

## Boundaries and limitations

- **Mock GM is not Gemini or a live LLM.** Its dialogue is authored by `MockDM.ts` and suggestions come from `choices.ts`.
- Free-text player messages are logged as intentions; they do not invoke arbitrary world mutations. This is deliberate until a validated AI intent-to-command adapter exists.
- Two characters are simulated locally in one browser, **not two remote clients**. For real co-op, authentication and a server-authoritative transaction layer are required.
- Current gold/shop and XP are demo mechanics only. They do not implement a full SRD character progression, merchant inventory or pricing model.
- Local checksum detects accidental modification but is **not** cryptographic protection against a malicious user. Do not use localStorage as a multiplayer source of truth.
- **Verification in this environment:** `tsc -p tsconfig.app.json --noEmit` passed; a Node.js runtime regression covering commerce, ownership, progression, healing, legacy save migration and replay passed; React static rendering passed. **Vitest/Vite build was not verified here** because the uploaded dependencies contain Windows-only native Rolldown binaries and package installation could not complete. Re-run `npm test` and `npm run build` on your Windows development machine.

## Suggested next milestone

Phase 2 should add a server-side campaign store with real-time rooms, structured DM response (`narration`, `suggested_actions`, `proposed_events`), an intent validator, canonical state retrieval and conflict-safe writes. Only then connect a Gemini Free Tier model. Keep the DM unable to directly edit character level, currency or inventory.
