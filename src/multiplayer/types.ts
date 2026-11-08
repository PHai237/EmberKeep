import type { CampaignRecord, CampaignState, CharacterId, CommandFailure, GameCommand, GameEvent } from '../domain/types';

export type Seat = 'player-a' | 'player-b';
export type ConnectionState = 'connecting' | 'online' | 'reconnecting' | 'offline';
export type ExplorationPolicy = 'open' | 'designated' | 'all';

export type AuthorityFreeCommand = GameCommand extends infer Command
  ? Command extends GameCommand
    ? Omit<Command, 'actorId' | 'characterId' | 'expectedVersion'>
    : never
  : never;

export interface AuthIdentity {
  userId: string;
  displayName: string;
}

export interface RoomMember {
  userId: string;
  displayName: string;
  seat: Seat;
  characterId: CharacterId;
  connected: boolean;
}

export interface RoomSnapshot {
  roomId: string;
  inviteCode: string;
  ownerId: string;
  version: number;
  record: CampaignRecord;
  state: CampaignState;
  members: RoomMember[];
  explorationPolicy: ExplorationPolicy;
  designatedCharacterId: CharacterId | null;
  waitingFor: CharacterId[];
}

export interface SessionView {
  identity: AuthIdentity;
  room: RoomSnapshot;
  seat: Seat;
  characterId: CharacterId;
  connection: ConnectionState;
}

export type MultiplayerErrorCode = CommandFailure['code'] | 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'WAITING_FOR_PARTNER' | 'UNAUTHENTICATED';

export type MultiplayerCommandResult =
  | { ok: true; events: GameEvent[]; room: RoomSnapshot; replayed: boolean }
  | { ok: false; code: MultiplayerErrorCode; message: string; room?: RoomSnapshot };

export type RoomListener = (view: SessionView) => void;

export interface MultiplayerClient {
  readonly identity: AuthIdentity;
  createRoom(): Promise<SessionView>;
  joinRoom(inviteCode: string): Promise<SessionView>;
  reconnect(roomId: string): Promise<SessionView>;
  getSession(): SessionView | null;
  send(command: AuthorityFreeCommand, expectedVersion: number): Promise<MultiplayerCommandResult>;
  setExplorationPolicy(policy: ExplorationPolicy, designatedCharacterId?: CharacterId): Promise<SessionView>;
  subscribe(listener: RoomListener): () => void;
  disconnect(): Promise<void>;
}
