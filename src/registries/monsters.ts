import { MonsterSchema, Element, MonsterType } from "../types";
import monstersData from "../database/monsters.json";

const raw: Record<string, any> = (monstersData as any).default ?? monstersData;

export const Monsters: Record<string, MonsterSchema> = {};

function parseEnumList<T extends Record<string, string>>(enumObj: T, values: string[]): T[keyof T][] {
  return values.map((v) => (enumObj[v as keyof T] ?? v) as unknown as T[keyof T]);
}

for (const key of Object.keys(raw)) {
  const entry = raw[key];
  Monsters[key] = {
    id: entry.id,
    name: entry.name,
    archetype: entry.archetype,
    isLegendary: entry.isLegendary,
    baseStats: { ...entry.baseStats },
    elements: parseEnumList(Element, entry.elements),
    types: parseEnumList(MonsterType, entry.types),
    abilityId: entry.abilityId ?? undefined,
    learnset: [...entry.learnset],
  };
}
