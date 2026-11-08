import { useEffect, useMemo, useRef, useState } from 'react';
import { GameEngine } from '../domain/engine';
import type { CampaignState, Character, CharacterId, Die, GameCommand, GameEvent, ShopItemId } from '../domain/types';
import { SHOP_CATALOG, resalePrice, xpToNextLevel } from '../rules/economy';
import { MockDM } from '../dm/MockDM';
import { mockSuggestions } from '../dm/choices';
import type { CommandBase, CommandFactory } from '../dm/choices';
import { deserializeCampaign, loadFromLocalStorage, saveToLocalStorage, serializeCampaign } from '../persistence/storage';
import { hasSupabaseConfig, SupabaseMultiplayerClient } from '../multiplayer/SupabaseMultiplayerClient';
import type { AuthorityFreeCommand, MultiplayerClient, SessionView } from '../multiplayer/types';

const dm = new MockDM();
const dice: Die[] = [4, 6, 8, 10, 12, 20, 100];
const shopIds = Object.keys(SHOP_CATALOG) as ShopItemId[];
type SidebarTab = 'inventory' | 'dice' | 'character' | 'shop';
type ChatEntry = { event: GameEvent; kind: 'gm' | 'player' | 'system'; text: string };
type Base = CommandBase;
type BuildCommand = CommandFactory;

function newEngine() {
  try {
    const record = loadFromLocalStorage();
    return record ? new GameEngine({ record }) : new GameEngine();
  } catch { return new GameEngine(); }
}
function eventActor(event: GameEvent): CharacterId | null {
  if ('characterId' in event.data) return event.data.characterId;
  if (event.data.type === 'item_purchased') return event.data.buyerId;
  if (event.data.type === 'item_sold') return event.data.sellerId;
  if (event.data.type === 'item_transferred') return event.data.toCharacterId;
  if (event.data.type === 'item_dropped') return event.data.fromCharacterId;
  if (event.data.type === 'attack_resolved' && event.data.attackerId !== 'enemy-rat') return event.data.attackerId;
  return null;
}
function actionLabel(event: GameEvent, state: CampaignState): string | null {
  const data = event.data;
  switch (data.type) {
    case 'action_submitted': return data.text;
    case 'npc_spoken': return 'Tôi muốn nói chuyện với Sera.';
    case 'check_resolved': return 'Tôi kiểm tra chiếc rương.';
    case 'item_transferred': return `Tôi nhặt ${state.items[data.itemId]?.name ?? 'vật phẩm'}.`;
    case 'item_dropped': return 'Tôi đặt một vật phẩm xuống.';
    case 'combat_started': return 'Chúng ta đối mặt với Chuột Tro.';
    case 'attack_resolved': return data.attackerId === 'enemy-rat' ? null : 'Tôi tấn công Chuột Tro!';
    case 'turn_ended': return null;
    case 'location_changed': return 'Tôi mở cửa bước ra sân.';
    case 'item_purchased': return `Tôi mua ${data.item.name} với ${data.price} vàng.`;
    case 'item_sold': return `Tôi bán vật phẩm với ${data.price} vàng.`;
    case 'item_consumed': return 'Tôi uống bình hồi phục.';
    case 'dice_rolled': return `Tung d${data.result.die} (tổng ${data.result.total}).`;
    case 'character_updated': return 'Tôi đã cập nhật hồ sơ nhân vật.';
    default: return null;
  }
}
function systemLabel(event: GameEvent): string | null {
  const data = event.data;
  switch (data.type) {
    case 'check_resolved': return `Kiểm tra ${data.result.skill}: ${data.result.total} / DC ${data.result.dc} · ${data.result.success ? 'Thành công' : 'Thất bại'}`;
    case 'attack_resolved': return `${data.attackerId === 'enemy-rat' ? 'Chuột Tro' : 'Đòn đánh'} ${data.hit ? `gây ${data.appliedDamage} sát thương` : 'trượt mục tiêu'}`;
    case 'dice_rolled': return `Kết quả d${data.result.die}: ${data.result.total}`;
    case 'item_purchased': return `−${data.price} vàng · +1 ${data.item.name}`;
    case 'item_sold': return `+${data.price} vàng · Đã bán vật phẩm`;
    case 'item_transferred': return 'Vật phẩm đã được thêm vào túi.';
    case 'item_dropped': return 'Vật phẩm đã được đặt xuống.';
    case 'item_consumed': return `Hồi ${data.healed} HP · 2d4+2 = ${data.healing.total}`;
    case 'experience_awarded': return `+${data.amount} XP · ${data.reason === 'rat_defeated' ? 'Đánh bại Chuột Tro' : 'Hoàn thành nhiệm vụ'}`;
    case 'quest_completed': return 'Nhiệm vụ đã hoàn thành.';
    case 'combat_started': return 'Bắt đầu giao tranh.';
    case 'turn_ended': return 'Chuyển lượt chiến đấu.';
    case 'character_updated': return 'Đã lưu character sheet.';
    default: return null;
  }
}
function Glyph({ name, size = 18 }: { name: 'dice' | 'bag' | 'user' | 'coins' | 'send' | 'menu' | 'book' | 'download' | 'upload' | 'shield' | 'sword' | 'heart' | 'close' | 'spark' | 'chevron' | 'settings' | 'scroll'; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const };
  switch (name) {
    case 'dice': return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1" fill="currentColor"/><circle cx="16" cy="16" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>;
    case 'bag': return <svg {...common}><path d="M7 8 5 20h14L17 8H7ZM9 8V6a3 3 0 0 1 6 0v2"/><path d="M5 12h14"/></svg>;
    case 'user': return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>;
    case 'coins': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 6v12m3-9c-2-2-6-1-6 1s6 1 6 4-4 3-6 1"/></svg>;
    case 'send': return <svg {...common}><path d="M4 12 20 4l-5 16-3-7-8-1Z"/><path d="m12 13 8-9"/></svg>;
    case 'menu': return <svg {...common}><path d="M4 7h16M4 12h16M4 17h16"/></svg>;
    case 'book': return <svg {...common}><path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1ZM12 6v14"/></svg>;
    case 'download': return <svg {...common}><path d="M12 3v12m-4-4 4 4 4-4M5 16v5h14v-5"/></svg>;
    case 'upload': return <svg {...common}><path d="M12 16V4m-4 4 4-4 4 4M5 16v5h14v-5"/></svg>;
    case 'shield': return <svg {...common}><path d="m12 2 8 3v6c0 5-4 9-8 11-4-2-8-6-8-11V5z"/></svg>;
    case 'sword': return <svg {...common}><path d="m14 4 6-2-2 6L8 18l-2-2zM3 21l5-5"/></svg>;
    case 'heart': return <svg {...common}><path d="M20.8 8.8C20.8 13.2 12 20 12 20S3.2 13.2 3.2 8.8a4.6 4.6 0 0 1 8.8-1.7 4.6 4.6 0 0 1 8.8 1.7Z"/></svg>;
    case 'close': return <svg {...common}><path d="M5 5 19 19M19 5 5 19"/></svg>;
    case 'spark': return <svg {...common}><path d="m12 2 2.3 7.7L22 12l-7.7 2.3L12 22l-2.3-7.7L2 12l7.7-2.3z"/></svg>;
    case 'settings': return <svg {...common}><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1"/><circle cx="12" cy="12" r="4"/></svg>;
    case 'scroll': return <svg {...common}><path d="M6 3h12v13a4 4 0 0 1-4 4H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm0 0a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3"/><path d="M11 8h4M11 12h4"/></svg>;
    case 'chevron': return <svg {...common}><path d="m9 6 6 6-6 6"/></svg>;
  }
}

function CharacterEditor({ character, onSave, busy }: { character: Character; onSave: (patch: Pick<Character, 'name' | 'ancestry' | 'className'>) => Promise<boolean>; busy: boolean }) {
  const [draft, setDraft] = useState({ name: character.name, ancestry: character.ancestry, className: character.className });
  useEffect(() => setDraft({ name: character.name, ancestry: character.ancestry, className: character.className }), [character.id, character.name, character.ancestry, character.className]);
  return <div className="character-form">
    <label>Tên nhân vật<input value={draft.name} maxLength={40} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
    <label>Chủng tộc<input value={draft.ancestry} maxLength={40} onChange={e => setDraft({ ...draft, ancestry: e.target.value })} /></label>
    <label>Class<input value={draft.className} maxLength={40} onChange={e => setDraft({ ...draft, className: e.target.value })} /></label>
    <button className="primary mini" type="button" disabled={busy} onClick={() => void onSave(draft)}>Lưu hồ sơ</button>
  </div>;
}

export function App() {
  const [engine, setEngine] = useState(newEngine);
  const [revision, setRevision] = useState(0);
  const [tab, setTab] = useState<SidebarTab>('dice');
  const [actionText, setActionText] = useState('');
  const [modifier, setModifier] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [showJournal, setShowJournal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showRoom, setShowRoom] = useState(false);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('emberkeep-player-name') ?? '');
  const [inviteCode, setInviteCode] = useState('');
  const [session, setSession] = useState<SessionView | null>(null);
  const multiplayerRef = useRef<MultiplayerClient | null>(null);
  const multiplayerUnsubscribe = useRef<(() => void) | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const locked = useRef(false);
  const state = engine.state;
  const events = engine.eventLog;
  const combatant = state.combat?.order[state.combat.activeIndex];
  const activeId: CharacterId = session?.characterId ?? (combatant === 'pc-borin' ? 'pc-borin' : 'pc-aria');
  const active = state.characters[activeId];
  const phaseLabel = state.quest.completed ? 'Chương I hoàn thành' : state.combat ? `Giao tranh · Vòng ${state.combat.round}` : 'Đang khám phá';
  const currentTurnLabel = state.combat ? `Đến lượt ${combatant === 'enemy-rat' ? 'Chuột Tro' : state.characters[combatant as CharacterId]?.name ?? 'GM'}` : 'GM đang chờ hành động';
  const shopAvailable = state.quest.spokeToSera && !state.combat && state.scene === 'cellar' && active.position === 'cellar' && state.npcs['npc-sera'].status === 'alive';
  const progress = [state.quest.spokeToSera, state.quest.chestInspected, state.quest.ratDefeated, state.quest.completed].filter(Boolean).length;
  const xpNext = xpToNextLevel(active.xp);
  const lastRoll = [...events].reverse().find(e => e.data.type === 'dice_rolled' || e.data.type === 'attack_resolved' || e.data.type === 'check_resolved');
  const choices = useMemo(() => mockSuggestions(state, activeId), [state, activeId]);

  useEffect(() => { if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight; }, [revision]);

  function applySession(next: SessionView) {
    setSession(next);
    setEngine(new GameEngine({ record: next.room.record }));
    setRevision(value => value + 1);
    localStorage.setItem('emberkeep-room-id', next.room.roomId);
  }

  function bindClient(client: MultiplayerClient) {
    multiplayerUnsubscribe.current?.();
    multiplayerRef.current = client;
    multiplayerUnsubscribe.current = client.subscribe(applySession);
  }

  useEffect(() => {
    if (!hasSupabaseConfig()) return;
    const roomId = localStorage.getItem('emberkeep-room-id');
    const name = localStorage.getItem('emberkeep-player-name');
    if (!roomId || !name) return;
    const client = new SupabaseMultiplayerClient({ url: import.meta.env.VITE_SUPABASE_URL!, anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY!, displayName: name });
    bindClient(client);
    void client.reconnect(roomId).then(applySession).catch(() => localStorage.removeItem('emberkeep-room-id'));
    return () => multiplayerUnsubscribe.current?.();
  }, []);

  async function connectRoom(mode: 'create' | 'join') {
    if (!hasSupabaseConfig()) { setNotice('Multiplayer chưa được cấu hình. Xem docs/PHASE_2A_SETUP.md.'); return; }
    const name = playerName.trim();
    if (!name) { setNotice('Nhập tên người chơi.'); return; }
    setBusy(true);
    try {
      localStorage.setItem('emberkeep-player-name', name);
      const client = new SupabaseMultiplayerClient({ url: import.meta.env.VITE_SUPABASE_URL!, anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY!, displayName: name });
      bindClient(client);
      const next = mode === 'create' ? await client.createRoom() : await client.joinRoom(inviteCode);
      applySession(next);
      setNotice('');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Không thể kết nối phòng.'); }
    finally { setBusy(false); }
  }

  async function run(build: BuildCommand, characterId: CharacterId = activeId): Promise<boolean> {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    if (session && characterId !== session.characterId) {
      setNotice('Bạn không điều khiển nhân vật này.'); locked.current = false; setBusy(false); return false;
    }
    const character = engine.state.characters[characterId];
    const base: Base = { commandId: crypto.randomUUID(), actorId: character.controllerId, expectedVersion: engine.state.version, characterId };
    const built = build(base);
    if (session && multiplayerRef.current) {
      const { actorId: _actorId, characterId: _characterId, expectedVersion: _expectedVersion, ...authorityFree } = built as GameCommand;
      const remote = await multiplayerRef.current.send(authorityFree as AuthorityFreeCommand, session.room.version);
      if (!remote.ok) {
        if (remote.room) applySession({ ...session, room: remote.room });
        setNotice(`${remote.code}: ${remote.message}`); locked.current = false; setBusy(false); return false;
      }
      applySession({ ...session, room: remote.room, connection: 'online' });
      setNotice(''); locked.current = false; setBusy(false); return true;
    }
    const result = engine.dispatch(built);
    if (!result.ok) {
      setNotice(`${result.code}: ${result.message}`);
      locked.current = false;
      setBusy(false);
      return false;
    }
    try {
      const anchor = result.events[0];
      const response = await dm.narrate(anchor, engine.state);
      engine.addNarration(`narration-${base.commandId}`, response.basedOnEventId, [response.narration, ...response.npcSpeech.map(s => `“${s.text}”`)].join('\n\n'));
      saveToLocalStorage(engine.exportRecord());
      setNotice('');
    } catch (error) {
      try { saveToLocalStorage(engine.exportRecord()); } catch { /* export remains available */ }
      setNotice(`Hành động đã xử lý nhưng phần kể hoặc lưu bị lỗi: ${error instanceof Error ? error.message : 'Không rõ lỗi'}`);
    } finally {
      setRevision(v => v + 1);
      locked.current = false;
      setBusy(false);
    }
    return true;
  }
  function exportSave() {
    const blob = new Blob([serializeCampaign(engine.exportRecord())], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'emberkeep-campaign.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Đã xuất bản sao lưu chiến dịch.');
  }
  async function importSave(file?: File) {
    if (!file) return;
    try {
      const next = new GameEngine({ record: deserializeCampaign(await file.text()) });
      saveToLocalStorage(next.exportRecord());
      setEngine(next);
      setRevision(v => v + 1);
      setNotice('Đã khôi phục chiến dịch từ bản lưu.');
      setShowSettings(false);
    } catch (error) { setNotice(`Không thể nhập bản lưu: ${error instanceof Error ? error.message : 'Dữ liệu không hợp lệ'}`); }
  }
  function sendMessage() {
    const text = actionText.trim();
    if (!text || busy || combatant === 'enemy-rat') return;
    void run(base => ({ ...base, type: 'submit_action', text })).then(ok => { if (ok) setActionText(''); inputRef.current?.focus(); });
  }
  const chatEntries = events.flatMap<ChatEntry>(event => {
    if (event.data.type === 'campaign_created') return [{ event, kind: 'gm' as const, text: event.data.initialState.lastNarration }];
    if (event.data.type === 'narration_added') return [{ event, kind: 'gm' as const, text: event.data.text }];
    const action = actionLabel(event, state);
    const system = systemLabel(event);
    return [...(action ? [{ event, kind: 'player' as const, text: action }] : []), ...(system ? [{ event, kind: 'system' as const, text: system }] : [])];
  });
  return (
    <div className="ek-shell" data-revision={revision}>
      {mobileSidebar && <button className="ek-mobile-shade" aria-label="Đóng bảng công cụ" onClick={() => setMobileSidebar(false)} />}
      <aside className={`ek-sidebar ${mobileSidebar ? 'is-open' : ''}`} aria-label="Nhân vật và công cụ">
        <div className="ek-brand">
          <div className="ek-brand-sigil" aria-hidden="true"><Glyph name="shield" size={24} /></div>
          <strong>EMBERKEEP</strong>
          <button className="ek-close-mobile" type="button" aria-label="Đóng bảng công cụ" onClick={() => setMobileSidebar(false)}><Glyph name="close" /></button>
        </div>
        <div className="ek-sidebar-scroll">
          <section className="ek-party" aria-label="Tổ đội">
            <h2>Tổ đội <span>2 người</span></h2>
            <div className="ek-party-list">
              {(Object.values(state.characters) as Character[]).map((pc, index) => (
                <div className={`ek-party-member ${state.combat?.order[state.combat.activeIndex] === pc.id ? 'is-acting' : ''}`} key={pc.id}>
                  <div className={`ek-portrait portrait-${index}`} aria-hidden="true">{pc.name.charAt(0).toLocaleUpperCase('vi')}</div>
                  <div className="ek-party-main">
                    <div className="ek-party-top"><strong>{pc.name}</strong><span>Cấp {pc.level}</span></div>
                    <div className="ek-class">{pc.className} · {pc.ancestry}</div>
                    <div className="ek-hp-track" role="progressbar" aria-label={`HP của ${pc.name}`} aria-valuenow={pc.hp.current} aria-valuemin={0} aria-valuemax={pc.hp.max}><span style={{ width: `${Math.max(0, pc.hp.current / Math.max(pc.hp.max, 1) * 100)}%` }} /></div>
                  </div>
                  <span className="ek-hp-value">{pc.hp.current}<small>/{pc.hp.max}</small></span>
                </div>
              ))}
            </div>
          </section>

          <nav className="ek-tool-tabs" aria-label="Công cụ">
            {([['dice', 'dice', 'Xúc xắc'], ['inventory', 'bag', 'Túi đồ'], ['character', 'user', 'Nhân vật'], ['shop', 'coins', 'Cửa hàng']] as const).map(([id, icon, label]) => (
              <button key={id} type="button" className={`ek-tool-tab ${tab === id ? 'selected' : ''}`} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
                <Glyph name={icon} size={18}/><span>{label}</span>
              </button>
            ))}
          </nav>

          <div className="ek-tool-pane">
            {tab === 'dice' && <section aria-label="Bộ xúc xắc">
              <div className="ek-pane-head"><h2>Xúc xắc</h2>{lastRoll && <span className="ek-last-roll">Lần cuối: {lastRoll.data.type === 'dice_rolled' ? lastRoll.data.result.total : lastRoll.data.type === 'check_resolved' ? lastRoll.data.result.total : lastRoll.data.type === 'attack_resolved' ? lastRoll.data.attack.total : '—'}</span>}</div>
              <div className="ek-dice-hero" aria-hidden="true">
                <svg viewBox="0 0 120 120"><path d="M60 5 110 36 98 100H22L10 36Z"/><path d="M60 5 10 36 60 78 110 36ZM10 36l12 64 38-22 38 22 12-64M60 78v22"/></svg>
                <span>20</span>
              </div>
              <div className="ek-dice-options">{dice.map(die => <button key={die} type="button" disabled={busy} onClick={() => void run(base => ({ ...base, type: 'roll_dice', die, modifier }))}>d{die}</button>)}</div>
              <label className="ek-modifier"><span>Điểm cộng / trừ</span><input type="number" min={-10} max={20} value={modifier} onChange={e => setModifier(Math.max(-10, Math.min(20, Number(e.target.value) || 0)))} /></label>
            </section>}

            {tab === 'inventory' && <section aria-label="Túi đồ">
              <div className="ek-pane-head"><h2>Túi đồ</h2><span className="ek-last-roll">{active.name}</span></div>
              <div className="ek-gold-line"><Glyph name="coins" size={16}/><span>Vàng</span><strong>{active.gold} GP</strong></div>
              {active.inventory.length ? <div className="ek-item-list">{active.inventory.map(itemId => {
                const item = state.items[itemId]; if (!item) return null;
                return <div className="ek-item-row" key={itemId}>
                  <div className="ek-item-icon" aria-hidden="true">{item.catalogId === 'healing-potion' ? '✚' : item.unique ? '⚿' : '◇'}</div>
                  <div className="ek-item-name"><strong>{item.name}</strong>{item.unique && <small>Nhiệm vụ</small>}</div>
                  <div className="ek-item-controls">
                    {item.catalogId === 'healing-potion' && <button type="button" disabled={busy || active.hp.current >= active.hp.max || (!!state.combat && (combatant !== activeId || state.combat.actionUsed))} onClick={() => void run(base => ({ ...base, type: 'use_item', itemId }))}>Dùng</button>}
                    {shopAvailable && !item.unique && item.catalogId && <button type="button" disabled={busy} onClick={() => void run(base => ({ ...base, type: 'sell_item', itemId }))}>Bán {resalePrice(item.catalogId)}v</button>}
                  </div>
                </div>;
              })}</div> : <p className="ek-muted">Túi đồ đang trống.</p>}
            </section>}

            {tab === 'character' && <section aria-label="Hồ sơ nhân vật">
              <div className="ek-pane-head"><h2>Nhân vật</h2><span className="ek-last-roll">{active.name}</span></div>
              <div className="ek-stat-grid"><div><span>Cấp</span><strong>{active.level}</strong></div><div><span>XP</span><strong>{active.xp}</strong></div><div><span>Giáp</span><strong>{active.armorClass}</strong></div><div><span>Tấn công</span><strong>+{active.attackBonus}</strong></div></div>
              {xpNext !== null && <p className="ek-tool-footnote">Cấp tiếp theo: {xpNext} XP</p>}
              <CharacterEditor key={active.id} character={active} busy={busy} onSave={patch => run(base => ({ ...base, type: 'edit_character', patch }), active.id)} />
            </section>}

            {tab === 'shop' && <section aria-label="Cửa hàng">
              <div className="ek-pane-head"><h2>Cửa hàng Sera</h2></div>
              {!shopAvailable ? <p className="ek-muted">Gặp Sera trong hầm để giao dịch.</p> : <>
                <div className="ek-gold-line"><Glyph name="coins" size={16}/><span>{active.name}</span><strong>{active.gold} GP</strong></div>
                <div className="ek-item-list">{shopIds.map(id => <div className="ek-shop-row" key={id}><div><strong>{SHOP_CATALOG[id].name}</strong><small>{SHOP_CATALOG[id].description}</small></div><button type="button" disabled={busy || active.gold < SHOP_CATALOG[id].price} onClick={() => void run(base => ({ ...base, type: 'buy_item', catalogId: id }))}>Mua {SHOP_CATALOG[id].price}v</button></div>)}</div>
              </>}
            </section>}
          </div>
        </div>
      </aside>

      <main className="ek-main">
        <header className="ek-topbar">
          <div className="ek-topbar-leading">
            <button className="ek-hamburger" type="button" aria-label="Mở công cụ" onClick={() => setMobileSidebar(true)}><Glyph name="menu"/></button>
            <span className="ek-campaign-title">Hai người, một ngọn đèn</span>
          </div>
          <div className="ek-top-actions">
            <button type="button" className={`ek-connection ${session?.connection === 'online' ? 'is-online' : ''}`} onClick={() => setShowRoom(true)}>
              {session ? `${session.connection === 'online' ? 'Đã kết nối' : 'Mất kết nối'} · ${session.room.inviteCode}` : 'Tạo / tham gia phòng'}
            </button>
            <button type="button" aria-label="Nhật ký nhiệm vụ" title="Nhật ký" onClick={() => setShowJournal(true)}><Glyph name="book" size={19}/></button>
            <button type="button" aria-label="Cài đặt và sao lưu" title="Cài đặt" onClick={() => setShowSettings(true)}><Glyph name="settings" size={19}/></button>
          </div>
        </header>

        <div className="ek-story-scroller" ref={feedRef} role="log" aria-label="Diễn biến chiến dịch">
          <div className="ek-story-content">
            <section className="ek-scene-banner" aria-label="Địa điểm hiện tại">
              <img src="/cellar-scene.svg" alt="Hầm đá với cánh cửa và ánh đuốc" />
              <div className="ek-scene-shade"/>
              <div className="ek-scene-content"><p>{state.scene === 'cellar' ? 'Hầm rượu dưới quán trọ' : 'Sân đá ngoài hầm'}</p><h1>Tiếng vọng dưới hầm</h1></div>
            </section>

            <div className="ek-chat-feed">
              {chatEntries.map(({ event, kind, text }) => {
                const actorId = eventActor(event);
                const character = actorId && state.characters[actorId];
                if (kind === 'system') return <div className="ek-roll-message" key={`s-${event.id}`}><Glyph name="dice" size={15}/><span>{text}</span></div>;
                if (kind === 'player') return <div className="ek-player-message-wrap" key={`p-${event.id}`}><div className="ek-player-message"><strong>{character?.name ?? 'Người chơi'}</strong><p>{text}</p></div></div>;
                return <article className="ek-gm-message" key={`g-${event.id}`}><div className="ek-gm-icon" aria-hidden="true"><Glyph name="shield" size={17}/></div><div className="ek-gm-copy"><h2>Dungeon Master</h2>{text.split(/\n\s*\n/).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div></article>;
              })}
            </div>

            {choices.length > 0 && <section className="ek-choices" aria-label="Hành động gợi ý">
              <div className="ek-choices-heading"><h2>Hành động có thể thực hiện</h2><button type="button" onClick={() => setShowSuggestions(value => !value)}>{showSuggestions ? 'Thu gọn' : 'Hiển thị'}</button></div>
              {showSuggestions && <div className="ek-choice-list">{choices.map((choice, i) => <button type="button" key={`${choice.id}-${i}`} disabled={busy} onClick={() => void run(choice.build)}><span className="ek-choice-index">{String(i + 1).padStart(2, '0')}</span><span className="ek-choice-label"><strong>{choice.label}</strong><small>{choice.hint}</small></span><Glyph name="chevron" size={16}/></button>)}</div>}
            </section>}
            {state.quest.completed && <div className="ek-quest-complete">Nhiệm vụ hoàn thành</div>}
          </div>
        </div>

        <footer className="ek-composer-shell">
          <div className="ek-composer-inner">
            <div className="ek-turn-status"><span className="ek-turn-dot"/>{currentTurnLabel}</div>
            <form className="ek-composer" onSubmit={e => {e.preventDefault(); sendMessage();}}>
              <textarea ref={inputRef} aria-label="Hành động của bạn" rows={2} maxLength={300} value={actionText} placeholder="Bạn muốn làm gì?" onChange={e => setActionText(e.target.value)} onKeyDown={e => {if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {e.preventDefault(); sendMessage();}}} disabled={combatant === 'enemy-rat'} />
              <button type="submit" className="ek-send" disabled={busy || !actionText.trim() || combatant === 'enemy-rat'} aria-label="Gửi hành động" title="Gửi"><Glyph name="send" size={19}/></button>
            </form>
            {notice && <div className="ek-notice" role="status">{notice}</div>}
          </div>
        </footer>
      </main>

      {showJournal && <div className="ek-modal-shade" onClick={() => setShowJournal(false)}><aside className="ek-drawer" role="dialog" aria-modal="true" aria-label="Nhật ký chiến dịch" onClick={e => e.stopPropagation()}>
        <header><div><h2>Nhật ký</h2><small>Tiếng vọng dưới hầm</small></div><button onClick={() => setShowJournal(false)} aria-label="Đóng"><Glyph name="close"/></button></header>
        <div className="ek-journal-entries"><div className="ek-quest-summary"><strong>Nhiệm vụ</strong><span>{progress}/4 mục tiêu · {phaseLabel}</span><div className="ek-quest-track"><span style={{width: `${progress * 25}%`}}/></div></div>{[...events].reverse().map(event => <div key={event.id}><small>#{String(event.seq).padStart(3, '0')} · {new Date(event.createdAt).toLocaleString('vi-VN')}</small><p>{event.data.type === 'narration_added' ? event.data.text : systemLabel(event) ?? actionLabel(event, state) ?? event.data.type}</p></div>)}</div>
      </aside></div>}

      {showSettings && <div className="ek-modal-shade" onClick={() => setShowSettings(false)}><aside className="ek-drawer" role="dialog" aria-modal="true" aria-label="Cài đặt" onClick={e => e.stopPropagation()}>
        <header><div><h2>Cài đặt</h2></div><button onClick={() => setShowSettings(false)} aria-label="Đóng"><Glyph name="close"/></button></header>
        <div className="ek-settings-body"><section><h3>Sao lưu dữ liệu</h3><p>{session ? 'Tải bản sao từ trạng thái server hiện tại. Khôi phục JSON chỉ dùng ở chế độ offline.' : 'Chiến dịch được lưu tự động trên trình duyệt này.'}</p><button className="ek-setting-action" type="button" onClick={exportSave}><Glyph name="download"/> Tải bản lưu JSON</button>{!session && <label className="ek-setting-action ek-import-action"><Glyph name="upload"/> Khôi phục từ JSON<input type="file" accept=".json,application/json" onChange={e => {void importSave(e.target.files?.[0]); e.target.value = '';}} /></label>}</section><section><h3>Chế độ chơi</h3><p>{session ? `MockDM · Phòng ${session.room.inviteCode} · ${session.room.members.length}/2 người chơi` : 'MockDM offline. Chưa kết nối phòng multiplayer.'}</p></section></div>
      </aside></div>}

      {showRoom && <div className="ek-modal-shade" onClick={() => setShowRoom(false)}><aside className="ek-drawer" role="dialog" aria-modal="true" aria-label="Phòng multiplayer" onClick={e => e.stopPropagation()}>
        <header><div><h2>Phòng chơi</h2></div><button onClick={() => setShowRoom(false)} aria-label="Đóng"><Glyph name="close"/></button></header>
        <div className="ek-settings-body">
          {!session ? <section className="ek-room-form">
            <label>Tên người chơi<input maxLength={40} value={playerName} onChange={e => setPlayerName(e.target.value)} /></label>
            <button className="ek-setting-action" type="button" disabled={busy} onClick={() => void connectRoom('create')}>Tạo phòng</button>
            <label>Mã mời<input maxLength={8} value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} /></label>
            <button className="ek-setting-action" type="button" disabled={busy || inviteCode.trim().length !== 8} onClick={() => void connectRoom('join')}>Tham gia phòng</button>
            {!hasSupabaseConfig() && <p>Chưa có cấu hình Supabase local.</p>}
          </section> : <>
            <section><h3>Mã mời</h3><div className="ek-invite-code">{session.room.inviteCode}</div><p>Bạn điều khiển {state.characters[session.characterId].name}. Quyền nhân vật do server gán.</p></section>
            <section><h3>Người chơi</h3><div className="ek-member-list">{session.room.members.map(member => <div key={member.userId}><span className={member.connected ? 'is-connected' : ''}/><strong>{member.displayName}</strong><small>{state.characters[member.characterId].name}</small></div>)}</div></section>
            {session.room.ownerId === session.identity.userId && !state.combat && <section><h3>Phản hồi exploration</h3><select value={session.room.explorationPolicy} onChange={e => {
              const policy = e.target.value as 'open' | 'designated' | 'all';
              const designated = policy === 'designated' ? session.room.members.at(-1)?.characterId : undefined;
              void multiplayerRef.current?.setExplorationPolicy(policy, designated).then(applySession).catch(error => setNotice(error instanceof Error ? error.message : 'Không thể đổi quy tắc.'));
            }}><option value="open">Ai cũng có thể phản hồi</option><option value="designated">Chờ người được chỉ định</option><option value="all">Chờ cả hai</option></select>{session.room.explorationPolicy === 'designated' && <select value={session.room.designatedCharacterId ?? ''} onChange={e => void multiplayerRef.current?.setExplorationPolicy('designated', e.target.value as CharacterId).then(applySession).catch(error => setNotice(error instanceof Error ? error.message : 'Không thể chỉ định nhân vật.'))}>{session.room.members.map(member => <option key={member.characterId} value={member.characterId}>{state.characters[member.characterId].name}</option>)}</select>}</section>}
            <section>{session.connection === 'online' ? <button className="ek-setting-action" type="button" onClick={() => void multiplayerRef.current?.disconnect().then(() => setSession(current => current ? { ...current, connection: 'offline' } : null))}>Ngắt kết nối</button> : <button className="ek-setting-action" type="button" onClick={() => void multiplayerRef.current?.reconnect(session.room.roomId).then(applySession).catch(error => setNotice(error instanceof Error ? error.message : 'Không thể kết nối lại.'))}>Kết nối lại</button>}</section>
          </>}
        </div>
      </aside></div>}
    </div>
  );
}
