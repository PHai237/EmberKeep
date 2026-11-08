# Emberkeep UI v0.5 — Design + handoff

## Goals

- Narrative-first D&D experience: GM prose and player actions occupy the primary workspace.
- The side panel shows only party, dice, inventory, character information and trade.
- GM/engine determines whose turn it is. There is no player-actor switcher.
- No decorative microcopy, redundant corner labels, fake mission counts or hidden controls.
- Keep Vietnamese punctuation and combining marks legible. UI uses only system Vietnamese-capable sans-serif fonts; no font download and no letter spacing on Vietnamese text.

## What changed from v0.4

- Reworked `src/ui/App.tsx` and replaced `src/ui/styles.css` with a concise, legible dark-fantasy design.
- Removed brand slogan, large banner chapter text, "chronicle" divider, player `HÀNH ĐỘNG` stamp, extra technical explanation in composer, persistent success toast and sidebar quest card.
- Simplified narrative messages, inline rule/dice results, meaningful action choices, mobile layout and modal surfaces.
- Move task progress into **Nhật ký**; JSON import/export remains under **Cài đặt**.
- Did **not** touch `src/domain`, `src/rules`, `src/persistence`, `src/dm` or game logic.

## Boundaries / honest limitations

- This remains an offline MockDM demo. Free action text is logged, not interpreted with a live model.
- The local mock game uses Aria for exploration actions and initiative determines combat turns. Actual multiplayer identity requires server-side authentication; the UI deliberately does not expose an impersonation selector.
- Inventory and character tabs show the automatically determined active character. Viewer-only character browsing is a future enhancement and must not change the actor identity.
- Original source was built on Windows. TypeScript verification passed here, but full Vite/Vitest tests could not run on this Linux environment because the original ZIP contains Windows native bindings and npm package installation was not completed.

## References (study only; code not copied)

- DiceFrame — multiplayer AI GM with shared state: https://github.com/diceframe/diceframe
- Vellum — narrative-first AI DM / persistent campaign: https://github.com/bunkerlab-net/vellum
- AetherTable — narration and inline deterministic rolls: https://github.com/IPedrax/AetherTable
- CozyVTT — separated panels and character resources: https://github.com/CheekyChinchilla/CozyVTT
- RPG Styled UI — structured fantasy UI hierarchy: https://github.com/Xbozon/rpg-styled-ui
- Nexus VTT — character tools separated from table state: https://github.com/joelmale/nexusVTT

## Local validation

```powershell
npm install
npm test
npm run build
npm run dev
```

The standalone `Emberkeep_v0.5_UI_Preview.html` is a self-contained *visual interaction demo*. It is not a game build, and does not persist rolls or messages. The React source is the real application.
