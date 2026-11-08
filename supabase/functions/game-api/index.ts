import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { GameEngine } from '../../../src/domain/engine.ts';
import { MockDM } from '../../../src/dm/MockDM.ts';
import type { CharacterId, GameCommand } from '../../../src/domain/types.ts';
import { corsHeaders } from '../_shared/cors.ts';

type Json = Record<string, unknown>;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function fail(code: string, message: string, status = 400): Response {
  return response({ error: { code, message } }, status);
}

function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error('INVALID_INPUT');
  return value.trim();
}

function sanitizeCommand(value: unknown): Json {
  if (!value || typeof value !== 'object') throw new Error('INVALID_COMMAND');
  const input = value as Json;
  const type = text(input.type, 40);
  const commandId = text(input.commandId, 100);
  switch (type) {
    case 'edit_character': {
      const patch = input.patch as Json;
      if (!patch || typeof patch !== 'object') throw new Error('INVALID_COMMAND');
      return { type, commandId, patch: { name: text(patch.name, 40), ancestry: text(patch.ancestry, 40), className: text(patch.className, 40) } };
    }
    case 'submit_action': return { type, commandId, text: text(input.text, 300) };
    case 'roll_dice': {
      const die = Number(input.die);
      const modifier = Number(input.modifier);
      if (![4, 6, 8, 10, 12, 20, 100].includes(die) || !Number.isInteger(modifier) || modifier < -10 || modifier > 20) throw new Error('INVALID_DICE');
      return { type, commandId, die, modifier };
    }
    case 'pickup_item':
    case 'drop_item':
    case 'sell_item':
    case 'use_item': return { type, commandId, itemId: text(input.itemId, 100) };
    case 'buy_item': return { type, commandId, catalogId: text(input.catalogId, 40) };
    case 'attack': return { type, commandId, targetId: 'enemy-rat' };
    case 'move': return { type, commandId, to: 'courtyard' };
    case 'talk_to_sera':
    case 'inspect_chest':
    case 'start_combat':
    case 'end_turn': return { type, commandId };
    default: throw new Error('INVALID_COMMAND');
  }
}

function inviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

async function rpc(name: string, args: Json) {
  const { data, error } = await service.rpc(name, args);
  if (error) throw new Error(`${error.code}:${error.message}`);
  return data;
}

async function loadRoom(roomId: string, userId: string) {
  const { data: member, error: memberError } = await service.from('room_members').select('*').eq('room_id', roomId).eq('user_id', userId).maybeSingle();
  if (memberError || !member) throw new Error('FORBIDDEN');
  const { data: room, error: roomError } = await service.from('game_rooms').select('*').eq('id', roomId).single();
  if (roomError || !room) throw new Error('ROOM_NOT_FOUND');
  const { data: members, error: membersError } = await service.from('room_members').select('*').eq('room_id', roomId).order('seat');
  if (membersError) throw new Error('ROOM_LOAD_FAILED');
  const record = room.snapshot;
  const engine = new GameEngine({ record });
  return { room, member, members: members ?? [], engine };
}

function sessionView(context: Awaited<ReturnType<typeof loadRoom>>, user: { id: string }, displayName: string) {
  const { room, member, members, engine } = context;
  return {
    identity: { userId: user.id, displayName },
    seat: member.seat,
    characterId: member.character_id,
    connection: 'online',
    room: {
      roomId: room.id,
      inviteCode: room.invite_code,
      ownerId: room.owner_id,
      version: room.version,
      record: engine.exportRecord(),
      state: engine.state,
      members: members.map((entry) => ({
        userId: entry.user_id, displayName: entry.display_name, seat: entry.seat,
        characterId: entry.character_id, connected: entry.connected,
      })),
      explorationPolicy: room.exploration_policy,
      designatedCharacterId: room.designated_character_id,
      waitingFor: members.filter((entry) => room.exploration_policy === 'all' && !room.pending_actions?.[entry.seat]).map((entry) => entry.character_id),
    },
  };
}

async function commitActions(
  roomId: string,
  callerUserId: string,
  expectedVersion: number,
  actions: Array<{ userId: string; command: Json }>,
) {
  const context = await loadRoom(roomId, callerUserId);
  if (context.room.version !== expectedVersion) return { ok: false, code: 'CONFLICT', message: 'Campaign đã thay đổi.' };
  const startingVersion = context.engine.state.version;
  const commandIds: Array<{ id: string; userId: string }> = [];
  for (const action of actions) {
    const actor = context.members.find((member) => member.user_id === action.userId);
    if (!actor) return { ok: false, code: 'FORBIDDEN', message: 'Người chơi không thuộc phòng.' };
    const command = {
      ...action.command,
      actorId: actor.seat,
      characterId: actor.character_id,
      expectedVersion: context.engine.state.version,
    } as GameCommand;
    const result = context.engine.dispatch(command);
    if (!result.ok) return { ok: false, code: result.code, message: result.message };
    const dm = await new MockDM().narrate(result.events[0], context.engine.state);
    context.engine.addNarration(`narration-${action.command.commandId}`, dm.basedOnEventId, [dm.narration, ...dm.npcSpeech.map((line) => `“${line.text}”`)].join('\n\n'));
    commandIds.push({ id: String(action.command.commandId), userId: action.userId });
  }
  const events = context.engine.eventLog.filter((event) => event.seq > startingVersion);
  const commit = await rpc('commit_game_command', {
    p_room_id: roomId, p_actor_user_id: callerUserId, p_expected_version: expectedVersion,
    p_new_version: context.engine.state.version, p_record: context.engine.exportRecord(), p_events: events,
    p_command_ids: commandIds,
  });
  if (!commit?.ok) return { ok: false, code: commit?.code ?? 'CONFLICT', message: 'Không thể commit command.' };
  return { ok: true, events: commit.replayed ? [] : events, replayed: Boolean(commit.replayed) };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return fail('METHOD_NOT_ALLOWED', 'Chỉ hỗ trợ POST.', 405);
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) return fail('SERVER_CONFIG', 'Supabase server secrets chưa được cấu hình.', 503);

  const authorization = request.headers.get('Authorization') ?? '';
  const auth = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: { user }, error: authError } = await auth.auth.getUser();
  if (authError || !user) return fail('UNAUTHENTICATED', 'Phiên đăng nhập không hợp lệ.', 401);

  let body: Json;
  try { body = await request.json(); } catch { return fail('INVALID_JSON', 'Request không phải JSON hợp lệ.'); }
  try {
    const action = text(body.action, 40);
    const displayName = typeof body.displayName === 'string' ? text(body.displayName, 40) : 'Người chơi';

    if (action === 'create_room') {
      const roomId = crypto.randomUUID();
      const engine = new GameEngine({ campaignId: roomId });
      await rpc('create_game_room', {
        p_room_id: roomId, p_invite_code: inviteCode(), p_owner_id: user.id, p_display_name: displayName,
        p_record: engine.exportRecord(), p_events: engine.eventLog, p_version: engine.state.version,
      });
      return response({ data: sessionView(await loadRoom(roomId, user.id), user, displayName) });
    }

    if (action === 'join_room') {
      const roomId = await rpc('join_game_room', { p_invite_code: text(body.inviteCode, 8), p_user_id: user.id, p_display_name: displayName });
      return response({ data: sessionView(await loadRoom(roomId, user.id), user, displayName) });
    }

    const roomId = text(body.roomId, 60);
    const context = await loadRoom(roomId, user.id);
    if (action === 'disconnect') {
      await service.from('room_members').update({ connected: false, last_seen_at: new Date().toISOString() }).eq('room_id', roomId).eq('user_id', user.id);
      return response({ data: sessionView(await loadRoom(roomId, user.id), user, context.member.display_name) });
    }
    await service.from('room_members').update({ connected: true, last_seen_at: new Date().toISOString() }).eq('room_id', roomId).eq('user_id', user.id);

    if (action === 'get_room') return response({ data: sessionView(context, user, context.member.display_name) });

    if (action === 'set_exploration') {
      const policy = text(body.policy, 20);
      const designated = typeof body.designatedCharacterId === 'string' ? body.designatedCharacterId : null;
      await rpc('set_room_exploration', { p_room_id: roomId, p_actor_user_id: user.id, p_policy: policy, p_designated_character_id: designated });
      return response({ data: sessionView(await loadRoom(roomId, user.id), user, context.member.display_name) });
    }

    if (action !== 'command') return fail('INVALID_ACTION', 'Action không được hỗ trợ.');
    const command = sanitizeCommand(body.command);
    const expectedVersion = Number(body.expectedVersion);
    if (!Number.isInteger(expectedVersion)) return fail('INVALID_VERSION', 'Version không hợp lệ.');

    const { data: duplicate } = await service.from('processed_commands').select('command_id').eq('room_id', roomId).eq('command_id', command.commandId).maybeSingle();
    if (duplicate) {
      const fresh = await loadRoom(roomId, user.id);
      return response({ data: { ok: true, events: [], room: sessionView(fresh, user, context.member.display_name).room, replayed: true } });
    }

    if (!context.engine.state.combat && context.room.exploration_policy === 'designated' && context.room.designated_character_id !== context.member.character_id) {
      return response({ data: { ok: false, code: 'FORBIDDEN', message: 'GM đang chờ nhân vật khác phản hồi.', room: sessionView(context, user, context.member.display_name).room } });
    }

    let actions = [{ userId: user.id, command }];
    if (!context.engine.state.combat && context.room.exploration_policy === 'all') {
      const queued = await rpc('queue_exploration_action', {
        p_room_id: roomId, p_actor_user_id: user.id, p_expected_version: expectedVersion,
        p_command: { userId: user.id, command },
      });
      if (!queued?.ok) return response({ data: { ok: false, code: queued?.code ?? 'CONFLICT', message: 'Không thể xếp hàng hành động.' } });
      if (!queued.ready) {
        const waiting = await loadRoom(roomId, user.id);
        return response({ data: { ok: false, code: 'WAITING_FOR_PARTNER', message: 'Đang chờ người chơi còn lại.', room: sessionView(waiting, user, context.member.display_name).room } });
      }
      actions = Object.keys(queued.actions).sort().map((seat) => queued.actions[seat]);
    }

    const committed = await commitActions(roomId, user.id, expectedVersion, actions);
    const fresh = await loadRoom(roomId, user.id);
    return response({ data: { ...committed, room: sessionView(fresh, user, context.member.display_name).room } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    const code = message.split(':')[0] || 'SERVER_ERROR';
    return fail(code, message, code === 'FORBIDDEN' ? 403 : code === 'ROOM_NOT_FOUND' ? 404 : 400);
  }
});
