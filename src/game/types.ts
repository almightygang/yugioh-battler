export interface MonsterInstance {
  monsterId: string;
  level: number;
}

export interface TeamSlotData {
  monsterVaultIndex: number;
  itemId?: string;
}

export interface TeamData {
  name: string;
  slots: (TeamSlotData | null)[]; // [L, C, R, B1, B2, B3]
}

export interface PlayerProfile {
  name: string;
  currency: number;
  monsterVault: MonsterInstance[];
  itemVault: string[];
  teams: TeamData[];
  unlockedTeamSlots: number;
  packsOpened: number;
}

export interface PackSlot {
  id: string;
  weight: number;
  minLevel?: number;
  maxLevel?: number;
}

export interface PackContent {
  monsters: PackSlot[];
  items: PackSlot[];
}

export interface PackDefinition {
  id: string;
  name: string;
  cost: number;
  description: string;
  content: PackContent;
}

export interface PackResult {
  monster?: MonsterInstance;
  items: string[];
}

export interface ArenaStage {
  id: string;
  name: string;
  description: string;
  difficulty: number;
  reward: number;
  monsterLevel: number;
  npcTeamSize: number;
}

export interface ArenaResult {
  won: boolean;
  reward: number;
  log: string[];
}

export interface GameState {
  player: PlayerProfile;
  saveVersion: number;
}
