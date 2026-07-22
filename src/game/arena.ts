import { ArenaStage, ArenaResult, TeamData } from "./types";
import { Monsters } from "../registries/monsters";
import { Items } from "../registries/items";
import { getTeams, saveProfile, loadProfile, addCurrency } from "./player";
import { BattleEngine } from "../engine/BattleEngine";
import { createBattleMon, Element, Team, BattleSlot, SlotIndex } from "../types";

export const STAGES: ArenaStage[] = [
  { id: "rookie", name: "Rookie League", description: "Easy battles to start your journey.", difficulty: 1, reward: 100, monsterLevel: 10, npcTeamSize: 3 },
  { id: "intermediate", name: "Intermediate League", description: "Stronger opponents with better items.", difficulty: 2, reward: 200, monsterLevel: 15, npcTeamSize: 4 },
  { id: "advanced", name: "Advanced League", description: "Tough battles for experienced duelists.", difficulty: 3, reward: 350, monsterLevel: 20, npcTeamSize: 5 },
  { id: "elite", name: "Elite League", description: "Elite opponents with full teams.", difficulty: 4, reward: 500, monsterLevel: 25, npcTeamSize: 6 },
  { id: "champion", name: "Champion League", description: "The ultimate challenge.", difficulty: 5, reward: 1000, monsterLevel: 30, npcTeamSize: 6 },
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateNPCTeam(stage: ArenaStage): Team {
  const monsterIds = Object.keys(Monsters);
  const npcMons = [];
  const size = Math.min(stage.npcTeamSize, 6);
  const usedMonsters = new Set<string>();

  for (let i = 0; i < size; i++) {
    let id: string;
    do { id = pickRandom(monsterIds); } while (usedMonsters.has(id) && usedMonsters.size < monsterIds.length);
    usedMonsters.add(id);

    const schema = Monsters[id];
    const level = 100;
    const itemIds = Object.keys(Items);
    const itemId = Math.random() < 0.5 ? pickRandom(itemIds) : undefined;

    npcMons.push(createBattleMon(id, Math.max(1, level), schema.baseStats, schema.abilityId, itemId));
  }

  const active: [import("../types").BattleMon | null, import("../types").BattleMon | null, import("../types").BattleMon | null] =
    [npcMons[0] || null, npcMons[1] || null, npcMons[2] || null];
  const bench = npcMons.slice(3);

  return { active, bench };
}

function buildPlayerTeam(teamData: TeamData): Team {
  const p = loadProfile();
  const active: [import("../types").BattleMon | null, import("../types").BattleMon | null, import("../types").BattleMon | null] =
    [null, null, null];
  const bench: import("../types").BattleMon[] = [];

  const slots = teamData.slots;
  for (let i = 0; i < 6; i++) {
    const slotData = slots[i];
    if (!slotData) continue;
    const mi = p.monsterVault[slotData.monsterVaultIndex];
    if (!mi) continue;
    const schema = Monsters[mi.monsterId];
    if (!schema) continue;
    const mon = createBattleMon(mi.monsterId, mi.level, schema.baseStats, schema.abilityId, slotData.itemId || null);

    if (i < 3) {
      active[i as SlotIndex] = mon;
    } else {
      bench.push(mon);
    }
  }

  return { active, bench };
}

export function getStages(): ArenaStage[] {
  return STAGES;
}

export function runBattle(teamIndex: number, stageId: string): ArenaResult {
  const stage = STAGES.find((s) => s.id === stageId);
  if (!stage) return { won: false, reward: 0, log: ["Invalid stage."] };

  const teams = getTeams();
  const teamData = teams[teamIndex];
  if (!teamData) return { won: false, reward: 0, log: ["Invalid team index."] };

  const playerTeam = buildPlayerTeam(teamData);

  // Validate player has at least 1 monster
  const hasMon = playerTeam.active.some((m) => m !== null) || playerTeam.bench.length > 0;
  if (!hasMon) return { won: false, reward: 0, log: ["Your team has no monsters!"] };

  const npcTeam = generateNPCTeam(stage);
  const log: string[] = [];
  const originalLog = console.log;
  console.log = (...args: any[]) => {
    log.push(args.map(String).join(" "));
    originalLog(...args);
  };

  try {
    const engine = new BattleEngine(playerTeam, npcTeam);

    // Simple battle: alternate turns for several rounds
    let playerSide: "ally" | "opp" = "ally";
    for (let turn = 0; turn < 10; turn++) {
      const attacker = turn % 2 === 0 ? "ally" : "opp";
      const defender = attacker === "ally" ? "opp" : "ally";

      engine.executeAITurn(attacker as "ally" | "opp");

      // Check win condition
      const oppAlive = engine.state.opp.active.some((m) => m && m.currentHP > 0) ||
        engine.state.opp.bench.some((m) => m.currentHP > 0);
      const allyAlive = engine.state.ally.active.some((m) => m && m.currentHP > 0) ||
        engine.state.ally.bench.some((m) => m.currentHP > 0);

      if (!oppAlive) {
        const reward = stage.reward;
        addCurrency(reward);
        return { won: true, reward, log };
      }
      if (!allyAlive) {
        return { won: false, reward: 0, log };
      }

      engine.advanceTurn();
    }

    // Timeout: whoever has more total HP wins
    const allyHP = engine.state.ally.active.reduce((s, m) => s + (m?.currentHP || 0), 0) +
      engine.state.ally.bench.reduce((s, m) => s + (m?.currentHP || 0), 0);
    const oppHP = engine.state.opp.active.reduce((s, m) => s + (m?.currentHP || 0), 0) +
      engine.state.opp.bench.reduce((s, m) => s + (m?.currentHP || 0), 0);

    if (allyHP > oppHP) {
      const reward = Math.floor(stage.reward / 2);
      addCurrency(reward);
      return { won: true, reward, log };
    }

    return { won: false, reward: 0, log };
  } catch (e: any) {
    log.push(`ERROR: ${e.message}`);
    return { won: false, reward: 0, log };
  } finally {
    console.log = originalLog;
  }
}
