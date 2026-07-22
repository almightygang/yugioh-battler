"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadProfile = loadProfile;
exports.saveProfile = saveProfile;
exports.getProfile = getProfile;
exports.addCurrency = addCurrency;
exports.spendCurrency = spendCurrency;
exports.addMonsterToVault = addMonsterToVault;
exports.addItemToVault = addItemToVault;
exports.getTeams = getTeams;
exports.saveTeam = saveTeam;
exports.validateTeam = validateTeam;
exports.cloneTeam = cloneTeam;
exports.clearTeam = clearTeam;
exports.unlockTeamSlots = unlockTeamSlots;
exports.renameTeam = renameTeam;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const items_1 = require("../registries/items");
function findRoot(dir) {
    const pkg = path.join(dir, "package.json");
    if (fs.existsSync(pkg))
        return dir;
    const parent = path.dirname(dir);
    if (parent === dir)
        throw new Error("Could not find project root");
    return findRoot(parent);
}
const PROJECT_ROOT = findRoot(__dirname);
const SAVE_PATH = path.join(PROJECT_ROOT, "src", "game", "save.json");
const DEFAULT_TEAMS = Array.from({ length: 10 }, (_, i) => ({
    name: `Team ${i + 1}`,
    slots: [null, null, null, null, null, null],
}));
function createDefaultProfile() {
    return {
        name: "Duelist",
        currency: 1000,
        monsterVault: [],
        itemVault: Object.keys(items_1.Items),
        teams: DEFAULT_TEAMS.map((t) => ({ ...t, slots: [...t.slots] })),
        unlockedTeamSlots: 10,
        packsOpened: 0,
    };
}
function loadProfile() {
    try {
        if (fs.existsSync(SAVE_PATH)) {
            const data = JSON.parse(fs.readFileSync(SAVE_PATH, "utf-8"));
            return data.player;
        }
    }
    catch { }
    return createDefaultProfile();
}
function saveProfile(profile) {
    const state = { player: profile, saveVersion: 1 };
    fs.writeFileSync(SAVE_PATH, JSON.stringify(state, null, 2) + "\n");
}
function getProfile() {
    return loadProfile();
}
function addCurrency(amount) {
    const p = loadProfile();
    p.currency += amount;
    saveProfile(p);
    return p;
}
function spendCurrency(amount) {
    const p = loadProfile();
    if (p.currency < amount)
        return false;
    p.currency -= amount;
    saveProfile(p);
    return true;
}
function addMonsterToVault(monster) {
    const p = loadProfile();
    p.monsterVault.push(monster);
    saveProfile(p);
    return p;
}
function addItemToVault(itemId) {
    const p = loadProfile();
    if (!p.itemVault.includes(itemId))
        p.itemVault.push(itemId);
    saveProfile(p);
    return p;
}
function getTeams() {
    const p = loadProfile();
    return p.teams;
}
function saveTeam(index, team) {
    const p = loadProfile();
    if (index < 0 || index >= p.teams.length)
        return p;
    p.teams[index] = team;
    saveProfile(p);
    return p;
}
function validateTeam(team) {
    const active = team.slots.slice(0, 3);
    const bench = team.slots.slice(3, 6);
    const filledActive = active.filter((s) => s !== null);
    if (filledActive.length < 3)
        return { valid: false, reason: "All 3 active slots must be filled" };
    const usedItems = new Set();
    for (const slot of team.slots) {
        if (slot?.itemId) {
            if (usedItems.has(slot.itemId))
                return { valid: false, reason: `Duplicate item: ${slot.itemId}` };
            usedItems.add(slot.itemId);
        }
    }
    return { valid: true };
}
function cloneTeam(index) {
    const p = loadProfile();
    const src = p.teams[index];
    if (!src)
        return null;
    const clone = {
        name: `${src.name} (Copy)`,
        slots: src.slots.map((s) => (s ? { ...s } : null)),
    };
    p.teams.push(clone);
    saveProfile(p);
    return p;
}
function clearTeam(index) {
    const p = loadProfile();
    if (index >= 0 && index < p.teams.length) {
        p.teams[index] = { name: p.teams[index].name, slots: [null, null, null, null, null, null] };
        saveProfile(p);
    }
    return p;
}
function unlockTeamSlots(count, costPerSlot) {
    const p = loadProfile();
    const totalCost = count * costPerSlot;
    if (p.currency < totalCost)
        return false;
    p.currency -= totalCost;
    p.unlockedTeamSlots += count;
    // Add empty teams
    for (let i = 0; i < count; i++) {
        p.teams.push({ name: `Team ${p.teams.length + 1}`, slots: [null, null, null, null, null, null] });
    }
    saveProfile(p);
    return true;
}
function renameTeam(index, name) {
    const p = loadProfile();
    if (index >= 0 && index < p.teams.length) {
        p.teams[index].name = name;
        saveProfile(p);
    }
    return p;
}
