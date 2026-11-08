# Emberkeep v0.4 — Cinematic Conversational D&D UI

## Scope
- New dark-fantasy UI with party status and gameplay tools on the left, GM narration and player actions in the center, option cards, and freeform composer.
- No character switcher. This offline mock binds exploration to Aria and uses the combat engine initiative to show who is acting. Multiplayer identity and permissions still require an authenticated server. This demo does **not** claim multiplayer support.
- Import / Export moved to Settings; auto-save remains in localStorage.
- System fonts only (`Segoe UI`, Arial, with a serif used sparingly on display titles). No downloaded or bundled font files. Vietnamese prose uses normal letter-spacing and generous line-height.
- The existing domain engine, inventory, gold, level, XP, shop, save format, and test suite are not changed.

## What is still a mock
- Freeform narration is MockDM. Typing a freeform action does not mutate game mechanics unless mapped to an engine command.
- The sample scene art is an offline bundled SVG, not automatically generated per scene.
- No API, billing, server, or realtime multiplayer was added.

## Local verification in the editing environment
- `tsc -p tsconfig.app.json --noEmit`: PASS (global TypeScript 5.8.3).
- CSS parse (PostCSS): PASS.
- Static HTML preview: rendered in Chromium at 1440x900 and 390x844 with no horizontal overflow.
- Preview interactions tested: dice button, option click, inventory tab.
- `npm test` and `npm run build`: NOT VERIFIED here because the supplied node_modules contains Windows-oriented native dependencies; Linux binding for Rolldown and TypeScript 7 missing.

## Verify on Windows
```
npm install
npm test
npm run build
npm run dev
```
For feedback, view `Emberkeep_v0.4_UI_Preview.html` before installing the patch.
