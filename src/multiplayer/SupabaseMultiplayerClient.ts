import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { CharacterId } from '../domain/types';
import type { AuthIdentity, AuthorityFreeCommand, ExplorationPolicy, MultiplayerClient, MultiplayerCommandResult, RoomListener, SessionView } from './types';

interface ApiResponse<T> { data?: T; error?: { code: string; message: string } }

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  displayName: string;
}

export function hasSupabaseConfig(env: ImportMetaEnv = import.meta.env): boolean {
  return Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY);
}

export class SupabaseMultiplayerClient implements MultiplayerClient {
  readonly identity: AuthIdentity = { userId: '', displayName: '' };
  private readonly supabase: SupabaseClient;
  private session: SessionView | null = null;
  private channel: RealtimeChannel | null = null;
  private listeners = new Set<RoomListener>();

  constructor(private readonly config: SupabaseConfig) {
    this.identity.displayName = config.displayName.trim().slice(0, 40) || 'Người chơi';
    this.supabase = createClient(config.url, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }

  async createRoom(): Promise<SessionView> {
    await this.ensureIdentity();
    return this.attach(await this.call<SessionView>('create_room', { displayName: this.identity.displayName }));
  }

  async joinRoom(inviteCode: string): Promise<SessionView> {
    await this.ensureIdentity();
    return this.attach(await this.call<SessionView>('join_room', { inviteCode: inviteCode.trim().toUpperCase(), displayName: this.identity.displayName }));
  }

  async reconnect(roomId: string): Promise<SessionView> {
    await this.ensureIdentity();
    return this.attach(await this.call<SessionView>('get_room', { roomId }));
  }

  getSession(): SessionView | null { return this.session ? structuredClone(this.session) : null; }

  async send(command: AuthorityFreeCommand, expectedVersion: number): Promise<MultiplayerCommandResult> {
    if (!this.session) return { ok: false, code: 'UNAUTHENTICATED', message: 'Chưa tham gia phòng.' };
    const result = await this.call<MultiplayerCommandResult>('command', { roomId: this.session.room.roomId, command, expectedVersion });
    if (result.room) this.update({ ...this.session, room: result.room, connection: 'online' });
    return result;
  }

  async setExplorationPolicy(policy: ExplorationPolicy, designatedCharacterId?: CharacterId): Promise<SessionView> {
    if (!this.session) throw new Error('Chưa tham gia phòng.');
    return this.attach(await this.call<SessionView>('set_exploration', { roomId: this.session.room.roomId, policy, designatedCharacterId }));
  }

  subscribe(listener: RoomListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async disconnect(): Promise<void> {
    if (this.session) {
      try { await this.call<SessionView>('disconnect', { roomId: this.session.room.roomId }); } catch { /* local status still becomes offline */ }
    }
    if (this.channel) await this.supabase.removeChannel(this.channel);
    this.channel = null;
    if (this.session) this.update({ ...this.session, connection: 'offline' });
  }

  private async ensureIdentity(): Promise<void> {
    let { data: { user }, error } = await this.supabase.auth.getUser();
    if (!user && !error) ({ data: { user }, error } = await this.supabase.auth.signInAnonymously());
    if (error || !user) throw new Error(`Không thể xác thực ẩn danh: ${error?.message ?? 'không có user'}`);
    this.identity.userId = user.id;
  }

  private async call<T>(action: string, payload: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.supabase.functions.invoke<ApiResponse<T>>('game-api', { body: { action, ...payload } });
    if (error) throw new Error(`Game API: ${error.message}`);
    if (data?.error) throw new Error(`${data.error.code}: ${data.error.message}`);
    if (!data?.data) throw new Error('Game API trả về dữ liệu không hợp lệ.');
    return data.data;
  }

  private attach(view: SessionView): SessionView {
    this.update(view);
    if (this.channel) void this.supabase.removeChannel(this.channel);
    this.channel = this.supabase.channel(`room:${view.room.roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${view.room.roomId}` }, () => {
        if (!this.session) return;
        this.update({ ...this.session, connection: 'reconnecting' });
        void this.reconnect(view.room.roomId).catch(() => {
          if (this.session) this.update({ ...this.session, connection: 'offline' });
        });
      })
      .subscribe((status) => {
        if (!this.session) return;
        const connection = status === 'SUBSCRIBED' ? 'online' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' ? 'reconnecting' : this.session.connection;
        if (connection !== this.session.connection) this.update({ ...this.session, connection });
      });
    return structuredClone(view);
  }

  private update(view: SessionView): void {
    this.session = view;
    for (const listener of this.listeners) listener(structuredClone(view));
  }
}
