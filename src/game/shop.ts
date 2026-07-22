import {
  PackDefinition,
  PackResult,
  MonsterInstance,
} from "./types";
import { Monsters } from "../registries/monsters";
import {
  loadProfile,
  saveProfile,
} from "./player";

export const PACKS: PackDefinition[] = [
  {
    id: "master_pack",
    name: "Master Pack",
    cost: 500,
    description: "Contains 1 random monster you don't already own. Collect them all!",
    content: {
      monsters: Object.keys(Monsters).map((id) => ({
        id,
        weight: Monsters[id].isLegendary ? 1 : 3,
        minLevel: 100,
        maxLevel: 100,
      })),
      items: [],
    },
  },
];

function weightedRandom<T extends { weight: number }>(slots: T[]): T {
  const total = slots.reduce((s, x) => s + x.weight, 0);
  let roll = Math.random() * total;
  for (const slot of slots) {
    roll -= slot.weight;
    if (roll <= 0) return slot;
  }
  return slots[slots.length - 1];
}

export function openPack(packId: string): PackResult | null {
  const pack = PACKS.find((p) => p.id === packId);
  if (!pack) return null;

  let p = loadProfile();
  if (p.currency < pack.cost) return null;
  p.currency -= pack.cost;
  saveProfile(p);

  // Only offer monsters not already owned (no dupes)
  const ownedIds = new Set(p.monsterVault.map((m) => m.monsterId));
  const available = pack.content.monsters.filter((s) => !ownedIds.has(s.id));

  if (available.length === 0) {
    // Refund if already own everything
    p.currency += pack.cost;
    saveProfile(p);
    return { monster: undefined, items: [] };
  }

  const monsterSlot = weightedRandom(available);
  const monster: MonsterInstance = { monsterId: monsterSlot.id, level: 100 };

  p = loadProfile();
  p.monsterVault.push(monster);
  p.packsOpened = (p.packsOpened || 0) + 1;
  saveProfile(p);

  return { monster, items: [] };
}

export function getPacks(): PackDefinition[] {
  return PACKS;
}

export function getVaultContents() {
  const p = loadProfile();
  const mons = p.monsterVault.map((m) => ({
    id: m.monsterId,
    name: Monsters[m.monsterId]?.name || m.monsterId,
    level: m.level,
  }));
  const items = p.itemVault.map((id) => ({
    id,
    name: id,
  }));
  return { monsters: mons, items };
}
