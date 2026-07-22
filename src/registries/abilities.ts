import { AbilitySchema } from "../types";
import abilitiesData from "../database/abilities.json";

const raw: Record<string, any> = (abilitiesData as any).default ?? abilitiesData;

export const Abilities: Record<string, AbilitySchema> = {};

for (const key of Object.keys(raw)) {
  const entry = raw[key];
  Abilities[key] = {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    effectId: entry.effectId,
  };
}
