import { describe, expect, it } from 'vitest';
import { InMemoryMultiplayerServer } from './InMemoryMultiplayerServer';
import type { AuthorityFreeCommand, MultiplayerClient } from './types';

function action(type: AuthorityFreeCommand['type'], fields: Record<string, unknown> = {}, commandId: string = crypto.randomUUID()): AuthorityFreeCommand {
  return { type, commandId, ...fields } as AuthorityFreeCommand;
}

async function twoClients() {
  const server = new InMemoryMultiplayerServer();
  const aria = server.connect({ userId: 'user-a', displayName: 'An' });
  const borin = server.connect({ userId: 'user-b', displayName: 'Bình' });
  const host = await aria.createRoom();
  await borin.joinRoom(host.room.inviteCode);
  return { server, aria, borin };
}

async function sendOk(client: MultiplayerClient, command: AuthorityFreeCommand) {
  const session = client.getSession();
  if (!session) throw new Error('Missing session');
  const result = await client.send(command, session.room.version);
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
  return result;
}

describe('Phase 2A multiplayer authority', () => {
  it('creates and joins a two-seat room without an impersonation control', async () => {
    const { aria, borin } = await twoClients();
    expect(aria.getSession()).toMatchObject({ seat: 'player-a', characterId: 'pc-aria', connection: 'online' });
    expect(borin.getSession()).toMatchObject({ seat: 'player-b', characterId: 'pc-borin', connection: 'online' });

    const forged = action('submit_action', { text: 'Tôi hành động.', actorId: 'player-b', characterId: 'pc-borin' }) as AuthorityFreeCommand;
    const result = await sendOk(aria, forged);
    const submitted = result.events.find((event) => event.data.type === 'action_submitted');
    expect(submitted?.actorId).toBe('player-a');
    expect(submitted?.data).toMatchObject({ characterId: 'pc-aria' });
    expect(await aria.send(action('roll_dice', { die: 20, modifier: 999 }), aria.getSession()!.room.version)).toMatchObject({ ok: false, code: 'INVALID' });
  });

  it('serializes two clients racing on the same version and preserves idempotency', async () => {
    const { aria, borin } = await twoClients();
    const version = aria.getSession()!.room.version;
    const first = action('submit_action', { text: 'Aria xem xét cánh cửa.' }, 'same-a');
    const second = action('submit_action', { text: 'Borin nghe phía sau.' }, 'same-b');
    const [a, b] = await Promise.all([aria.send(first, version), borin.send(second, version)]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect([a, b].find((result) => !result.ok)).toMatchObject({ code: 'CONFLICT' });

    const winner = a.ok ? { client: aria, command: first, result: a } : { client: borin, command: second, result: b };
    const replay = await winner.client.send(winner.command, version);
    expect(replay).toMatchObject({ ok: true, replayed: true });
    expect(replay.ok && replay.room.record.events.filter((event) => event.commandId === winner.command.commandId && event.data.type === 'action_submitted')).toHaveLength(1);
  });

  it('enforces initiative and rejects the wrong player in combat', async () => {
    const { aria, borin } = await twoClients();
    await sendOk(aria, action('talk_to_sera'));
    await sendOk(aria, action('start_combat'));
    const wrongTurn = await borin.send(action('attack', { targetId: 'enemy-rat' }), borin.getSession()!.room.version);
    expect(wrongTurn).toMatchObject({ ok: false, code: 'INVALID' });
    const attack = await sendOk(aria, action('attack', { targetId: 'enemy-rat' }));
    expect(attack.events.some((event) => event.data.type === 'attack_resolved')).toBe(true);
  });

  it('supports designated responder and wait-for-both exploration policies', async () => {
    const { aria, borin } = await twoClients();
    await aria.setExplorationPolicy('designated', 'pc-borin');
    expect(await aria.send(action('submit_action', { text: 'Aria thử trả lời.' }), aria.getSession()!.room.version)).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    await sendOk(borin, action('submit_action', { text: 'Borin trả lời.' }));

    await aria.setExplorationPolicy('all');
    const sharedVersion = aria.getSession()!.room.version;
    const pending = await aria.send(action('submit_action', { text: 'Aria đồng ý.' }, 'all-a'), sharedVersion);
    expect(pending).toMatchObject({ ok: false, code: 'WAITING_FOR_PARTNER' });
    const committed = await borin.send(action('submit_action', { text: 'Borin cũng đồng ý.' }, 'all-b'), sharedVersion);
    expect(committed.ok).toBe(true);
    const texts = committed.ok ? committed.room.record.events.flatMap((event) => event.data.type === 'action_submitted' ? [event.data.text] : []) : [];
    expect(texts).toEqual(expect.arrayContaining(['Aria đồng ý.', 'Borin cũng đồng ý.']));
  });

  it('restores authoritative state and event log after disconnect/reconnect', async () => {
    const { aria, borin } = await twoClients();
    const before = borin.getSession()!.room.record.events.length;
    await borin.disconnect();
    await sendOk(aria, action('talk_to_sera'));
    const restored = await borin.reconnect(borin.getSession()!.room.roomId);
    expect(restored.connection).toBe('online');
    expect(restored.room.state.quest.spokeToSera).toBe(true);
    expect(restored.room.record.events.length).toBeGreaterThan(before);
    expect(restored.room.version).toBe(restored.room.state.version);
  });

  it('keeps concurrent purchases and sales consistent across both inventories', async () => {
    const { aria, borin } = await twoClients();
    await sendOk(aria, action('talk_to_sera'));
    const version = aria.getSession()!.room.version;
    const [buyA, buyB] = await Promise.all([
      aria.send(action('buy_item', { catalogId: 'healing-potion' }, 'buy-a'), version),
      borin.send(action('buy_item', { catalogId: 'healing-potion' }, 'buy-b'), version),
    ]);
    expect([buyA.ok, buyB.ok].filter(Boolean)).toHaveLength(1);
    const loser = buyA.ok ? borin : aria;
    const loserCommand = buyA.ok ? action('buy_item', { catalogId: 'healing-potion' }, 'buy-b-retry') : action('buy_item', { catalogId: 'healing-potion' }, 'buy-a-retry');
    await sendOk(loser, loserCommand);

    const state = aria.getSession()!.room.state;
    for (const character of Object.values(state.characters)) {
      expect(character.gold).toBe(10);
      expect(character.inventory.filter((id) => state.items[id]?.catalogId === 'healing-potion')).toHaveLength(1);
    }

    const potion = state.characters['pc-aria'].inventory.find((id) => state.items[id]?.catalogId === 'healing-potion')!;
    await sendOk(aria, action('sell_item', { itemId: potion }));
    const restored = borin.getSession()!.room.state;
    expect(restored.characters['pc-aria'].gold).toBe(15);
    expect(restored.items[potion]).toBeUndefined();
  });
});
