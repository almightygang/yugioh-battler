"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PACKS = void 0;
exports.openPack = openPack;
exports.getPacks = getPacks;
exports.getVaultContents = getVaultContents;
const monsters_1 = require("../registries/monsters");
const player_1 = require("./player");
exports.PACKS = [
    {
        id: "master_pack",
        name: "Master Pack",
        cost: 500,
        description: "Contains 1 random monster you don't already own. Collect them all!",
        content: {
            monsters: Object.keys(monsters_1.Monsters).map((id) => ({
                id,
                weight: monsters_1.Monsters[id].isLegendary ? 1 : 3,
                minLevel: 100,
                maxLevel: 100,
            })),
            items: [],
        },
    },
];
function weightedRandom(slots) {
    const total = slots.reduce((s, x) => s + x.weight, 0);
    let roll = Math.random() * total;
    for (const slot of slots) {
        roll -= slot.weight;
        if (roll <= 0)
            return slot;
    }
    return slots[slots.length - 1];
}
function openPack(packId) {
    const pack = exports.PACKS.find((p) => p.id === packId);
    if (!pack)
        return null;
    let p = (0, player_1.loadProfile)();
    if (p.currency < pack.cost)
        return null;
    p.currency -= pack.cost;
    (0, player_1.saveProfile)(p);
    // Only offer monsters not already owned (no dupes)
    const ownedIds = new Set(p.monsterVault.map((m) => m.monsterId));
    const available = pack.content.monsters.filter((s) => !ownedIds.has(s.id));
    if (available.length === 0) {
        // Refund if already own everything
        p.currency += pack.cost;
        (0, player_1.saveProfile)(p);
        return { monster: undefined, items: [] };
    }
    const monsterSlot = weightedRandom(available);
    const monster = { monsterId: monsterSlot.id, level: 100 };
    p = (0, player_1.loadProfile)();
    p.monsterVault.push(monster);
    p.packsOpened = (p.packsOpened || 0) + 1;
    (0, player_1.saveProfile)(p);
    return { monster, items: [] };
}
function getPacks() {
    return exports.PACKS;
}
function getVaultContents() {
    const p = (0, player_1.loadProfile)();
    const mons = p.monsterVault.map((m) => ({
        id: m.monsterId,
        name: monsters_1.Monsters[m.monsterId]?.name || m.monsterId,
        level: m.level,
    }));
    const items = p.itemVault.map((id) => ({
        id,
        name: id,
    }));
    return { monsters: mons, items };
}
