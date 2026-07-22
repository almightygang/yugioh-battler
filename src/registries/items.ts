import { ItemSchema } from "../types";
import itemsData from "../database/items.json";

const raw: Record<string, any> = (itemsData as any).default ?? itemsData;

export const Items: Record<string, ItemSchema> = {};

for (const key of Object.keys(raw)) {
  const entry = raw[key];
  Items[key] = {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    effectId: entry.effectId,
  };
}
