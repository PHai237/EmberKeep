import type { CampaignState, GameEvent } from '../domain/types.ts';

export interface DMResponse {
  narration: string;
  npcSpeech: Array<{ npcId: string; text: string }>;
  basedOnEventId: string;
}

export interface DMProvider {
  readonly name: string;
  narrate(event: GameEvent, state: CampaignState): Promise<DMResponse>;
}
