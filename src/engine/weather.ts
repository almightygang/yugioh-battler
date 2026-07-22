import { Element, PrimaryStatus, MonsterType, BattleMon } from "../types";

export type WeatherId = 'BLINDING_RADIANCE' | 'HARSH_SUNLIGHT' | 'RAIN' | 'SANDSTORM' | 'HAIL' | string;

export interface Weather {
  id: WeatherId;
  duration: number | null;
}

export const Weathers: Record<string, Weather> = {
  BLINDING_RADIANCE: { id: 'BLINDING_RADIANCE', duration: null },
  HARSH_SUNLIGHT: { id: 'HARSH_SUNLIGHT', duration: 5 },
  RAIN: { id: 'RAIN', duration: 5 },
  SANDSTORM: { id: 'SANDSTORM', duration: 5 },
  HAIL: { id: 'HAIL', duration: 5 },
};

export function weatherDamageModifier(weather: Weather | null, moveElement: Element): number {
  if (!weather) return 1.0;
  switch (weather.id) {
    case 'BLING_RADIANCE':
    case 'BLINDING_RADIANCE':
      if (moveElement === Element.LIGHT) return 1.5;
      return 1.0;
    case 'HARSH_SUNLIGHT':
      if (moveElement === Element.FIRE) return 1.5;
      if (moveElement === Element.WATER) return 0.5;
      return 1.0;
    case 'RAIN':
      if (moveElement === Element.WATER) return 1.5;
      if (moveElement === Element.FIRE) return 0.5;
      return 1.0;
    case 'SANDSTORM':
      if (moveElement === Element.EARTH) return 1.3;
      return 1.0;
    case 'HAIL':
      if (moveElement === Element.WIND) return 1.3;
      return 1.0;
    default:
      return 1.0;
  }
}

export function weatherAccuracyModifier(weather: Weather | null, targetElements: Element[]): number {
  if (!weather) return 1.0;
  if (weather.id === 'BLINDING_RADIANCE') {
    const nonLight = targetElements.every((e) => e !== Element.LIGHT);
    return nonLight ? 0.9 : 1.0;
  }
  return 1.0;
}

export function getWeatherTickDamage(weather: Weather | null, mon: BattleMon, monsterTypes: MonsterType[]): number {
  if (!weather) return 0;
  if (weather.id === 'SANDSTORM') {
    const immune = monsterTypes.some((t) => t === MonsterType.ROCK);
    if (!immune) return Math.floor(mon.maxHP / 16);
  }
  if (weather.id === 'HAIL') {
    const immune = monsterTypes.some((t) => t === MonsterType.WARRIOR);
    if (!immune) return Math.floor(mon.maxHP / 16);
  }
  return 0;
}

export function weatherSpeedModifier(weather: Weather | null, abilityId: string | undefined): number {
  if (!weather) return 1.0;
  if ((weather.id === 'HARSH_SUNLIGHT' && abilityId === 'chlorophyll') ||
      (weather.id === 'RAIN' && abilityId === 'swift_swim')) {
    return 2.0;
  }
  return 1.0;
}

export function typeEffectiveness(moveElement: Element, targetElements: Element[]): number {
  const chart: Record<string, Record<string, number>> = {
    LIGHT: { DARK: 2.0, LIGHT: 1.0, FIRE: 1.0, WATER: 1.0, EARTH: 1.0, WIND: 1.0, NORMAL: 1.0 },
    DARK: { LIGHT: 0.5, DARK: 1.0, FIRE: 1.0, WATER: 1.0, EARTH: 1.0, WIND: 1.0, NORMAL: 1.0 },
    FIRE: { WIND: 1.5, EARTH: 1.0, WATER: 0.5, FIRE: 0.5, LIGHT: 1.0, DARK: 1.0, NORMAL: 1.0 },
    WATER: { FIRE: 2.0, EARTH: 1.5, WIND: 0.5, WATER: 0.5, LIGHT: 1.0, DARK: 1.0, NORMAL: 1.0 },
    EARTH: { FIRE: 1.0, WATER: 1.0, WIND: 0.5, EARTH: 1.0, LIGHT: 1.0, DARK: 1.0, NORMAL: 1.0 },
    WIND: { EARTH: 2.0, FIRE: 0.5, WATER: 1.0, WIND: 1.0, LIGHT: 1.0, DARK: 1.0, NORMAL: 1.0 },
    NORMAL: { NORMAL: 1.0, LIGHT: 1.0, DARK: 1.0, FIRE: 1.0, WATER: 1.0, EARTH: 1.0, WIND: 1.0 },
  };

  let mult = 1.0;
  for (const te of targetElements) {
    const row = chart[moveElement];
    if (!row) { mult *= 1.0; continue; }
    mult *= row[te] ?? 1.0;
  }
  return mult;
}
