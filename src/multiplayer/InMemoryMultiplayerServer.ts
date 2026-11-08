import { MockDM } from '../dm/MockDM';
import { GameEngine } from '../domain/engine';
import type { CharacterId, GameCommand, GameEvent } from '../domain/types';
import type { AuthIdentity, AuthorityFreeCommand, ExplorationPolicy, MultiplayerClient, MultiplayerCommandResult, RoomListener, RoomMember, RoomSnapshot, Seat, SessionView } from './types';

interface PendingAction {
  identity: AuthIdentity;
  member: RoomMember;
  command: AuthorityFreeCommand;
  expectedVersion: number;
}

interface RoomData {
  id: string;
  inviteCode: string;
  ownerId: string;
  engine: GameEngine;
  members: Map<string, RoomMember>;
  policy: ExplorationPolicy;
  designated: CharacterId | null;
  pending: Map<Seat, PendingAction>;
  processed: Map<string, MultiplayerCommandResult>;
  listeners: Map<string, Set<RoomListener>>;
}

function randomInvite(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

export class InMemoryMultiplayerServer {
  private readonly rooms = new Map<string, RoomData>();
  private readonly inviteIndex = new Map<string, string>();
  private readonly queues = new Map<string, Promise<void>>();
  private roomSequence = 0;

  connect(identity: AuthIdentity): MultiplayerClient {
    return new InMemoryClient(this, identity);
  }

  async create(identity: AuthIdentity): Promise<SessionView> {
    const roomId = `room-${++this.roomSequence}`;
    let inviteCode = randomInvite();
    while (this.inviteIndex.has(inviteCode)) inviteCode = randomInvite();
    const engine = new GameEngine({ campaignId: roomId });
    const member: RoomMember = { ...identity, seat: 'player-a', characterId: 'pc-aria', connected: true };
    const room: RoomData = {
      id: roomId, inviteCode, ownerId: identity.userId, engine,
      members: new Map([[identity.userId, member]]), policy: 'open', designated: null,
      pending: new Map(), processed: new Map(), listeners: new Map(),
    };
    this.rooms.set(roomId, room);
    this.inviteIndex.set(inviteCode, roomId);
    return this.view(room, identity, 'online');
  }

  async join(identity: AuthIdentity, rawCode: string): Promise<SessionView> {
    const roomId = this.inviteIndex.get(rawCode.trim().toUpperCase());
    const room = roomId && this.rooms.get(roomId);
    if (!room) throw new Error('ROOM_NOT_FOUND: Mã phòng không tồn tại.');
    const existing = room.members.get(identity.userId);
    if (existing) {
      existing.connected = true;
      this.notify(room);
      return this.view(room, identity, 'online');
    }
    if (room.members.size >= 2) throw new Error('ROOM_FULL: Phòng đã đủ hai người chơi.');
    room.members.set(identity.userId, { ...identity, seat: 'player-b', characterId: 'pc-borin', connected: true });
    this.notify(room);
    return this.view(room, identity, 'online');
  }

  async reconnect(identity: AuthIdentity, roomId: string): Promise<SessionView> {
    const room = this.requireRoom(roomId);
    const member = this.requireMember(room, identity.userId);
    member.connected = true;
    this.notify(room);
    return this.view(room, identity, 'online');
  }

  subscribe(identity: AuthIdentity, roomId: string, listener: RoomListener): () => void {
    const room = this.requireRoom(roomId);
    this.requireMember(room, identity.userId);
    const listeners = room.listeners.get(identity.userId) ?? new Set<RoomListener>();
    listeners.add(listener);
    room.listeners.set(identity.userId, listeners);
    return () => listeners.delete(listener);
  }

  async disconnect(identity: AuthIdentity, roomId: string): Promise<void> {
    const room = this.requireRoom(roomId);
    this.requireMember(room, identity.userId).connected = false;
    this.notify(room);
  }

  async setPolicy(identity: AuthIdentity, roomId: string, policy: ExplorationPolicy, designated?: CharacterId): Promise<SessionView> {
    return this.lock(roomId, async () => {
      const room = this.requireRoom(roomId);
      if (room.ownerId !== identity.userId) throw new Error('FORBIDDEN: Chỉ chủ phòng có thể đổi cách chờ phản hồi.');
      if (room.engine.state.combat) throw new Error('INVALID: Không thể đổi quy tắc exploration trong combat.');
      if (policy === 'designated' && !designated) throw new Error('INVALID: Phải chỉ định một nhân vật.');
      if (designated && ![...room.members.values()].some((member) => member.characterId === designated)) throw new Error('INVALID: Nhân vật chưa có người điều khiển trong phòng.');
      room.policy = policy;
      room.designated = policy === 'designated' ? designated ?? null : null;
      room.pending.clear();
      this.notify(room);
      return this.view(room, identity, 'online');
    });
  }

  async submit(identity: AuthIdentity, roomId: string, input: AuthorityFreeCommand, expectedVersion: number): Promise<MultiplayerCommandResult> {
    return this.lock(roomId, async () => {
      const room = this.requireRoom(roomId);
      const member = this.requireMember(room, identity.userId);
      const replay = room.processed.get(input.commandId);
      if (replay) return replay.ok ? { ...replay, replayed: true } : replay;
      if (!member.connected) return { ok: false, code: 'UNAUTHENTICATED', message: 'Kết nối đã đóng.', room: this.snapshot(room) };
      if (expectedVersion !== room.engine.state.version) return { ok: false, code: 'CONFLICT', message: 'Campaign đã thay đổi; hãy đồng bộ và thử lại.', room: this.snapshot(room) };

      if (!room.engine.state.combat && room.policy === 'designated' && room.designated !== member.characterId) {
        return { ok: false, code: 'FORBIDDEN', message: 'GM đang chờ nhân vật khác phản hồi.', room: this.snapshot(room) };
      }
      if (!room.engine.state.combat && room.policy === 'all') {
        room.pending.set(member.seat, { identity, member, command: input, expectedVersion });
        const waiting = [...room.members.values()].filter((entry) => !room.pending.has(entry.seat)).map((entry) => entry.characterId);
        if (waiting.length) {
          const pendingResult: MultiplayerCommandResult = { ok: false, code: 'WAITING_FOR_PARTNER', message: 'Đang chờ người chơi còn lại.', room: this.snapshot(room) };
          room.processed.set(input.commandId, pendingResult);
          this.notify(room);
          return pendingResult;
        }
        const pending = [...room.pending.values()].sort((a, b) => a.member.seat.localeCompare(b.member.seat));
        room.pending.clear();
        let combined: GameEvent[] = [];
        for (const action of pending) {
          const result = await this.commit(room, action.member, action.command, room.engine.state.version);
          if (!result.ok) return result;
          combined = combined.concat(result.events);
          room.processed.set(action.command.commandId, { ...result, events: combined, room: this.snapshot(room) });
        }
        const result: MultiplayerCommandResult = { ok: true, events: combined, room: this.snapshot(room), replayed: false };
        for (const action of pending) room.processed.set(action.command.commandId, result);
        this.notify(room);
        return result;
      }

      const result = await this.commit(room, member, input, expectedVersion);
      room.processed.set(input.commandId, result);
      this.notify(room);
      return result;
    });
  }

  private async commit(room: RoomData, member: RoomMember, input: AuthorityFreeCommand, expectedVersion: number): Promise<MultiplayerCommandResult> {
    const command = { ...input, actorId: member.seat, characterId: member.characterId, expectedVersion } as GameCommand;
    const result = room.engine.dispatch(command);
    if (!result.ok) return { ok: false, code: result.code, message: result.message, room: this.snapshot(room) };
    const anchor = result.events[0];
    const response = await new MockDM().narrate(anchor, room.engine.state);
    const narration = room.engine.addNarration(`narration-${input.commandId}`, response.basedOnEventId, [response.narration, ...response.npcSpeech.map((line) => `“${line.text}”`)].join('\n\n'));
    return { ok: true, events: [...result.events, narration], room: this.snapshot(room), replayed: false };
  }

  private snapshot(room: RoomData): RoomSnapshot {
    return {
      roomId: room.id, inviteCode: room.inviteCode, ownerId: room.ownerId,
      version: room.engine.state.version, record: room.engine.exportRecord(), state: room.engine.state,
      members: [...room.members.values()].map((member) => ({ ...member })),
      explorationPolicy: room.policy, designatedCharacterId: room.designated,
      waitingFor: [...room.members.values()].filter((member) => room.policy === 'all' && !room.pending.has(member.seat)).map((member) => member.characterId),
    };
  }

  private view(room: RoomData, identity: AuthIdentity, connection: SessionView['connection']): SessionView {
    const member = this.requireMember(room, identity.userId);
    return { identity: { ...identity }, room: this.snapshot(room), seat: member.seat, characterId: member.characterId, connection };
  }

  private notify(room: RoomData): void {
    for (const [userId, listeners] of room.listeners) {
      const member = room.members.get(userId);
      if (!member) continue;
      const identity = { userId, displayName: member.displayName };
      for (const listener of listeners) listener(this.view(room, identity, member.connected ? 'online' : 'offline'));
    }
  }

  private requireRoom(roomId: string): RoomData {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('ROOM_NOT_FOUND: Phòng không tồn tại.');
    return room;
  }

  private requireMember(room: RoomData, userId: string): RoomMember {
    const member = room.members.get(userId);
    if (!member) throw new Error('FORBIDDEN: Người dùng không thuộc phòng.');
    return member;
  }

  private lock<T>(roomId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(roomId) ?? Promise.resolve();
    const result = previous.then(operation, operation);
    this.queues.set(roomId, result.then(() => undefined, () => undefined));
    return result;
  }
}

class InMemoryClient implements MultiplayerClient {
  private session: SessionView | null = null;
  private listeners = new Set<RoomListener>();
  private unsubscribeServer: (() => void) | null = null;

  constructor(private readonly server: InMemoryMultiplayerServer, readonly identity: AuthIdentity) {}

  async createRoom(): Promise<SessionView> { return this.attach(await this.server.create(this.identity)); }
  async joinRoom(code: string): Promise<SessionView> { return this.attach(await this.server.join(this.identity, code)); }
  async reconnect(roomId: string): Promise<SessionView> { return this.attach(await this.server.reconnect(this.identity, roomId)); }
  getSession(): SessionView | null { return this.session ? structuredClone(this.session) : null; }
  async send(command: AuthorityFreeCommand, expectedVersion: number): Promise<MultiplayerCommandResult> {
    if (!this.session) return { ok: false, code: 'UNAUTHENTICATED', message: 'Chưa tham gia phòng.' };
    return this.server.submit(this.identity, this.session.room.roomId, command, expectedVersion);
  }
  async setExplorationPolicy(policy: ExplorationPolicy, designated?: CharacterId): Promise<SessionView> {
    if (!this.session) throw new Error('UNAUTHENTICATED: Chưa tham gia phòng.');
    return this.attach(await this.server.setPolicy(this.identity, this.session.room.roomId, policy, designated));
  }
  subscribe(listener: RoomListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  async disconnect(): Promise<void> {
    if (!this.session) return;
    await this.server.disconnect(this.identity, this.session.room.roomId);
    this.unsubscribeServer?.();
    this.unsubscribeServer = null;
    this.session = { ...this.session, connection: 'offline' };
  }
  private attach(view: SessionView): SessionView {
    this.unsubscribeServer?.();
    this.session = view;
    this.unsubscribeServer = this.server.subscribe(this.identity, view.room.roomId, (next) => {
      this.session = next;
      for (const listener of this.listeners) listener(structuredClone(next));
    });
    return structuredClone(view);
  }
}
