import * as fs from "fs";
import * as path from "path";
import {
  PlayerProfile,
  MonsterInstance,
  TeamData,
  TeamSlotData,
} from "./types";
import { Monsters } from "../registries/monsters";
import { Items } from "../registries/items";

function findRoot(dir: string): string {
  const pkg = path.join(dir, "package.json");
  if (fs.existsSync(pkg)) return dir;
  const parent = path.dirname(dir);
  if (parent === dir) throw new Error("Could not find project root");
  return findRoot(parent);
}
const PROJECT_ROOT = findRoot(__dirname);
const SAVE_PATH = path.join(PROJECT_ROOT, "src", "game", "save.json");

const DEFAULT_TEAMS: TeamData[] = Array.from({ length: 10 }, (_, i) => ({
  name: `Team ${i + 1}`,
  slots: [null, null, null, null, null, null],
}));

function createDefaultProfile(): PlayerProfile {
  return {
    name: "Duelist",
    currency: 1000,
    monsterVault: [],
    itemVault: Object.keys(Items),
    teams: DEFAULT_TEAMS.map((t) => ({ ...t, slots: [...t.slots] })),
    unlockedTeamSlots: 10,
    packsOpened: 0,
  };
}

export function loadProfile(): PlayerProfile {
  try {
    if (fs.existsSync(SAVE_PATH)) {
      const data = JSON.parse(fs.readFileSync(SAVE_PATH, "utf-8"));
      return data.player;
    }
  } catch {}
  return createDefaultProfile();
}

export function saveProfile(profile: PlayerProfile): void {
  const state = { player: profile, saveVersion: 1 };
  fs.writeFileSync(SAVE_PATH, JSON.stringify(state, null, 2) + "\n");
}

export function getProfile(): PlayerProfile {
  return loadProfile();
}

export function addCurrency(amount: number): PlayerProfile {
  const p = loadProfile();
  p.currency += amount;
  saveProfile(p);
  return p;
}

export function spendCurrency(amount: number): boolean {
  const p = loadProfile();
  if (p.currency < amount) return false;
  p.currency -= amount;
  saveProfile(p);
  return true;
}

export function addMonsterToVault(monster: MonsterInstance): PlayerProfile {
  const p = loadProfile();
  p.monsterVault.push(monster);
  saveProfile(p);
  return p;
}

export function addItemToVault(itemId: string): PlayerProfile {
  const p = loadProfile();
  if (!p.itemVault.includes(itemId)) p.itemVault.push(itemId);
  saveProfile(p);
  return p;
}

export function getTeams(): TeamData[] {
  const p = loadProfile();
  return p.teams;
}

export function saveTeam(index: number, team: TeamData): PlayerProfile {
  const p = loadProfile();
  if (index < 0 || index >= p.teams.length) return p;
  p.teams[index] = team;
  saveProfile(p);
  return p;
}

export function validateTeam(team: TeamData): { valid: boolean; reason?: string } {
  const active = team.slots.slice(0, 3);
  const bench = team.slots.slice(3, 6);

  const filledActive = active.filter((s) => s !== null);
  if (filledActive.length < 3) return { valid: false, reason: "All 3 active slots must be filled" };

  const usedItems = new Set<string>();
  for (const slot of team.slots) {
    if (slot?.itemId) {
      if (usedItems.has(slot.itemId)) return { valid: false, reason: `Duplicate item: ${slot.itemId}` };
      usedItems.add(slot.itemId);
    }
  }

  return { valid: true };
}

export function cloneTeam(index: number): PlayerProfile | null {
  const p = loadProfile();
  const src = p.teams[index];
  if (!src) return null;
  const clone: TeamData = {
    name: `${src.name} (Copy)`,
    slots: src.slots.map((s) => (s ? { ...s } : null)),
  };
  p.teams.push(clone);
  saveProfile(p);
  return p;
}

export function clearTeam(index: number): PlayerProfile {
  const p = loadProfile();
  if (index >= 0 && index < p.teams.length) {
    p.teams[index] = { name: p.teams[index].name, slots: [null, null, null, null, null, null] };
    saveProfile(p);
  }
  return p;
}

export function unlockTeamSlots(count: number, costPerSlot: number): boolean {
  const p = loadProfile();
  const totalCost = count * costPerSlot;
  if (p.currency < totalCost) return false;
  p.currency -= totalCost;
  p.unlockedTeamSlots += count;
  // Add empty teams
  for (let i = 0; i < count; i++) {
    p.teams.push({ name: `Team ${p.teams.length + 1}`, slots: [null, null, null, null, null, null] });
  }
  saveProfile(p);
  return true;
}

export function renameTeam(index: number, name: string): PlayerProfile {
  const p = loadProfile();
  if (index >= 0 && index < p.teams.length) {
    p.teams[index].name = name;
    saveProfile(p);
  }
  return p;
}
