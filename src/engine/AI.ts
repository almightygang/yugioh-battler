import { BattleSlot, BattleMon, MonsterSchema, SlotIndex } from "../types";
import { Monsters } from "../registries/monsters";

export function getAIMove(
  getActiveMon: (slot: BattleSlot) => BattleMon | null,
  getMonsterData: (id: string) => MonsterSchema | undefined,
  slot: BattleSlot,
): string | null {
  const mon = getActiveMon(slot);
  if (!mon) return null;

  const lockedMove = mon.lockedMoveId;
  if (lockedMove) return lockedMove;

  const schema = getMonsterData(mon.id);
  if (!schema || !schema.learnset.length) return null;

  const idx = Math.floor(Math.random() * schema.learnset.length);
  return schema.learnset[idx];
}

export function getAISlot(
  state: { ally: any; opp: any },
  side: 'ally' | 'opp',
): BattleSlot | null {
  for (let i = 0 as 0 | 1 | 2; i <= 2; i = (i + 1) as SlotIndex) {
    const mon = state[side].active[i];
    if (mon && mon.currentHP > 0) return { side, index: i };
  }
  return null;
}
