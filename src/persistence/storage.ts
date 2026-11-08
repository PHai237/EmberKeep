import { replay } from '../domain/reducer';
import type { CampaignRecord, GameEvent } from '../domain/types';

export const STORAGE_KEY = 'ai-dm-phase-1-campaign';

export interface SaveEnvelope {
  format: 'ai-dm-phase-1';
  version: 1;
  savedAt: string;
  checksum: string;
  record: CampaignRecord;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function checksumRecord(record: CampaignRecord): string {
  const input = stableStringify(record);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function serializeCampaign(record: CampaignRecord, now = new Date().toISOString()): string {
  const envelope: SaveEnvelope = { format: 'ai-dm-phase-1', version: 1, savedAt: now, checksum: checksumRecord(record), record };
  return JSON.stringify(envelope, null, 2);
}

function assertEventShape(event: unknown, index: number): asserts event is GameEvent {
  if (!event || typeof event !== 'object') throw new Error(`Event ${index + 1} is invalid.`);
  const value = event as Partial<GameEvent>;
  if (!Number.isInteger(value.seq) || typeof value.id !== 'string' || typeof value.commandId !== 'string' || typeof value.data !== 'object') {
    throw new Error(`Event ${index + 1} has an invalid schema.`);
  }
  if (typeof value.campaignId !== 'string' || !value.campaignId) throw new Error('Campaign identity is invalid.');
}

export function deserializeCampaign(json: string): CampaignRecord {
  let unknownValue: unknown;
  try { unknownValue = JSON.parse(json); } catch { throw new Error('Save file is not valid JSON.'); }
  if (!unknownValue || typeof unknownValue !== 'object') throw new Error('Save envelope is invalid.');
  const envelope = unknownValue as Partial<SaveEnvelope>;
  if (envelope.format !== 'ai-dm-phase-1' || envelope.version !== 1 || !envelope.record || envelope.record.schemaVersion !== 1 || !Array.isArray(envelope.record.events)) {
    throw new Error('Unsupported save format or version.');
  }
  envelope.record.events.forEach(assertEventShape);
  if (envelope.checksum !== checksumRecord(envelope.record)) throw new Error('Save checksum failed; data may have been changed or damaged.');
  replay(envelope.record.events);
  return structuredClone(envelope.record);
}

export function saveToLocalStorage(record: CampaignRecord, storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(STORAGE_KEY, serializeCampaign(record));
}

export function loadFromLocalStorage(storage: Pick<Storage, 'getItem'> = localStorage): CampaignRecord | null {
  const json = storage.getItem(STORAGE_KEY);
  return json ? deserializeCampaign(json) : null;
}
