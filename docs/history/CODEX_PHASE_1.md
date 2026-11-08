# Copy this into Codex in VS Code — phase 1

You are the primary engineer of a new, standalone two-player D&D AI Dungeon Master web project. The attached repo has specs in `README.md`, `AGENTS.md`, `rules/` and `docs/`. Read all of them before code.

**Task: Build ONLY Phase 1, an offline, zero-cost, deterministic vertical slice.**

Deliver:
- TypeScript domain package for campaign state, two PCs, one NPC, one room, one inventory item, dice roller (injectable RNG in tests), ability/skill check, a simple combat round, immutable game events, replay and save/load JSON.
- Minimal responsive React/Vite UI with two player panes, scene narration (mock provider), action input, dice outcomes, event log, save/load controls.
- `MockDM` returning coherent canned/templated narration; no external API keys and no claim of a real AI integration.
- Tests covering at least acceptance tests 1, 3, 5, 6, 9, 12 and 14 (simulate the two-player race using the domain command handler). Explain any tests deferred to online mode.
- `README` setup instructions `npm install`, `npm run dev`, `npm test`, `npm run build` and the exact verified results.

Rules:
- NO paid services, NO billing, NO external LLM calls. NO fake backend secrets in browser code.
- NO writing in original Story project.
- Source of truth is committed events; AI/mock text does not mutate state.
- Avoid big frameworks or libraries without reason. Prefer simple strong types and explicitly validate commands.
- Keep `DMProvider` interface ready for a later Gemini Free Tier adapter on the server, but DO NOT implement API until Phase 1 passes.
- At end provide a short file list, tests actually run, and known limitations. Don't mark incomplete code as complete.

Please start by producing a concise implementation plan with the file tree and tests; then implement and verify in this single task.
