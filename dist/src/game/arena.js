"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STAGES = void 0;
exports.getStages = getStages;
exports.runBattle = runBattle;
const monsters_1 = require("../registries/monsters");
const items_1 = require("../registries/items");
const player_1 = require("./player");
const BattleEngine_1 = require("../engine/BattleEngine");
const types_1 = require("../types");
exports.STAGES = [
    { id: "rookie", name: "Rookie League", description: "Easy battles to start your journey.", difficulty: 1, reward: 100, monsterLevel: 10, npcTeamSize: 3 },
    { id: "intermediate", name: "Intermediate League", description: "Stronger opponents with better items.", difficulty: 2, reward: 200, monsterLevel: 15, npcTeamSize: 4 },
    { id: "advanced", name: "Advanced League", description: "Tough battles for experienced duelists.", difficulty: 3, reward: 350, monsterLevel: 20, npcTeamSize: 5 },
    { id: "elite", name: "Elite League", description: "Elite opponents with full teams.", difficulty: 4, reward: 500, monsterLevel: 25, npcTeamSize: 6 },
    { id: "champion", name: "Champion League", description: "The ultimate challenge.", difficulty: 5, reward: 1000, monsterLevel: 30, npcTeamSize: 6 },
];
function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function generateNPCTeam(stage) {
    const monsterIds = Object.keys(monsters_1.Monsters);
    const npcMons = [];
    const size = Math.min(stage.npcTeamSize, 6);
    const usedMonsters = new Set();
    for (let i = 0; i < size; i++) {
        let id;
        do {
            id = pickRandom(monsterIds);
        } while (usedMonsters.has(id) && usedMonsters.size < monsterIds.length);
        usedMonsters.add(id);
        const schema = monsters_1.Monsters[id];
        const level = 100;
        const itemIds = Object.keys(items_1.Items);
        const itemId = Math.random() < 0.5 ? pickRandom(itemIds) : undefined;
        npcMons.push((0, types_1.createBattleMon)(id, Math.max(1, level), schema.baseStats, schema.abilityId, itemId));
    }
    const active = [npcMons[0] || null, npcMons[1] || null, npcMons[2] || null];
    const bench = npcMons.slice(3);
    return { active, bench };
}
function buildPlayerTeam(teamData) {
    const p = (0, player_1.loadProfile)();
    const active = [null, null, null];
    const bench = [];
    const slots = teamData.slots;
    for (let i = 0; i < 6; i++) {
        const slotData = slots[i];
        if (!slotData)
            continue;
        const mi = p.monsterVault[slotData.monsterVaultIndex];
        if (!mi)
            continue;
        const schema = monsters_1.Monsters[mi.monsterId];
        if (!schema)
            continue;
        const mon = (0, types_1.createBattleMon)(mi.monsterId, mi.level, schema.baseStats, schema.abilityId, slotData.itemId || null);
        if (i < 3) {
            active[i] = mon;
        }
        else {
            bench.push(mon);
        }
    }
    return { active, bench };
}
function getStages() {
    return exports.STAGES;
}
function runBattle(teamIndex, stageId) {
    const stage = exports.STAGES.find((s) => s.id === stageId);
    if (!stage)
        return { won: false, reward: 0, log: ["Invalid stage."] };
    const teams = (0, player_1.getTeams)();
    const teamData = teams[teamIndex];
    if (!teamData)
        return { won: false, reward: 0, log: ["Invalid team index."] };
    const playerTeam = buildPlayerTeam(teamData);
    // Validate player has at least 1 monster
    const hasMon = playerTeam.active.some((m) => m !== null) || playerTeam.bench.length > 0;
    if (!hasMon)
        return { won: false, reward: 0, log: ["Your team has no monsters!"] };
    const npcTeam = generateNPCTeam(stage);
    const log = [];
    const originalLog = console.log;
    console.log = (...args) => {
        log.push(args.map(String).join(" "));
        originalLog(...args);
    };
    try {
        const engine = new BattleEngine_1.BattleEngine(playerTeam, npcTeam);
        // Simple battle: alternate turns for several rounds
        let playerSide = "ally";
        for (let turn = 0; turn < 10; turn++) {
            const attacker = turn % 2 === 0 ? "ally" : "opp";
            const defender = attacker === "ally" ? "opp" : "ally";
            engine.executeAITurn(attacker);
            // Check win condition
            const oppAlive = engine.state.opp.active.some((m) => m && m.currentHP > 0) ||
                engine.state.opp.bench.some((m) => m.currentHP > 0);
            const allyAlive = engine.state.ally.active.some((m) => m && m.currentHP > 0) ||
                engine.state.ally.bench.some((m) => m.currentHP > 0);
            if (!oppAlive) {
                const reward = stage.reward;
                (0, player_1.addCurrency)(reward);
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
            (0, player_1.addCurrency)(reward);
            return { won: true, reward, log };
        }
        return { won: false, reward: 0, log };
    }
    catch (e) {
        log.push(`ERROR: ${e.message}`);
        return { won: false, reward: 0, log };
    }
    finally {
        console.log = originalLog;
    }
}
