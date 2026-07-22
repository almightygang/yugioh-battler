export enum Element {
  LIGHT = 'LIGHT',
  DARK = 'DARK',
  FIRE = 'FIRE',
  WATER = 'WATER',
  EARTH = 'EARTH',
  WIND = 'WIND',
  NORMAL = 'NORMAL',
}

export enum Category {
  Physical = 'Physical',
  Special = 'Special',
  Status = 'Status',
}

export enum TargetScope {
  SINGLE_ADJACENT = 'SINGLE_ADJACENT',
  SINGLE_ANY = 'SINGLE_ANY',
  ALL_OPPONENTS = 'ALL_OPPONENTS',
  ALL_ADJACENT_ALLIES = 'ALL_ADJACENT_ALLIES',
  EVERYONE_BUT_USER = 'EVERYONE_BUT_USER',
  SELF = 'SELF',
}

export enum MonsterType {
  DRAGON = 'DRAGON',
  WARRIOR = 'WARRIOR',
  SPELLCASTER = 'SPELLCASTER',
  SUPPORT = 'SUPPORT',
  ZOMBIE = 'ZOMBIE',
  FIEND = 'FIEND',
  FAIRY = 'FAIRY',
  MACHINE = 'MACHINE',
  ROCK = 'ROCK',
}

export enum PrimaryStatus {
  NONE = 'NONE',
  STACKED = 'STACKED',
  PIERCED = 'PIERCED',
  CURSED = 'CURSED',
  BLINDED = 'BLINDED',
  VITALIZED = 'VITALIZED',
  BURN = 'BURN',
  POISON = 'POISON',
  PARALYSIS = 'PARALYSIS',
}

export enum SecondaryStatus {
  SKILL_DRAINED = 'SKILL_DRAINED',
  CHARMED = 'CHARMED',
  CHAINED = 'CHAINED',
  LIFE_DRAINED = 'LIFE_DRAINED',
  TETHERED = 'TETHERED',
  FLINCHED = 'FLINCHED',
  CONFUSED = 'CONFUSED',
  INFATUATED = 'INFATUATED',
}

export interface FieldState {
  id: string;
  duration: number;
}

export interface StatusSource {
  side: TeamSide;
  index: number;
}

export interface MultiHitConfig {
  minHits: number;
  maxHits: number;
}

export interface MoveSchema {
  id: string;
  name: string;
  element: Element;
  category: Category;
  power: number;
  accuracy: number;
  priority: number;
  maxPP: number;
  targetScope: TargetScope;
  effectId?: string;
  hpCostPercent?: number;
  healPercent?: number;
  hpThreshold?: number;
  multiHit?: MultiHitConfig;
}

export interface AbilitySchema {
  id: string;
  name: string;
  description: string;
  effectId?: string;
}

export interface ItemSchema {
  id: string;
  name: string;
  description: string;
  effectId?: string;
}

export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spAtk: number;
  spDef: number;
  spe: number;
}

export interface MonsterSchema {
  id: string;
  name: string;
  archetype?: string;
  isLegendary: boolean;
  baseStats: BaseStats;
  elements: Element[];
  types: MonsterType[];
  abilityId?: string;
  learnset: string[];
}

export type TeamSide = 'ally' | 'opp';

export interface BattleSlot {
  side: TeamSide;
  index: 0 | 1 | 2;
}

export type SlotIndex = 0 | 1 | 2;

export interface StatStages {
  atk: number;
  def: number;
  spAtk: number;
  spDef: number;
  spe: number;
  accuracy: number;
  evasion: number;
}

export function stageMultiplier(stage: number): number {
  if (stage >= 0) return (2 + stage) / 2;
  return 2 / (2 - stage);
}

export function createDefaultStages(): StatStages {
  return { atk: 0, def: 0, spAtk: 0, spDef: 0, spe: 0, accuracy: 0, evasion: 0 };
}

export enum Hazard {
  STEALTH_ROCK = 'STEALTH_ROCK',
}

export interface BattleMon {
  id: string;
  nickname?: string;
  level: number;
  currentHP: number;
  maxHP: number;
  stats: BaseStats;
  abilityId?: string;
  itemId?: string | null;
  primaryStatus: PrimaryStatus;
  primaryStatusTurns: number;
  stackedCount: number;
  secondaryStatuses: SecondaryStatus[];
  secondaryStatusTurns: Record<string, number>;
  statusSource: Record<string, StatusSource>;
  statStages: StatStages;
  lockedMoveId?: string;
}

export interface Team {
  active: [BattleMon | null, BattleMon | null, BattleMon | null];
  bench: BattleMon[];
}

export interface BattleState {
  ally: Team;
  opp: Team;
  weather: { id: string; duration: number | null } | null;
  field: FieldState | null;
  graveyard: { ally: BattleMon[]; opp: BattleMon[] };
  banish: { ally: BattleMon[]; opp: BattleMon[] };
  hazards: { ally: Hazard[]; opp: Hazard[] };
  buffs: { ally: BuffState | null; opp: BuffState | null };
  itemConsumed: Record<string, boolean>;
  turnCount: number;
}

export interface BuffState {
  spAtkMultiplier: number;
  remainingTurns: number;
}

export interface MoveEffectContext {
  engine: unknown;
  user: BattleSlot;
  moveId: string;
  targets: BattleSlot[];
}

export type MoveEffectHook = (ctx: MoveEffectContext) => void | Promise<void>;

export interface EffectsRegistry {
  moveEffects: Record<string, MoveEffectHook>;
  abilityEffects: Record<string, (ctx: { engine: unknown; source: BattleSlot }) => void | Promise<void>>;
  itemEffects: Record<string, (ctx: { engine: unknown; holder: BattleSlot }) => void | Promise<void>>;
}

export function createBattleMon(
  id: string,
  level: number,
  stats: BaseStats,
  abilityId?: string,
  itemId?: string | null,
  nickname?: string,
): BattleMon {
  const hp = stats.hp * 10;
  return {
    id,
    nickname,
    level,
    currentHP: hp,
    maxHP: hp,
    stats,
    abilityId,
    itemId: itemId ?? null,
    primaryStatus: PrimaryStatus.NONE,
    primaryStatusTurns: 0,
    stackedCount: 0,
    secondaryStatuses: [],
    secondaryStatusTurns: {},
    statusSource: {},
    statStages: createDefaultStages(),
  };
}
