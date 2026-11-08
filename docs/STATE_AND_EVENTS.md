# Canon data & event store contract

## Key tables / document collections
- `campaigns`: id, owner, rule edition, setting, model preference, public config, version.
- `participants`: campaign_id, participant_id, player id/guest token hash, seat, role, connected status.
- `characters`: id, campaign_id, controller_id, character build (validated), position, HP/resources, inventory, conditions, level.
- `world_entities`: id, campaign_id, type, location, live/dead/disabled state, schedule, objective, relationships.
- `facts`: id, campaign_id, assertion, visibility (`public|known_to|dm_only`), evidence_event_id, truth status (`confirmed|rumor|retconned`), valid time.
- `events`: monotonic seq, id, campaign_id, actor, command id/idempotency key, event type, public payload, private payload, created_at, causation, previous version.
- `snapshots`: campaign_id, event_seq, state JSON, hash, created_at; rebuild by replay when needed.
- `sessions`: started/ended time, scene, summary with references to events, unresolved arcs.
- `rule_overrides`: campaign_id, rule key, interpretation, approved_by, version.

## One source of truth
1. Submitted command ≠ committed event.
2. AI suggestion ≠ committed event.
3. Summary ≠ canonical fact.
4. The current snapshot is only a cache of a deterministic fold over events.
5. Every fact that affects gameplay should have provenance (event id, authored setting rule, or approved DM setup).
6. All reads and writes must be scoped by campaign_id; DM-only fields never reach public API responses.

## Example: inventory transfer
PC A submits `attempt_pickup(itemId)`. Server checks ownership/location/phase and records a dice or contest result if required. On success, transaction creates `item_transferred` and updates both views; on failure, no transfer. Replaying the identical idempotency key MUST NOT duplicate the item.

## Knowledge isolation
Knowledge is not only about UI: `known_to` must be enforced before forming each player's notification. AI can receive DM-only context on the server, but model output is filtered against visibility and evaluated before displaying. Do not stream unvalidated model tokens directly to the browser when they can disclose secrets.

## Persistence
Keep the latest N verbatim turns for voice continuity. Retrieve relevant facts by identity/location/quest/evidence links; include concise recent summary with references. Never rely on a single lossy summary as ground truth. Offer campaign export/import and versioned migrations.
