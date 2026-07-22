import { MoveSchema, Element, Category, TargetScope, MultiHitConfig } from "../types";
import movesData from "../database/moves.json";

const raw: Record<string, any> = (movesData as any).default ?? movesData;

export const Moves: Record<string, MoveSchema> = {};

function parseEnum<T extends Record<string, string>>(enumObj: T, value: string): T[keyof T] {
  return enumObj[value as keyof T] ?? value as unknown as T[keyof T];
}

for (const key of Object.keys(raw)) {
  const entry = raw[key];
  let multiHit: MultiHitConfig | undefined;
  if (entry.multiHit) {
    multiHit = { minHits: entry.multiHit.minHits, maxHits: entry.multiHit.maxHits };
  }
  Moves[key] = {
    id: entry.id,
    name: entry.name,
    element: parseEnum(Element, entry.element),
    category: parseEnum(Category, entry.category),
    power: entry.power,
    accuracy: entry.accuracy,
    priority: entry.priority,
    maxPP: entry.maxPP,
    targetScope: parseEnum(TargetScope, entry.targetScope),
    effectId: entry.effectId,
    hpCostPercent: entry.hpCostPercent,
    healPercent: entry.healPercent,
    hpThreshold: entry.hpThreshold,
    multiHit,
  };
}
