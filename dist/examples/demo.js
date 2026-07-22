"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BattleEngine_1 = require("../src/engine/BattleEngine");
const monsters_1 = require("../src/registries/monsters");
const types_1 = require("../src/types");
function buildBattleMon(monId, level = 100, itemId) {
    const data = monsters_1.Monsters[monId];
    return (0, types_1.createBattleMon)(monId, level, { ...data.baseStats }, data.abilityId, itemId);
}
console.log("=== Yu-Gi-Oh! Battler v0.0.2 — Full Systems Demo ===\n");
// ── Build Teams with Bench ───────────────────────────────────────
const allyTeam = {
    active: [
        buildBattleMon('blue_eyes_white_dragon', 100, 'leftovers'),
        buildBattleMon('the_support', 100, 'expert_belt'),
        buildBattleMon('the_striker', 100, 'life_orb'),
    ],
    bench: [
        buildBattleMon('the_setter', 100, 'focus_sash'),
        buildBattleMon('blue_eyes_white_dragon', 100, 'choice_band'),
        buildBattleMon('megalith_sentry', 100, 'assault_vest'),
    ],
};
const oppTeam = {
    active: [
        buildBattleMon('graveyard_king', 100, 'life_amulet'),
        buildBattleMon('zombie_world_ruler', 100, 'black_sludge'),
        buildBattleMon('dark_magician', 100, 'choice_specs'),
    ],
    bench: [
        buildBattleMon('megalith_sentry', 100, 'leftovers'),
        buildBattleMon('the_striker', 100, 'choice_scarf'),
        buildBattleMon('the_setter', 100, 'rocky_helmet'),
    ],
};
const engine = new BattleEngine_1.BattleEngine(allyTeam, oppTeam);
// ── 1. Stat Stage System ─────────────────────────────────────────
console.log("\n--- Stat Stage System ---");
engine.modifyStatStage({ side: 'opp', index: 0 }, 'atk', -1);
engine.modifyStatStage({ side: 'ally', index: 0 }, 'spAtk', 2);
const bewd = engine.state.ally.active[0];
console.log(`Blue-Eyes base SpAtk: ${bewd.stats.spAtk}, effective: ${engine.getEffectiveStat(bewd, 'spAtk')}`);
// ── 2. Weather System (expanded) ─────────────────────────────────
console.log("\n--- Weather System ---");
engine.setWeather('HARSH_SUNLIGHT');
console.log(`Weather: ${engine.state.weather?.id}, FIRE moves boosted, WATER moves weakened.`);
// ── 3. Hazards (Stealth Rock) ────────────────────────────────────
console.log("\n--- Hazard System ---");
engine.applyHazard('ally', 'STEALTH_ROCK');
console.log(`Ally hazards: ${engine.state.hazards.ally}`);
// ── 4. Switch System ─────────────────────────────────────────────
console.log("\n--- Switch System ---");
const supportSlot = { side: 'ally', index: 1 };
engine.switchMon(supportSlot, 0);
const setter = engine.state.ally.active[1];
console.log(`Slot 1 now: ${setter?.id ?? 'empty'}`);
console.log(`Bench size: ${engine.state.ally.bench.length}`);
// ── 5. Status Tick Damage ────────────────────────────────────────
console.log("\n--- Status Tick Damage ---");
const king = engine.state.opp.active[0];
engine.applyPrimaryStatus({ side: 'opp', index: 0 }, types_1.PrimaryStatus.BURN, 0);
console.log(`${king.id} burned (1/16 max HP/turn).`);
const darkMagician = engine.state.opp.active[2];
engine.applyPrimaryStatus({ side: 'opp', index: 2 }, types_1.PrimaryStatus.POISON, 0);
console.log(`${darkMagician.id} poisoned (1/8 max HP/turn).`);
const striker = engine.state.ally.active[2];
engine.applyPrimaryStatus({ side: 'ally', index: 2 }, types_1.PrimaryStatus.PARALYSIS, 0);
console.log(`${striker.id} paralyzed (25% skip, half SPE).`);
// ── 6. Multi-Hit Move ────────────────────────────────────────────
console.log("\n--- Multi-Hit Move (Dual Wingbeat) ---");
const strikerSlot = { side: 'ally', index: 2 };
engine.executeMove(strikerSlot, 'dual_wingbeat');
const targetAfter = engine.state.opp.active[0];
if (targetAfter)
    console.log(`Graveyard King HP after Dual Wingbeat: ${targetAfter.currentHP}`);
// ── 7. Status Tick (Burn + Poison) ───────────────────────────────
console.log("\n--- End of Turn (Status + Weather + Items) ---");
engine.advanceTurn();
// ── 8. AI Opponent ───────────────────────────────────────────────
console.log("\n--- AI Opponent ---");
engine.executeAITurn('opp');
console.log(`Graveyard King HP: ${engine.state.opp.active[0]?.currentHP ?? 0}`);
// ── 9. Life Orb Recoil + Leftovers ───────────────────────────────
console.log("\n--- Item Effects ---");
const bewdSlot = { side: 'ally', index: 0 };
engine.executeMove(bewdSlot, 'burst_stream_of_destruction');
console.log(`Blue-Eyes HP after Life Orb recoil: ${engine.state.ally.active[0]?.currentHP}`);
// ── 10. Field Spell Override + Intimidate ────────────────────────
console.log("\n--- Field + Intimidate ---");
engine.setField('ZOMBIE_WORLD');
console.log(`Field: ${engine.state.field?.id}`);
const bewdAfter = engine.state.ally.active[0];
console.log(`Blue-Eyes SpAtk stage: ${bewdAfter.statStages.spAtk}`);
// ── 11. Final State ──────────────────────────────────────────────
console.log("\n=== Final State ===");
for (const side of ['ally', 'opp']) {
    console.log(`\n${side.toUpperCase()}:`);
    for (let i = 0; i < 3; i++) {
        const m = engine.state[side].active[i];
        if (m) {
            console.log(`  [${i}] ${m.id} HP:${m.currentHP}/${m.maxHP} PS:${m.primaryStatus} SS:${m.secondaryStatuses.length ? m.secondaryStatuses.join(',') : 'none'}`);
        }
        else {
            console.log(`  [${i}] empty`);
        }
    }
    console.log(`  GY: ${engine.state.graveyard[side].map((m) => m.id).join(', ') || 'empty'}`);
    console.log(`  Hazards: ${engine.state.hazards[side].join(', ') || 'none'}`);
}
console.log(`\nWeather: ${engine.state.weather?.id ?? 'none'}`);
console.log(`Field: ${engine.state.field?.id ?? 'none'}`);
