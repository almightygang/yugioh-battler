"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BattleEngine = void 0;
const moves_1 = require("../registries/moves");
const monsters_1 = require("../registries/monsters");
const types_1 = require("../types");
const weather_1 = require("./weather");
const field_1 = require("./field");
const effects_1 = require("./effects");
const AI_1 = require("./AI");
class BattleEngine {
    static validateTeam(team, label) {
        if (team.active.length !== 3)
            throw new Error(`${label} team must have exactly 3 active slots, got ${team.active.length}`);
        if (team.bench.length > 3)
            throw new Error(`${label} team bench cannot exceed 3, got ${team.bench.length}`);
    }
    constructor(allyTeam, oppTeam) {
        this._lastAttacker = null;
        BattleEngine.validateTeam(allyTeam, 'Ally');
        BattleEngine.validateTeam(oppTeam, 'Opponent');
        this.state = {
            ally: allyTeam, opp: oppTeam,
            weather: null, field: null,
            graveyard: { ally: [], opp: [] },
            banish: { ally: [], opp: [] },
            hazards: { ally: [], opp: [] },
            buffs: { ally: null, opp: null },
            itemConsumed: {},
            turnCount: 0,
        };
        const sides = ['ally', 'opp'];
        for (const side of sides)
            for (let i = 0; i <= 2; i = (i + 1)) {
                const m = this.state[side].active[i];
                if (m)
                    this.enterBattle({ side, index: i });
            }
    }
    slotKey(s) { return `${s.side}-${s.index}`; }
    getMonInSlot(slot) { return this.state[slot.side].active[slot.index]; }
    getMonsterData(id) { return monsters_1.Monsters[id]; }
    // ── Effects Dispatch ────────────────────────────────────────────
    triggerAbility(abilityId, slot) {
        if (!abilityId)
            return;
        const key = 'ability:' + abilityId;
        if (effects_1.abilityEffects[key])
            effects_1.abilityEffects[key]({ engine: this, source: slot });
    }
    triggerItem(itemId, slot) {
        if (!itemId)
            return;
        const key = 'item:' + itemId;
        if (effects_1.itemEffects[key])
            effects_1.itemEffects[key]({ engine: this, holder: slot });
    }
    // ── Effective Speed ────────────────────────────────────────────
    getEffectiveSpeed(mon) {
        let spe = mon.stats.spe;
        spe = Math.floor(spe * (0, types_1.stageMultiplier)(mon.statStages.spe));
        // Paralysis halves speed
        if (mon.primaryStatus === types_1.PrimaryStatus.PARALYSIS)
            spe = Math.floor(spe * 0.5);
        // Iron Ball halves speed
        if (mon.itemId === 'iron_ball')
            spe = Math.floor(spe * 0.5);
        // Choice Scarf 1.5x
        if (mon.itemId === 'choice_scarf')
            spe = Math.floor(spe * 1.5);
        // Swift Swim 2x in Rain
        if (mon.abilityId === 'swift_swim' && this.state.weather?.id === 'RAIN')
            spe = Math.floor(spe * 2);
        // Chlorophyll 2x in Harsh Sunlight
        if (mon.abilityId === 'chlorophyll' && this.state.weather?.id === 'HARSH_SUNLIGHT')
            spe = Math.floor(spe * 2);
        return Math.max(1, spe);
    }
    // ── Stat Stage System ──────────────────────────────────────────
    modifyStatStage(slot, stat, delta) {
        const mon = this.state[slot.side].active[slot.index];
        if (!mon)
            return;
        const old = mon.statStages[stat];
        mon.statStages[stat] = Math.max(-6, Math.min(6, old + delta));
        const d = mon.statStages[stat] - old;
        if (d !== 0)
            console.log(`${mon.id}: ${stat} ${d > 0 ? 'raised' : 'lowered'} by ${Math.abs(d)} (now ${mon.statStages[stat]}).`);
    }
    resetStatStages(slot) {
        const mon = this.state[slot.side].active[slot.index];
        if (!mon)
            return;
        mon.statStages = { atk: 0, def: 0, spAtk: 0, spDef: 0, spe: 0, accuracy: 0, evasion: 0 };
    }
    getEffectiveStat(mon, stat) {
        return Math.floor(mon.stats[stat] * (0, types_1.stageMultiplier)(mon.statStages[stat]));
    }
    // ── Weather System ─────────────────────────────────────────────
    setWeather(weatherId) {
        this.state.weather = { id: weatherId, duration: weather_1.Weathers[weatherId]?.duration ?? null };
        console.log(`Weather changed to ${weatherId}.`);
    }
    clearWeather() { this.state.weather = null; console.log(`Weather cleared.`); }
    // ── Status System ──────────────────────────────────────────────
    applyPrimaryStatus(slot, status, turns) {
        const mon = this.state[slot.side].active[slot.index];
        if (!mon)
            return;
        if (status === types_1.PrimaryStatus.STACKED) {
            mon.stackedCount = Math.min(5, mon.stackedCount + 1);
            console.log(`STACKED increased to ${mon.stackedCount} on ${mon.id}.`);
            if (mon.stackedCount >= 5) {
                mon.primaryStatus = types_1.PrimaryStatus.STACKED;
                mon.primaryStatusTurns = 2;
                mon.stackedCount = 0;
                console.log(`STACKED detonated on ${mon.id}: Paralysis + Confusion!`);
            }
            return;
        }
        mon.primaryStatus = status;
        mon.primaryStatusTurns = turns;
        console.log(`${mon.id} afflicted with ${status}${turns ? ` for ${turns} turns` : ''}.`);
    }
    removePrimaryStatus(slot) {
        const mon = this.state[slot.side].active[slot.index];
        if (!mon)
            return;
        const old = mon.primaryStatus;
        mon.primaryStatus = types_1.PrimaryStatus.NONE;
        mon.primaryStatusTurns = 0;
        mon.stackedCount = 0;
        if (old !== types_1.PrimaryStatus.NONE)
            console.log(`${mon.id} cured of ${old}.`);
    }
    applySecondaryStatus(slot, status, turns, source) {
        const mon = this.state[slot.side].active[slot.index];
        if (!mon)
            return;
        if (!mon.secondaryStatuses.includes(status))
            mon.secondaryStatuses.push(status);
        mon.secondaryStatusTurns[status] = turns;
        if (source)
            mon.statusSource[status] = { side: source.side, index: source.index };
        console.log(`${mon.id} afflicted with ${status} for ${turns} turns.`);
    }
    removeSecondaryStatus(slot, status) {
        const mon = this.state[slot.side].active[slot.index];
        if (!mon)
            return;
        mon.secondaryStatuses = mon.secondaryStatuses.filter((s) => s !== status);
        delete mon.secondaryStatusTurns[status];
        delete mon.statusSource[status];
    }
    // ── GY / Banish System ─────────────────────────────────────────
    faintMon(slot) {
        const mon = this.state[slot.side].active[slot.index];
        if (!mon)
            return;
        if (mon.currentHP <= 0)
            return;
        // Revival Ring: revive at 30% HP instead of fainting (once)
        if (mon.itemId === 'revival_ring') {
            mon.currentHP = Math.floor(mon.maxHP * 0.3);
            mon.itemId = null;
            console.log(`Revival Ring: ${mon.id} survived with 30% HP.`);
            return;
        }
        // Sturdy / Focus Sash: survive OHKO from full HP
        if ((mon.abilityId === 'sturdy' || mon.itemId === 'focus_sash')) {
            const pct = this.getHPPercent(slot);
            if (pct >= 99.9) {
                mon.currentHP = 1;
                if (mon.itemId === 'focus_sash')
                    mon.itemId = null;
                console.log(`${mon.id} survived with 1 HP (${mon.abilityId === 'sturdy' ? 'Sturdy' : 'Focus Sash'}).`);
                return;
            }
        }
        mon.currentHP = 0;
        this.state.graveyard[slot.side].push(mon);
        this.state[slot.side].active[slot.index] = null;
        console.log(`${mon.id} fainted and was sent to the GY.`);
    }
    banishMon(slot) {
        const mon = this.state[slot.side].active[slot.index];
        if (!mon)
            return;
        this.state.banish[slot.side].push(mon);
        this.state[slot.side].active[slot.index] = null;
        console.log(`${mon.id} was banished.`);
    }
    reviveFromGY(side, gyIndex, targetSlot) {
        const gy = this.state.graveyard[side];
        if (gyIndex < 0 || gyIndex >= gy.length)
            return false;
        const mon = gy.splice(gyIndex, 1)[0];
        mon.currentHP = Math.floor(mon.maxHP / 2);
        this.state[side].active[targetSlot.index] = mon;
        console.log(`${mon.id} revived from GY with 50% HP.`);
        return true;
    }
    // ── Hazard System ──────────────────────────────────────────────
    applyHazard(side, hazard) {
        const h = hazard;
        if (!this.state.hazards[side].includes(h)) {
            this.state.hazards[side].push(h);
            console.log(`Hazards set on ${side}'s field: ${hazard}.`);
        }
    }
    processHazards(slot) {
        const mon = this.state[slot.side].active[slot.index];
        if (!mon)
            return;
        const hazards = this.state.hazards[slot.side];
        if (hazards.includes(types_1.Hazard.STEALTH_ROCK)) {
            if (mon.itemId === 'heavy_duty_boots') {
                console.log(`Heavy-Duty Boots: ${mon.id} avoided Stealth Rock.`);
                return;
            }
            const dmg = Math.floor(mon.maxHP * 0.125);
            mon.currentHP = Math.max(0, mon.currentHP - dmg);
            console.log(`Stealth Rock: ${mon.id} took ${dmg} damage.`);
            if (mon.currentHP <= 0)
                this.faintMon(slot);
        }
    }
    // ── Field System ───────────────────────────────────────────────
    setField(fieldId) {
        const entry = field_1.FieldRegistry[fieldId];
        if (!entry)
            return;
        this.state.field = { id: fieldId, duration: entry.duration };
        console.log(`Field Spell activated: ${fieldId}.`);
    }
    clearField() {
        if (this.state.field) {
            console.log(`Field ${this.state.field.id} dissipated.`);
            this.state.field = null;
        }
    }
    // ── Switch System ──────────────────────────────────────────────
    switchMon(slot, benchIndex) {
        const bench = this.state[slot.side].bench;
        if (benchIndex < 0 || benchIndex >= bench.length)
            return false;
        const replacement = bench[benchIndex];
        if (!replacement || replacement.currentHP <= 0)
            return false;
        const current = this.state[slot.side].active[slot.index];
        if (current) {
            this.triggerAbility(current.abilityId, slot);
            current.secondaryStatuses = [];
            current.secondaryStatusTurns = {};
            current.statusSource = {};
            bench[benchIndex] = current;
        }
        this.state[slot.side].active[slot.index] = replacement;
        bench.splice(benchIndex, 1);
        this.processHazards(slot);
        this.enterBattle(slot);
        return true;
    }
    // ── Life Conversion ────────────────────────────────────────────
    lifeConversionSacrifice(slot, percent) {
        const mon = this.state[slot.side].active[slot.index];
        if (!mon)
            return false;
        const cost = Math.floor(mon.maxHP * (percent / 100));
        if (mon.currentHP <= cost)
            return false;
        mon.currentHP -= cost;
        return true;
    }
    lifeConversionHeal(slot, percent) {
        const mon = this.state[slot.side].active[slot.index];
        if (!mon)
            return;
        mon.currentHP = Math.min(mon.maxHP, mon.currentHP + Math.floor(mon.maxHP * (percent / 100)));
    }
    getHPPercent(slot) {
        const mon = slot instanceof Object && 'currentHP' in slot ? slot : this.state[slot.side].active[slot.index];
        if (!mon)
            return 100;
        return (mon.currentHP / mon.maxHP) * 100;
    }
    // ── Entry Triggers ─────────────────────────────────────────────
    enterBattle(slot) {
        const mon = this.state[slot.side].active[slot.index];
        if (!mon)
            return;
        this.triggerAbility(mon.abilityId, slot);
    }
    findAllyWithAbility(side, abilityId, excludeIndex) {
        for (let i = 0; i <= 2; i = (i + 1)) {
            if (i === excludeIndex)
                continue;
            const m = this.state[side].active[i];
            if (m && m.abilityId === abilityId && m.currentHP > 0)
                return { side, index: i };
        }
        return null;
    }
    applyEyesOfBlue(side, turns = 2) {
        this.state.buffs[side] = { spAtkMultiplier: 1.2, remainingTurns: turns };
        console.log(`Eyes of Blue: SpAtk x1.2 buff for ${side}.`);
    }
    // ── Turn Processing ────────────────────────────────────────────
    advanceTurn() {
        this.state.turnCount++;
        const sides = ['ally', 'opp'];
        for (const s of sides) {
            const b = this.state.buffs[s];
            if (b) {
                b.remainingTurns--;
                if (b.remainingTurns <= 0)
                    this.state.buffs[s] = null;
            }
        }
        if (this.state.field) {
            this.state.field.duration--;
            if (this.state.field.duration <= 0)
                this.clearField();
        }
        for (const side of sides) {
            for (let i = 0; i <= 2; i = (i + 1)) {
                const mon = this.state[side].active[i];
                if (!mon || mon.currentHP <= 0)
                    continue;
                this.processStatusTick({ side, index: i });
                this.processItemTick({ side, index: i });
            }
        }
    }
    processItemTick(slot) {
        const mon = this.state[slot.side].active[slot.index];
        if (!mon)
            return;
        this.triggerItem(mon.itemId, slot);
    }
    processWeatherTick(slot) {
        const mon = this.state[slot.side].active[slot.index];
        if (!mon)
            return;
        const reg = monsters_1.Monsters[mon.id];
        const types = reg?.types ?? [];
        const dmg = (0, weather_1.getWeatherTickDamage)(this.state.weather, mon, types);
        if (dmg > 0) {
            mon.currentHP = Math.max(0, mon.currentHP - dmg);
            console.log(`Weather: ${mon.id} took ${dmg} damage.`);
            if (mon.currentHP <= 0)
                this.faintMon(slot);
        }
    }
    processStatusTick(slot) {
        const mon = this.state[slot.side].active[slot.index];
        if (!mon)
            return;
        // Weather tick
        this.processWeatherTick(slot);
        if (mon.currentHP <= 0)
            return;
        // Primary status tick
        if (mon.primaryStatus !== types_1.PrimaryStatus.NONE) {
            if (mon.primaryStatus === types_1.PrimaryStatus.CURSED) {
                const dmg = Math.max(1, Math.floor(mon.maxHP / 8));
                mon.currentHP = Math.max(0, mon.currentHP - dmg);
                console.log(`Cursed: ${mon.id} lost ${dmg} HP.`);
                if (mon.currentHP <= 0) {
                    const src = mon.statusSource[types_1.PrimaryStatus.CURSED];
                    if (src) {
                        const sm = this.state[src.side].active[src.index];
                        if (sm) {
                            sm.currentHP = Math.max(0, sm.currentHP - Math.floor(mon.maxHP * 0.25));
                        }
                    }
                    this.faintMon(slot);
                    return;
                }
            }
            if (mon.primaryStatus === types_1.PrimaryStatus.BURN) {
                const dmg = Math.max(1, Math.floor(mon.maxHP / 16));
                mon.currentHP = Math.max(0, mon.currentHP - dmg);
                console.log(`Burn: ${mon.id} lost ${dmg} HP.`);
                if (mon.currentHP <= 0) {
                    this.faintMon(slot);
                    return;
                }
            }
            if (mon.primaryStatus === types_1.PrimaryStatus.POISON) {
                const dmg = Math.max(1, Math.floor(mon.maxHP / 8));
                mon.currentHP = Math.max(0, mon.currentHP - dmg);
                console.log(`Poison: ${mon.id} lost ${dmg} HP.`);
                if (mon.currentHP <= 0) {
                    this.faintMon(slot);
                    return;
                }
            }
            if (mon.primaryStatus === types_1.PrimaryStatus.PARALYSIS) {
                const skip = Math.random() < 0.25;
                if (skip)
                    console.log(`Paralysis: ${mon.id} is fully paralyzed!`);
            }
            if (mon.primaryStatus === types_1.PrimaryStatus.STACKED) {
                mon.stackedCount = Math.min(5, mon.stackedCount + 1);
                if (mon.stackedCount >= 5) {
                    mon.stackedCount = 0;
                    console.log(`STACKED detonated on ${mon.id}.`);
                }
            }
            if (mon.primaryStatus !== types_1.PrimaryStatus.STACKED && mon.primaryStatus !== types_1.PrimaryStatus.NONE) {
                if (mon.primaryStatusTurns > 0) {
                    mon.primaryStatusTurns--;
                    if (mon.primaryStatusTurns <= 0)
                        this.removePrimaryStatus(slot);
                }
            }
        }
        // Secondary status tick
        for (const sec of [...mon.secondaryStatuses]) {
            if (sec === types_1.SecondaryStatus.LIFE_DRAINED) {
                const dmg = Math.max(1, Math.floor(mon.maxHP / 8));
                mon.currentHP = Math.max(0, mon.currentHP - dmg);
                const src = mon.statusSource[types_1.SecondaryStatus.LIFE_DRAINED];
                if (src) {
                    const sm = this.state[src.side].active[src.index];
                    if (sm)
                        sm.currentHP = Math.min(sm.maxHP, sm.currentHP + dmg);
                }
                if (mon.currentHP <= 0) {
                    this.faintMon(slot);
                    return;
                }
            }
            if (sec === types_1.SecondaryStatus.CHARMED) {
                const roll = Math.random();
                if (roll < 0.3) {
                    console.log(`Charmed: ${mon.id} is charmed and can't act.`);
                }
                else if (roll < 0.5) {
                    const opp = slot.side === 'ally' ? 'opp' : 'ally';
                    for (let i = 0; i <= 2; i = (i + 1)) {
                        const t = this.state[opp].active[i];
                        if (t) {
                            t.currentHP = Math.min(t.maxHP, t.currentHP + Math.floor(t.maxHP / 16));
                            break;
                        }
                    }
                }
            }
            if (sec === types_1.SecondaryStatus.CHAINED) {
                mon.stats.spe = Math.max(1, mon.stats.spe - Math.floor(mon.stats.spe * 0.1));
            }
            if (sec === types_1.SecondaryStatus.INFATUATED) {
                if (Math.random() < 0.3) {
                    const opp = slot.side === 'ally' ? 'opp' : 'ally';
                    for (let i = 0; i <= 2; i = (i + 1)) {
                        const t = this.state[opp].active[i];
                        if (t) {
                            t.currentHP = Math.min(t.maxHP, t.currentHP + Math.floor(t.maxHP / 16));
                            break;
                        }
                    }
                }
            }
            const t = (mon.secondaryStatusTurns[sec] ?? 0) - 1;
            if (t <= 0)
                this.removeSecondaryStatus(slot, sec);
            else
                mon.secondaryStatusTurns[sec] = t;
        }
    }
    // ── Target Resolution ──────────────────────────────────────────
    resolveTargets(user, scope, moveId) {
        const opp = user.side === 'ally' ? 'opp' : 'ally';
        const maybeRedirect = (candidate) => {
            const tm = this.state[candidate.side].active[candidate.index];
            if (!tm)
                return candidate;
            const reg = monsters_1.Monsters[tm.id];
            const isDragon = reg && reg.types.includes(types_1.MonsterType.DRAGON);
            if (isDragon) {
                const r = this.findAllyWithAbility(candidate.side, 'eyes_of_blue', candidate.index);
                if (r) {
                    this.applyEyesOfBlue(r.side);
                    return r;
                }
            }
            if (tm.abilityId === 'eyes_of_blue')
                this.applyEyesOfBlue(candidate.side);
            return candidate;
        };
        const alive = (side, idx) => {
            const m = this.state[side].active[idx];
            return m !== null && m !== undefined && m.currentHP > 0;
        };
        switch (scope) {
            case types_1.TargetScope.SELF: return [user];
            case types_1.TargetScope.SINGLE_ADJACENT: {
                for (const idx of [user.index, user.index - 1, user.index + 1].filter((i) => i >= 0 && i <= 2))
                    if (alive(opp, idx))
                        return [maybeRedirect({ side: opp, index: idx })];
                return [];
            }
            case types_1.TargetScope.SINGLE_ANY: {
                for (let i = 0; i <= 2; i = (i + 1))
                    if (alive(opp, i))
                        return [maybeRedirect({ side: opp, index: i })];
                return [];
            }
            case types_1.TargetScope.ALL_OPPONENTS: {
                const out = [];
                for (let i = 0; i <= 2; i = (i + 1))
                    if (alive(opp, i))
                        out.push(maybeRedirect({ side: opp, index: i }));
                return out;
            }
            case types_1.TargetScope.EVERYONE_BUT_USER: {
                const slots = [];
                for (const s of ['ally', 'opp'])
                    for (let i = 0; i <= 2; i = (i + 1))
                        if (!(s === user.side && i === user.index) && alive(s, i))
                            slots.push(maybeRedirect({ side: s, index: i }));
                return slots;
            }
            case types_1.TargetScope.ALL_ADJACENT_ALLIES: {
                const slots = [];
                for (let i = 0; i <= 2; i = (i + 1))
                    if (alive(user.side, i))
                        slots.push({ side: user.side, index: i });
                return slots;
            }
            default: return [];
        }
    }
    // ── Damage & Accuracy ──────────────────────────────────────────
    hasAbility(mon, id) {
        return mon.abilityId === id && !mon.secondaryStatuses.includes(types_1.SecondaryStatus.SKILL_DRAINED);
    }
    computeDamage(userSide, userMon, targetMon, move, isCritical, targetSlot) {
        const level = userMon.level;
        const isPhysical = move.category === 'Physical';
        let Araw = isPhysical ? userMon.stats.atk : userMon.stats.spAtk;
        const spBuff = this.state.buffs[userSide]?.spAtkMultiplier ?? 1.0;
        let A = isPhysical ? Araw : Math.floor(Araw * spBuff);
        // Guts: 1.5x ATK if statused
        if (isPhysical && this.hasAbility(userMon, 'guts') && userMon.primaryStatus !== types_1.PrimaryStatus.NONE) {
            A = Math.floor(A * 1.5);
        }
        // Choice Band/Specs
        if (isPhysical && userMon.itemId === 'choice_band')
            A = Math.floor(A * 1.5);
        if (!isPhysical && move.category !== 'Status' && userMon.itemId === 'choice_specs')
            A = Math.floor(A * 1.5);
        const Dstat = isPhysical ? targetMon.stats.def : targetMon.stats.spDef;
        let D = this.getEffectiveStat(targetMon, isPhysical ? 'def' : 'spDef');
        // Assault Vest: 1.5x SpDef
        if (!isPhysical && targetMon.itemId === 'assault_vest')
            D = Math.floor(D * 1.5);
        let base = Math.floor((((2 * level) / 5 + 2) * move.power * (A / D)) / 50 + 2);
        const critMult = isCritical ? 1.5 : 1.0;
        const randomFactor = 0.85 + Math.random() * 0.15;
        const ue = monsters_1.Monsters[userMon.id]?.elements ?? [];
        const stab = ue.includes(move.element) ? 1.5 : 1.0;
        let te = monsters_1.Monsters[targetMon.id]?.elements ?? [];
        if (this.state.field) {
            const o = (0, field_1.getFieldElementOverride)(this.state.field);
            if (o)
                te = [o];
        }
        const typeEff = (0, weather_1.typeEffectiveness)(move.element, te);
        const weatherMod = (0, weather_1.weatherDamageModifier)(this.state.weather, move.element);
        const fieldMod = (0, field_1.fieldDamageModifier)(this.state.field, move.element);
        let pierceMod = targetMon.primaryStatus === types_1.PrimaryStatus.PIERCED ? 1.3 : 1.0;
        // Expert Belt: 1.2x on super-effective
        let itemMod = 1.0;
        if (userMon.itemId === 'expert_belt' && typeEff > 1.0)
            itemMod = 1.2;
        if (userMon.itemId === 'life_orb')
            itemMod *= 1.3;
        // Burn halves physical ATK
        if (isPhysical && userMon.primaryStatus === types_1.PrimaryStatus.BURN && !this.hasAbility(userMon, 'guts')) {
            base = Math.floor(base * 0.5);
        }
        const modifiers = critMult * randomFactor * stab * typeEff * weatherMod * fieldMod * pierceMod * itemMod;
        return Math.max(1, Math.floor(base * modifiers));
    }
    checkHit(move, userMon, targetMon) {
        // Mold Breaker: skip defensive ability checks on target
        const hasMoldBreaker = this.hasAbility(userMon, 'mold_breaker');
        if (!hasMoldBreaker) {
            // Levitate immunity
            if (move.element === types_1.Element.EARTH && this.hasAbility(targetMon, 'levitate')) {
                console.log(`Levitate: ${targetMon.id} is immune to EARTH moves.`);
                return false;
            }
            // Flash Fire immunity
            if (move.element === types_1.Element.FIRE && this.hasAbility(targetMon, 'flash_fire')) {
                console.log(`Flash Fire: ${targetMon.id} is immune to FIRE moves.`);
                return false;
            }
            // Volt Absorb immunity + heal
            if (move.element === types_1.Element.LIGHT && this.hasAbility(targetMon, 'volt_absorb')) {
                const heal = Math.floor(targetMon.maxHP * 0.25);
                targetMon.currentHP = Math.min(targetMon.maxHP, targetMon.currentHP + heal);
                console.log(`Volt Absorb: ${targetMon.id} healed ${heal} HP.`);
                return false;
            }
        }
        else {
            console.log(`Mold Breaker: ignoring ${targetMon.id}'s defensive abilities.`);
        }
        // Air Balloon immunity (item, not ability — Mold Breaker does not ignore)
        if (move.element === types_1.Element.EARTH && targetMon.itemId === 'air_balloon') {
            targetMon.itemId = null;
            console.log(`Air Balloon: ${targetMon.id} was immune to EARTH, balloon popped.`);
            return false;
        }
        let baseAcc = move.accuracy / 100;
        const weatherAccMod = (0, weather_1.weatherAccuracyModifier)(this.state.weather, []);
        let statusAccMod = 1.0;
        if (targetMon.primaryStatus === types_1.PrimaryStatus.BLINDED)
            statusAccMod *= 0.67;
        if (targetMon.primaryStatus === types_1.PrimaryStatus.STACKED)
            statusAccMod *= 1.0 - targetMon.stackedCount * 0.05;
        // Accuracy/evasion stages
        const accMultiplier = (0, types_1.stageMultiplier)(userMon.statStages.accuracy);
        const evaMultiplier = (0, types_1.stageMultiplier)(targetMon.statStages.evasion);
        const stageMod = accMultiplier / evaMultiplier;
        const finalAcc = baseAcc * weatherAccMod * statusAccMod * stageMod;
        const hit = Math.random() <= finalAcc;
        if (!hit)
            console.log(`${move.name} missed ${targetMon.id}.`);
        return hit;
    }
    // ── Move Execution ─────────────────────────────────────────────
    executeMove(user, moveId) {
        const move = moves_1.Moves[moveId];
        if (!move)
            throw new Error(`Move ${moveId} not found`);
        const userMon = this.state[user.side].active[user.index];
        if (!userMon)
            return;
        // Flinch skip
        if (userMon.secondaryStatuses.includes(types_1.SecondaryStatus.FLINCHED)) {
            console.log(`Flinched: ${userMon.id} flinched and couldn't move!`);
            return;
        }
        // Infatuated skip
        if (userMon.secondaryStatuses.includes(types_1.SecondaryStatus.INFATUATED) && Math.random() < 0.5) {
            console.log(`Infatuated: ${userMon.id} is too lovesick to move!`);
            return;
        }
        // Charmed skip
        if (userMon.secondaryStatuses.includes(types_1.SecondaryStatus.CHARMED) && Math.random() < 0.3) {
            console.log(`Charmed: ${userMon.id} is charmed and can't act.`);
            return;
        }
        // Confusion self-hit
        if (userMon.secondaryStatuses.includes(types_1.SecondaryStatus.CONFUSED)) {
            if (Math.random() < 1 / 3) {
                const selfDmg = Math.max(1, Math.floor(((2 * userMon.level / 5 + 2) * 40 * (userMon.stats.atk / userMon.stats.def)) / 50 + 2));
                userMon.currentHP = Math.max(0, userMon.currentHP - selfDmg);
                console.log(`Confused: ${userMon.id} hit itself for ${selfDmg} damage!`);
                if (userMon.currentHP <= 0) {
                    this.faintMon(user);
                    return;
                }
                return;
            }
            console.log(`Confused: ${userMon.id} snapped out of confusion.`);
        }
        // Paralysis skip
        if (userMon.primaryStatus === types_1.PrimaryStatus.PARALYSIS && Math.random() < 0.25) {
            console.log(`Paralysis: ${userMon.id} is fully paralyzed.`);
            return;
        }
        // Skill Drained flag
        const skillDrained = userMon.secondaryStatuses.includes(types_1.SecondaryStatus.SKILL_DRAINED);
        // Choice item lock
        if (userMon.lockedMoveId && userMon.lockedMoveId !== moveId) {
            console.log(`${userMon.id} is locked into ${userMon.lockedMoveId}!`);
            return;
        }
        if (!userMon.lockedMoveId) {
            const isChoice = userMon.itemId === 'choice_band' || userMon.itemId === 'choice_specs' || userMon.itemId === 'choice_scarf';
            if (isChoice)
                userMon.lockedMoveId = moveId;
        }
        // Assault Vest blocks Status moves
        if (move.category === 'Status' && userMon.itemId === 'assault_vest') {
            console.log(`Assault Vest: ${userMon.id} cannot use Status moves.`);
            return;
        }
        // Prankster: +1 priority to Status moves
        let effectivePriority = move.priority;
        if (move.category === 'Status' && this.hasAbility(userMon, 'prankster') && !skillDrained) {
            effectivePriority += 1;
        }
        // Lagging Tail: always last
        if (userMon.itemId === 'lagging_tail')
            effectivePriority -= 1;
        // Chained blocks priority
        if (move.priority > 0 && userMon.secondaryStatuses.includes(types_1.SecondaryStatus.CHAINED)) {
            console.log(`Chained: ${userMon.id} cannot use priority moves.`);
            return;
        }
        // Life Conversion checks
        if (move.hpThreshold && (userMon.currentHP / userMon.maxHP) * 100 > move.hpThreshold) {
            console.log(`${userMon.id} HP too high for ${move.name}.`);
            return;
        }
        if (move.hpCostPercent) {
            const cost = Math.floor(userMon.maxHP * (move.hpCostPercent / 100));
            if (userMon.currentHP <= cost) {
                console.log(`Not enough HP.`);
                return;
            }
            userMon.currentHP -= cost;
        }
        if (move.healPercent) {
            userMon.currentHP = Math.min(userMon.maxHP, userMon.currentHP + Math.floor(userMon.maxHP * (move.healPercent / 100)));
        }
        // Ancient Rules item
        const key = this.slotKey(user);
        if (userMon.itemId === 'ancient_rules' && !this.state.itemConsumed[key]) {
            const reg = monsters_1.Monsters[userMon.id];
            if (reg && reg.types.includes(types_1.MonsterType.DRAGON)) {
                effectivePriority = Math.max(effectivePriority, move.priority + 1);
                this.state.itemConsumed[key] = true;
                console.log(`Ancient Rules: +1 priority.`);
            }
        }
        const candidates = this.resolveTargets(user, move.targetScope, moveId);
        if (candidates.length === 0)
            return;
        const perTarget = [];
        for (const t of candidates) {
            const tm = this.state[t.side].active[t.index];
            if (!tm)
                continue;
            const hit = this.checkHit(move, userMon, tm);
            if (!hit) {
                perTarget.push({ slot: t, hit: false, crit: false, damage: 0 });
                continue;
            }
            const isHighCrit = move.effectId === 'effect:stone_edge';
            const critChance = isHighCrit ? 0.5 : 0.0625;
            const crit = Math.random() <= critChance && tm.primaryStatus !== types_1.PrimaryStatus.BLINDED;
            const damage = move.power > 0 ? this.computeDamage(user.side, userMon, tm, move, crit, t) : 0;
            perTarget.push({ slot: t, hit: true, crit, damage });
        }
        const hitCount = perTarget.filter((p) => p.hit).length;
        // Spread tax
        if (hitCount > 1) {
            for (const p of perTarget) {
                const tgt = this.state[p.slot.side].active[p.slot.index];
                if (tgt?.primaryStatus !== types_1.PrimaryStatus.PIERCED)
                    p.damage = Math.floor(p.damage * 0.75);
            }
        }
        // Apply damage + effects
        for (const p of perTarget) {
            const tm = this.state[p.slot.side].active[p.slot.index];
            if (!tm)
                continue;
            if (!p.hit)
                continue;
            this._lastAttacker = user;
            const hasSereneGrace = this.hasAbility(userMon, 'serene_grace');
            // Multi-hit: if move is multi-hit, apply damage multiple times
            if (move.multiHit && move.power > 0) {
                const hits = move.multiHit.minHits + Math.floor(Math.random() * (move.multiHit.maxHits - move.multiHit.minHits + 1));
                for (let h = 0; h < hits; h++) {
                    const hitDmg = Math.floor(p.damage / hits);
                    tm.currentHP = Math.max(0, tm.currentHP - hitDmg);
                    console.log(`Hit ${h + 1}: ${tm.id} took ${hitDmg} damage${p.crit ? ' (CRIT)' : ''}.`);
                    if (tm.currentHP <= 0) {
                        this.faintMon(p.slot);
                        break;
                    }
                }
            }
            else {
                tm.currentHP = Math.max(0, tm.currentHP - p.damage);
                console.log(`${move.name} hit ${tm.id} for ${p.damage}${p.crit ? ' (CRIT)' : ''}.`);
            }
            // On-hit items (rocky_helmet, eject_button)
            if (tm.currentHP > 0) {
                const onHitKeys = ['item:rocky_helmet', 'item:eject_button'];
                const tKey = 'item:' + tm.itemId;
                if (onHitKeys.includes(tKey))
                    this.triggerItem(tm.itemId, p.slot);
            }
            if (tm.currentHP <= 0) {
                this.faintMon(p.slot);
                continue;
            }
            // Effect hook (double-call for Serene Grace)
            if (move.effectId && effects_1.moveEffects[move.effectId]) {
                effects_1.moveEffects[move.effectId]({ engine: this, user, moveId, targets: [p.slot] });
                if (hasSereneGrace) {
                    effects_1.moveEffects[move.effectId]({ engine: this, user, moveId, targets: [p.slot] });
                }
            }
        }
        this._lastAttacker = null;
        // User Life Orb recoil
        if (userMon.itemId === 'life_orb') {
            const recoil = Math.floor(userMon.maxHP * 0.1);
            userMon.currentHP = Math.max(0, userMon.currentHP - recoil);
            console.log(`Life Orb: ${userMon.id} lost ${recoil} HP.`);
        }
        // User faint check
        if (userMon.currentHP <= 0)
            this.faintMon(user);
    }
    // ── AI Execution ───────────────────────────────────────────────
    executeAITurn(side) {
        const slot = this.getAISlot(side);
        if (!slot)
            return;
        const moveId = (0, AI_1.getAIMove)((s) => this.state[s.side].active[s.index], (id) => monsters_1.Monsters[id], slot);
        if (moveId)
            this.executeMove(slot, moveId);
    }
    getAISlot(side) {
        for (let i = 0; i <= 2; i = (i + 1)) {
            const m = this.state[side].active[i];
            if (m && m.currentHP > 0)
                return { side, index: i };
        }
        return null;
    }
    // ── Utility ────────────────────────────────────────────────────
    getMonsterTypes(mon) {
        return monsters_1.Monsters[mon.id]?.types ?? [];
    }
    getElements(mon) {
        return monsters_1.Monsters[mon.id]?.elements ?? [];
    }
}
exports.BattleEngine = BattleEngine;
