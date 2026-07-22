import { Moves } from "../registries/moves";
import { Monsters } from "../registries/monsters";
import { Items } from "../registries/items";
import {
  BattleSlot, BattleMon, MoveSchema, MonsterSchema,
  TargetScope, Element, MonsterType,
  PrimaryStatus, SecondaryStatus, TeamSide, FieldState,
  stageMultiplier, StatStages, Hazard, SlotIndex, Team,
} from "../types";
import { weatherDamageModifier, weatherAccuracyModifier, Weathers, typeEffectiveness, getWeatherTickDamage, weatherSpeedModifier } from "./weather";
import { fieldDamageModifier, getFieldElementOverride, FieldRegistry } from "./field";
import { moveEffects, abilityEffects, itemEffects } from "./effects";
import { getAIMove } from "./AI";

export interface BuffState {
  spAtkMultiplier: number;
  remainingTurns: number;
}

export class BattleEngine {
  state: {
    ally: Team; opp: Team;
    weather: { id: string; duration: number | null } | null;
    field: FieldState | null;
    graveyard: { ally: BattleMon[]; opp: BattleMon[] };
    banish: { ally: BattleMon[]; opp: BattleMon[] };
    hazards: { ally: Hazard[]; opp: Hazard[] };
    buffs: { ally: BuffState | null; opp: BuffState | null };
    itemConsumed: Record<string, boolean>;
    turnCount: number;
  };
  _lastAttacker: BattleSlot | null = null;

  private static validateTeam(team: Team, label: string) {
    if (team.active.length !== 3) throw new Error(`${label} team must have exactly 3 active slots, got ${team.active.length}`);
    if (team.bench.length > 3) throw new Error(`${label} team bench cannot exceed 3, got ${team.bench.length}`);
  }

  constructor(allyTeam: Team, oppTeam: Team) {
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
    const sides: TeamSide[] = ['ally', 'opp'];
    for (const side of sides)
      for (let i: SlotIndex = 0; i <= 2; i = (i + 1) as SlotIndex) {
        const m = this.state[side].active[i];
        if (m) this.enterBattle({ side, index: i });
      }
  }

  private slotKey(s: BattleSlot) { return `${s.side}-${s.index}`; }
  getMonInSlot(slot: BattleSlot): BattleMon | null { return this.state[slot.side].active[slot.index]; }
  getMonsterData(id: string): MonsterSchema | undefined { return Monsters[id]; }

  // ── Effects Dispatch ────────────────────────────────────────────

  triggerAbility(abilityId: string | null | undefined, slot: BattleSlot) {
    if (!abilityId) return;
    const key = 'ability:' + abilityId;
    if (abilityEffects[key]) abilityEffects[key]({ engine: this, source: slot });
  }

  triggerItem(itemId: string | null | undefined, slot: BattleSlot) {
    if (!itemId) return;
    const key = 'item:' + itemId;
    if (itemEffects[key]) itemEffects[key]({ engine: this, holder: slot });
  }

  // ── Effective Speed ────────────────────────────────────────────

  getEffectiveSpeed(mon: BattleMon): number {
    let spe = mon.stats.spe;
    spe = Math.floor(spe * stageMultiplier(mon.statStages.spe));

    // Paralysis halves speed
    if (mon.primaryStatus === PrimaryStatus.PARALYSIS) spe = Math.floor(spe * 0.5);

    // Iron Ball halves speed
    if (mon.itemId === 'iron_ball') spe = Math.floor(spe * 0.5);

    // Choice Scarf 1.5x
    if (mon.itemId === 'choice_scarf') spe = Math.floor(spe * 1.5);

    // Swift Swim 2x in Rain
    if (mon.abilityId === 'swift_swim' && this.state.weather?.id === 'RAIN') spe = Math.floor(spe * 2);

    // Chlorophyll 2x in Harsh Sunlight
    if (mon.abilityId === 'chlorophyll' && this.state.weather?.id === 'HARSH_SUNLIGHT') spe = Math.floor(spe * 2);

    return Math.max(1, spe);
  }

  // ── Stat Stage System ──────────────────────────────────────────

  modifyStatStage(slot: BattleSlot, stat: keyof StatStages, delta: number) {
    const mon = this.state[slot.side].active[slot.index];
    if (!mon) return;
    const old = mon.statStages[stat];
    mon.statStages[stat] = Math.max(-6, Math.min(6, old + delta));
    const d = mon.statStages[stat] - old;
    if (d !== 0) console.log(`${mon.id}: ${stat} ${d > 0 ? 'raised' : 'lowered'} by ${Math.abs(d)} (now ${mon.statStages[stat]}).`);
  }

  resetStatStages(slot: BattleSlot) {
    const mon = this.state[slot.side].active[slot.index];
    if (!mon) return;
    mon.statStages = { atk: 0, def: 0, spAtk: 0, spDef: 0, spe: 0, accuracy: 0, evasion: 0 };
  }

  getEffectiveStat(mon: BattleMon, stat: 'atk' | 'def' | 'spAtk' | 'spDef' | 'spe'): number {
    return Math.floor(mon.stats[stat] * stageMultiplier(mon.statStages[stat]));
  }

  // ── Weather System ─────────────────────────────────────────────

  setWeather(weatherId: string) {
    this.state.weather = { id: weatherId, duration: Weathers[weatherId]?.duration ?? null };
    console.log(`Weather changed to ${weatherId}.`);
  }

  clearWeather() { this.state.weather = null; console.log(`Weather cleared.`); }

  // ── Status System ──────────────────────────────────────────────

  applyPrimaryStatus(slot: BattleSlot, status: PrimaryStatus, turns: number) {
    const mon = this.state[slot.side].active[slot.index];
    if (!mon) return;
    if (status === PrimaryStatus.STACKED) {
      mon.stackedCount = Math.min(5, mon.stackedCount + 1);
      console.log(`STACKED increased to ${mon.stackedCount} on ${mon.id}.`);
      if (mon.stackedCount >= 5) {
        mon.primaryStatus = PrimaryStatus.STACKED;
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

  removePrimaryStatus(slot: BattleSlot) {
    const mon = this.state[slot.side].active[slot.index];
    if (!mon) return;
    const old = mon.primaryStatus;
    mon.primaryStatus = PrimaryStatus.NONE;
    mon.primaryStatusTurns = 0;
    mon.stackedCount = 0;
    if (old !== PrimaryStatus.NONE) console.log(`${mon.id} cured of ${old}.`);
  }

  applySecondaryStatus(slot: BattleSlot, status: SecondaryStatus, turns: number, source?: BattleSlot) {
    const mon = this.state[slot.side].active[slot.index];
    if (!mon) return;
    if (!mon.secondaryStatuses.includes(status)) mon.secondaryStatuses.push(status);
    mon.secondaryStatusTurns[status] = turns;
    if (source) mon.statusSource[status] = { side: source.side, index: source.index };
    console.log(`${mon.id} afflicted with ${status} for ${turns} turns.`);
  }

  removeSecondaryStatus(slot: BattleSlot, status: SecondaryStatus) {
    const mon = this.state[slot.side].active[slot.index];
    if (!mon) return;
    mon.secondaryStatuses = mon.secondaryStatuses.filter((s) => s !== status);
    delete mon.secondaryStatusTurns[status];
    delete mon.statusSource[status];
  }

  // ── GY / Banish System ─────────────────────────────────────────

  faintMon(slot: BattleSlot) {
    const mon = this.state[slot.side].active[slot.index];
    if (!mon) return;
    if (mon.currentHP <= 0) return;

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
        if (mon.itemId === 'focus_sash') mon.itemId = null;
        console.log(`${mon.id} survived with 1 HP (${mon.abilityId === 'sturdy' ? 'Sturdy' : 'Focus Sash'}).`);
        return;
      }
    }

    mon.currentHP = 0;
    this.state.graveyard[slot.side].push(mon);
    this.state[slot.side].active[slot.index] = null;
    console.log(`${mon.id} fainted and was sent to the GY.`);
  }

  banishMon(slot: BattleSlot) {
    const mon = this.state[slot.side].active[slot.index];
    if (!mon) return;
    this.state.banish[slot.side].push(mon);
    this.state[slot.side].active[slot.index] = null;
    console.log(`${mon.id} was banished.`);
  }

  reviveFromGY(side: TeamSide, gyIndex: number, targetSlot: BattleSlot): boolean {
    const gy = this.state.graveyard[side];
    if (gyIndex < 0 || gyIndex >= gy.length) return false;
    const mon = gy.splice(gyIndex, 1)[0];
    mon.currentHP = Math.floor(mon.maxHP / 2);
    this.state[side].active[targetSlot.index] = mon;
    console.log(`${mon.id} revived from GY with 50% HP.`);
    return true;
  }

  // ── Hazard System ──────────────────────────────────────────────

  applyHazard(side: TeamSide, hazard: string) {
    const h = hazard as Hazard;
    if (!this.state.hazards[side].includes(h)) {
      this.state.hazards[side].push(h);
      console.log(`Hazards set on ${side}'s field: ${hazard}.`);
    }
  }

  private processHazards(slot: BattleSlot) {
    const mon = this.state[slot.side].active[slot.index];
    if (!mon) return;
    const hazards = this.state.hazards[slot.side];
    if (hazards.includes(Hazard.STEALTH_ROCK)) {
      if (mon.itemId === 'heavy_duty_boots') {
        console.log(`Heavy-Duty Boots: ${mon.id} avoided Stealth Rock.`);
        return;
      }
      const dmg = Math.floor(mon.maxHP * 0.125);
      mon.currentHP = Math.max(0, mon.currentHP - dmg);
      console.log(`Stealth Rock: ${mon.id} took ${dmg} damage.`);
      if (mon.currentHP <= 0) this.faintMon(slot);
    }
  }

  // ── Field System ───────────────────────────────────────────────

  setField(fieldId: string) {
    const entry = FieldRegistry[fieldId];
    if (!entry) return;
    this.state.field = { id: fieldId, duration: entry.duration };
    console.log(`Field Spell activated: ${fieldId}.`);
  }

  clearField() {
    if (this.state.field) { console.log(`Field ${this.state.field.id} dissipated.`); this.state.field = null; }
  }

  // ── Switch System ──────────────────────────────────────────────

  switchMon(slot: BattleSlot, benchIndex: number): boolean {
    const bench = this.state[slot.side].bench;
    if (benchIndex < 0 || benchIndex >= bench.length) return false;
    const replacement = bench[benchIndex];
    if (!replacement || replacement.currentHP <= 0) return false;

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

  lifeConversionSacrifice(slot: BattleSlot, percent: number): boolean {
    const mon = this.state[slot.side].active[slot.index];
    if (!mon) return false;
    const cost = Math.floor(mon.maxHP * (percent / 100));
    if (mon.currentHP <= cost) return false;
    mon.currentHP -= cost;
    return true;
  }

  lifeConversionHeal(slot: BattleSlot, percent: number) {
    const mon = this.state[slot.side].active[slot.index];
    if (!mon) return;
    mon.currentHP = Math.min(mon.maxHP, mon.currentHP + Math.floor(mon.maxHP * (percent / 100)));
  }

  getHPPercent(slot: BattleSlot | BattleMon): number {
    const mon = slot instanceof Object && 'currentHP' in slot ? slot as BattleMon : this.state[(slot as BattleSlot).side].active[(slot as BattleSlot).index];
    if (!mon) return 100;
    return (mon.currentHP / mon.maxHP) * 100;
  }

  // ── Entry Triggers ─────────────────────────────────────────────

  private enterBattle(slot: BattleSlot) {
    const mon = this.state[slot.side].active[slot.index];
    if (!mon) return;
    this.triggerAbility(mon.abilityId, slot);
  }

  private findAllyWithAbility(side: TeamSide, abilityId: string, excludeIndex?: number): BattleSlot | null {
    for (let i = 0 as SlotIndex; i <= 2; i = (i + 1) as SlotIndex) {
      if (i === excludeIndex) continue;
      const m = this.state[side].active[i];
      if (m && m.abilityId === abilityId && m.currentHP > 0) return { side, index: i };
    }
    return null;
  }

  private applyEyesOfBlue(side: TeamSide, turns = 2) {
    this.state.buffs[side] = { spAtkMultiplier: 1.2, remainingTurns: turns };
    console.log(`Eyes of Blue: SpAtk x1.2 buff for ${side}.`);
  }

  // ── Turn Processing ────────────────────────────────────────────

  advanceTurn() {
    this.state.turnCount++;
    const sides: TeamSide[] = ['ally', 'opp'];

    for (const s of sides) {
      const b = this.state.buffs[s];
      if (b) { b.remainingTurns--; if (b.remainingTurns <= 0) this.state.buffs[s] = null; }
    }

    if (this.state.field) {
      this.state.field.duration--;
      if (this.state.field.duration <= 0) this.clearField();
    }

    for (const side of sides) {
      for (let i = 0 as SlotIndex; i <= 2; i = (i + 1) as SlotIndex) {
        const mon = this.state[side].active[i];
        if (!mon || mon.currentHP <= 0) continue;
        this.processStatusTick({ side, index: i });
        this.processItemTick({ side, index: i });
      }
    }
  }

  private processItemTick(slot: BattleSlot) {
    const mon = this.state[slot.side].active[slot.index];
    if (!mon) return;
    this.triggerItem(mon.itemId, slot);
  }

  private processWeatherTick(slot: BattleSlot) {
    const mon = this.state[slot.side].active[slot.index];
    if (!mon) return;
    const reg = Monsters[mon.id];
    const types = reg?.types ?? [];
    const dmg = getWeatherTickDamage(this.state.weather, mon, types);
    if (dmg > 0) {
      mon.currentHP = Math.max(0, mon.currentHP - dmg);
      console.log(`Weather: ${mon.id} took ${dmg} damage.`);
      if (mon.currentHP <= 0) this.faintMon(slot);
    }
  }

  private processStatusTick(slot: BattleSlot) {
    const mon = this.state[slot.side].active[slot.index];
    if (!mon) return;

    // Weather tick
    this.processWeatherTick(slot);
    if (mon.currentHP <= 0) return;

    // Primary status tick
    if (mon.primaryStatus !== PrimaryStatus.NONE) {
      if (mon.primaryStatus === PrimaryStatus.CURSED) {
        const dmg = Math.max(1, Math.floor(mon.maxHP / 8));
        mon.currentHP = Math.max(0, mon.currentHP - dmg);
        console.log(`Cursed: ${mon.id} lost ${dmg} HP.`);
        if (mon.currentHP <= 0) {
          const src = mon.statusSource[PrimaryStatus.CURSED];
          if (src) {
            const sm = this.state[src.side].active[src.index];
            if (sm) {
              sm.currentHP = Math.max(0, sm.currentHP - Math.floor(mon.maxHP * 0.25));
            }
          }
          this.faintMon(slot); return;
        }
      }

      if (mon.primaryStatus === PrimaryStatus.BURN) {
        const dmg = Math.max(1, Math.floor(mon.maxHP / 16));
        mon.currentHP = Math.max(0, mon.currentHP - dmg);
        console.log(`Burn: ${mon.id} lost ${dmg} HP.`);
        if (mon.currentHP <= 0) { this.faintMon(slot); return; }
      }

      if (mon.primaryStatus === PrimaryStatus.POISON) {
        const dmg = Math.max(1, Math.floor(mon.maxHP / 8));
        mon.currentHP = Math.max(0, mon.currentHP - dmg);
        console.log(`Poison: ${mon.id} lost ${dmg} HP.`);
        if (mon.currentHP <= 0) { this.faintMon(slot); return; }
      }

      if (mon.primaryStatus === PrimaryStatus.PARALYSIS) {
        const skip = Math.random() < 0.25;
        if (skip) console.log(`Paralysis: ${mon.id} is fully paralyzed!`);
      }

      if (mon.primaryStatus === PrimaryStatus.STACKED) {
        mon.stackedCount = Math.min(5, mon.stackedCount + 1);
        if (mon.stackedCount >= 5) {
          mon.stackedCount = 0;
          console.log(`STACKED detonated on ${mon.id}.`);
        }
      }

      if (mon.primaryStatus !== PrimaryStatus.STACKED && (mon.primaryStatus as PrimaryStatus) !== PrimaryStatus.NONE) {
        if (mon.primaryStatusTurns > 0) {
          mon.primaryStatusTurns--;
          if (mon.primaryStatusTurns <= 0) this.removePrimaryStatus(slot);
        }
      }
    }

    // Secondary status tick
    for (const sec of [...mon.secondaryStatuses]) {
      if (sec === SecondaryStatus.LIFE_DRAINED) {
        const dmg = Math.max(1, Math.floor(mon.maxHP / 8));
        mon.currentHP = Math.max(0, mon.currentHP - dmg);
        const src = mon.statusSource[SecondaryStatus.LIFE_DRAINED];
        if (src) {
          const sm = this.state[src.side].active[src.index];
          if (sm) sm.currentHP = Math.min(sm.maxHP, sm.currentHP + dmg);
        }
        if (mon.currentHP <= 0) { this.faintMon(slot); return; }
      }

      if (sec === SecondaryStatus.CHARMED) {
        const roll = Math.random();
        if (roll < 0.3) {
          console.log(`Charmed: ${mon.id} is charmed and can't act.`);
        } else if (roll < 0.5) {
          const opp = slot.side === 'ally' ? 'opp' : 'ally';
          for (let i = 0 as SlotIndex; i <= 2; i = (i + 1) as SlotIndex) {
            const t = this.state[opp].active[i];
            if (t) { t.currentHP = Math.min(t.maxHP, t.currentHP + Math.floor(t.maxHP / 16)); break; }
          }
        }
      }

      if (sec === SecondaryStatus.CHAINED) {
        mon.stats.spe = Math.max(1, mon.stats.spe - Math.floor(mon.stats.spe * 0.1));
      }

      if (sec === SecondaryStatus.INFATUATED) {
        if (Math.random() < 0.3) {
          const opp = slot.side === 'ally' ? 'opp' : 'ally';
          for (let i = 0 as SlotIndex; i <= 2; i = (i + 1) as SlotIndex) {
            const t = this.state[opp].active[i];
            if (t) { t.currentHP = Math.min(t.maxHP, t.currentHP + Math.floor(t.maxHP / 16)); break; }
          }
        }
      }

      const t = (mon.secondaryStatusTurns[sec] ?? 0) - 1;
      if (t <= 0) this.removeSecondaryStatus(slot, sec);
      else mon.secondaryStatusTurns[sec] = t;
    }
  }

  // ── Target Resolution ──────────────────────────────────────────

  resolveTargets(user: BattleSlot, scope: TargetScope, moveId?: string): BattleSlot[] {
    const opp = user.side === 'ally' ? 'opp' : 'ally';

    const maybeRedirect = (candidate: BattleSlot): BattleSlot => {
      const tm = this.state[candidate.side].active[candidate.index];
      if (!tm) return candidate;
      const reg = Monsters[tm.id];
      const isDragon = reg && reg.types.includes(MonsterType.DRAGON);
      if (isDragon) {
        const r = this.findAllyWithAbility(candidate.side as TeamSide, 'eyes_of_blue', candidate.index);
        if (r) { this.applyEyesOfBlue(r.side as TeamSide); return r; }
      }
      if (tm.abilityId === 'eyes_of_blue') this.applyEyesOfBlue(candidate.side as TeamSide);
      return candidate;
    };

    const alive = (side: TeamSide, idx: number): boolean => {
      const m = this.state[side].active[idx];
      return m !== null && m !== undefined && m.currentHP > 0;
    };

    switch (scope) {
      case TargetScope.SELF: return [user];
      case TargetScope.SINGLE_ADJACENT: {
        for (const idx of [user.index, user.index - 1, user.index + 1].filter((i) => i >= 0 && i <= 2) as (0 | 1 | 2)[])
          if (alive(opp, idx)) return [maybeRedirect({ side: opp as TeamSide, index: idx })];
        return [];
      }
      case TargetScope.SINGLE_ANY: {
        for (let i = 0 as SlotIndex; i <= 2; i = (i + 1) as SlotIndex)
          if (alive(opp, i)) return [maybeRedirect({ side: opp as TeamSide, index: i })];
        return [];
      }
      case TargetScope.ALL_OPPONENTS: {
        const out: BattleSlot[] = [];
        for (let i = 0 as SlotIndex; i <= 2; i = (i + 1) as SlotIndex)
          if (alive(opp, i)) out.push(maybeRedirect({ side: opp as TeamSide, index: i }));
        return out;
      }
      case TargetScope.EVERYONE_BUT_USER: {
        const slots: BattleSlot[] = [];
        for (const s of ['ally', 'opp'] as TeamSide[])
          for (let i = 0 as SlotIndex; i <= 2; i = (i + 1) as SlotIndex)
            if (!(s === user.side && i === user.index) && alive(s, i)) slots.push(maybeRedirect({ side: s, index: i }));
        return slots;
      }
      case TargetScope.ALL_ADJACENT_ALLIES: {
        const slots: BattleSlot[] = [];
        for (let i = 0 as SlotIndex; i <= 2; i = (i + 1) as SlotIndex)
          if (alive(user.side as TeamSide, i)) slots.push({ side: user.side as TeamSide, index: i });
        return slots;
      }
      default: return [];
    }
  }

  // ── Damage & Accuracy ──────────────────────────────────────────

  private hasAbility(mon: BattleMon, id: string): boolean {
    return mon.abilityId === id && !mon.secondaryStatuses.includes(SecondaryStatus.SKILL_DRAINED);
  }

  computeDamage(userSide: TeamSide, userMon: BattleMon, targetMon: BattleMon, move: MoveSchema, isCritical: boolean, targetSlot?: BattleSlot): number {
    const level = userMon.level;

    const isPhysical = move.category === 'Physical';
    let Araw = isPhysical ? userMon.stats.atk : userMon.stats.spAtk;
    const spBuff = this.state.buffs[userSide]?.spAtkMultiplier ?? 1.0;
    let A = isPhysical ? Araw : Math.floor(Araw * spBuff);

    // Guts: 1.5x ATK if statused
    if (isPhysical && this.hasAbility(userMon, 'guts') && userMon.primaryStatus !== PrimaryStatus.NONE) {
      A = Math.floor(A * 1.5);
    }

    // Choice Band/Specs
    if (isPhysical && userMon.itemId === 'choice_band') A = Math.floor(A * 1.5);
    if (!isPhysical && move.category !== 'Status' && userMon.itemId === 'choice_specs') A = Math.floor(A * 1.5);

    const Dstat = isPhysical ? targetMon.stats.def : targetMon.stats.spDef;
    let D = this.getEffectiveStat(targetMon, isPhysical ? 'def' : 'spDef');

    // Assault Vest: 1.5x SpDef
    if (!isPhysical && targetMon.itemId === 'assault_vest') D = Math.floor(D * 1.5);

    let base = Math.floor((((2 * level) / 5 + 2) * move.power * (A / D)) / 50 + 2);

    const critMult = isCritical ? 1.5 : 1.0;
    const randomFactor = 0.85 + Math.random() * 0.15;

    const ue = (Monsters as Record<string, MonsterSchema>)[userMon.id]?.elements ?? [];
    const stab = ue.includes(move.element) ? 1.5 : 1.0;

    let te = (Monsters as Record<string, MonsterSchema>)[targetMon.id]?.elements ?? [];
    if (this.state.field) {
      const o = getFieldElementOverride(this.state.field);
      if (o) te = [o];
    }
    const typeEff = typeEffectiveness(move.element, te);

    const weatherMod = weatherDamageModifier(this.state.weather, move.element);
    const fieldMod = fieldDamageModifier(this.state.field, move.element);

    let pierceMod = targetMon.primaryStatus === PrimaryStatus.PIERCED ? 1.3 : 1.0;

    // Expert Belt: 1.2x on super-effective
    let itemMod = 1.0;
    if (userMon.itemId === 'expert_belt' && typeEff > 1.0) itemMod = 1.2;
    if (userMon.itemId === 'life_orb') itemMod *= 1.3;

    // Burn halves physical ATK
    if (isPhysical && userMon.primaryStatus === PrimaryStatus.BURN && !this.hasAbility(userMon, 'guts')) {
      base = Math.floor(base * 0.5);
    }

    const modifiers = critMult * randomFactor * stab * typeEff * weatherMod * fieldMod * pierceMod * itemMod;
    return Math.max(1, Math.floor(base * modifiers));
  }

  checkHit(move: MoveSchema, userMon: BattleMon, targetMon: BattleMon): boolean {
    // Mold Breaker: skip defensive ability checks on target
    const hasMoldBreaker = this.hasAbility(userMon, 'mold_breaker');

    if (!hasMoldBreaker) {
      // Levitate immunity
      if (move.element === Element.EARTH && this.hasAbility(targetMon, 'levitate')) {
        console.log(`Levitate: ${targetMon.id} is immune to EARTH moves.`);
        return false;
      }
      // Flash Fire immunity
      if (move.element === Element.FIRE && this.hasAbility(targetMon, 'flash_fire')) {
        console.log(`Flash Fire: ${targetMon.id} is immune to FIRE moves.`);
        return false;
      }
      // Volt Absorb immunity + heal
      if (move.element === Element.LIGHT && this.hasAbility(targetMon, 'volt_absorb')) {
        const heal = Math.floor(targetMon.maxHP * 0.25);
        targetMon.currentHP = Math.min(targetMon.maxHP, targetMon.currentHP + heal);
        console.log(`Volt Absorb: ${targetMon.id} healed ${heal} HP.`);
        return false;
      }
    } else {
      console.log(`Mold Breaker: ignoring ${targetMon.id}'s defensive abilities.`);
    }

    // Air Balloon immunity (item, not ability — Mold Breaker does not ignore)
    if (move.element === Element.EARTH && targetMon.itemId === 'air_balloon') {
      targetMon.itemId = null;
      console.log(`Air Balloon: ${targetMon.id} was immune to EARTH, balloon popped.`);
      return false;
    }

    let baseAcc = move.accuracy / 100;
    const weatherAccMod = weatherAccuracyModifier(this.state.weather, []);
    let statusAccMod = 1.0;

    if (targetMon.primaryStatus === PrimaryStatus.BLINDED) statusAccMod *= 0.67;
    if (targetMon.primaryStatus === PrimaryStatus.STACKED) statusAccMod *= 1.0 - targetMon.stackedCount * 0.05;

    // Accuracy/evasion stages
    const accMultiplier = stageMultiplier(userMon.statStages.accuracy);
    const evaMultiplier = stageMultiplier(targetMon.statStages.evasion);
    const stageMod = accMultiplier / evaMultiplier;

    const finalAcc = baseAcc * weatherAccMod * statusAccMod * stageMod;
    const hit = Math.random() <= finalAcc;
    if (!hit) console.log(`${move.name} missed ${targetMon.id}.`);
    return hit;
  }

  // ── Move Execution ─────────────────────────────────────────────

  executeMove(user: BattleSlot, moveId: string): void {
    const move = Moves[moveId];
    if (!move) throw new Error(`Move ${moveId} not found`);
    const userMon = this.state[user.side].active[user.index];
    if (!userMon) return;

    // Flinch skip
    if (userMon.secondaryStatuses.includes(SecondaryStatus.FLINCHED)) {
      console.log(`Flinched: ${userMon.id} flinched and couldn't move!`);
      return;
    }

    // Infatuated skip
    if (userMon.secondaryStatuses.includes(SecondaryStatus.INFATUATED) && Math.random() < 0.5) {
      console.log(`Infatuated: ${userMon.id} is too lovesick to move!`);
      return;
    }

    // Charmed skip
    if (userMon.secondaryStatuses.includes(SecondaryStatus.CHARMED) && Math.random() < 0.3) {
      console.log(`Charmed: ${userMon.id} is charmed and can't act.`);
      return;
    }

    // Confusion self-hit
    if (userMon.secondaryStatuses.includes(SecondaryStatus.CONFUSED)) {
      if (Math.random() < 1 / 3) {
        const selfDmg = Math.max(1, Math.floor(((2 * userMon.level / 5 + 2) * 40 * (userMon.stats.atk / userMon.stats.def)) / 50 + 2));
        userMon.currentHP = Math.max(0, userMon.currentHP - selfDmg);
        console.log(`Confused: ${userMon.id} hit itself for ${selfDmg} damage!`);
        if (userMon.currentHP <= 0) { this.faintMon(user); return; }
        return;
      }
      console.log(`Confused: ${userMon.id} snapped out of confusion.`);
    }

    // Paralysis skip
    if (userMon.primaryStatus === PrimaryStatus.PARALYSIS && Math.random() < 0.25) {
      console.log(`Paralysis: ${userMon.id} is fully paralyzed.`);
      return;
    }

    // Skill Drained flag
    const skillDrained = userMon.secondaryStatuses.includes(SecondaryStatus.SKILL_DRAINED);

    // Choice item lock
    if (userMon.lockedMoveId && userMon.lockedMoveId !== moveId) {
      console.log(`${userMon.id} is locked into ${userMon.lockedMoveId}!`);
      return;
    }
    if (!userMon.lockedMoveId) {
      const isChoice = userMon.itemId === 'choice_band' || userMon.itemId === 'choice_specs' || userMon.itemId === 'choice_scarf';
      if (isChoice) userMon.lockedMoveId = moveId;
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
    if (userMon.itemId === 'lagging_tail') effectivePriority -= 1;

    // Chained blocks priority
    if (move.priority > 0 && userMon.secondaryStatuses.includes(SecondaryStatus.CHAINED)) {
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
      if (userMon.currentHP <= cost) { console.log(`Not enough HP.`); return; }
      userMon.currentHP -= cost;
    }
    if (move.healPercent) {
      userMon.currentHP = Math.min(userMon.maxHP, userMon.currentHP + Math.floor(userMon.maxHP * (move.healPercent / 100)));
    }

    // Ancient Rules item
    const key = this.slotKey(user);
    if (userMon.itemId === 'ancient_rules' && !this.state.itemConsumed[key]) {
      const reg = Monsters[userMon.id];
      if (reg && reg.types.includes(MonsterType.DRAGON)) {
        effectivePriority = Math.max(effectivePriority, move.priority + 1);
        this.state.itemConsumed[key] = true;
        console.log(`Ancient Rules: +1 priority.`);
      }
    }

    const candidates = this.resolveTargets(user, move.targetScope, moveId);
    if (candidates.length === 0) return;

    type PerTarget = { slot: BattleSlot; hit: boolean; crit: boolean; damage: number };
    const perTarget: PerTarget[] = [];

    for (const t of candidates) {
      const tm = this.state[t.side].active[t.index];
      if (!tm) continue;

      const hit = this.checkHit(move, userMon, tm);
      if (!hit) { perTarget.push({ slot: t, hit: false, crit: false, damage: 0 }); continue; }

      const isHighCrit = move.effectId === 'effect:stone_edge';
      const critChance = isHighCrit ? 0.5 : 0.0625;
      const crit = Math.random() <= critChance && tm.primaryStatus !== PrimaryStatus.BLINDED;
      const damage = move.power > 0 ? this.computeDamage(user.side as TeamSide, userMon, tm, move, crit, t) : 0;
      perTarget.push({ slot: t, hit: true, crit, damage });
    }

    const hitCount = perTarget.filter((p) => p.hit).length;

    // Spread tax
    if (hitCount > 1) {
      for (const p of perTarget) {
        const tgt = this.state[p.slot.side].active[p.slot.index];
        if (tgt?.primaryStatus !== PrimaryStatus.PIERCED) p.damage = Math.floor(p.damage * 0.75);
      }
    }

    // Apply damage + effects
    for (const p of perTarget) {
      const tm = this.state[p.slot.side].active[p.slot.index];
      if (!tm) continue;
      if (!p.hit) continue;

      this._lastAttacker = user;

      const hasSereneGrace = this.hasAbility(userMon, 'serene_grace');

      // Multi-hit: if move is multi-hit, apply damage multiple times
      if (move.multiHit && move.power > 0) {
        const hits = move.multiHit.minHits + Math.floor(Math.random() * (move.multiHit.maxHits - move.multiHit.minHits + 1));
        for (let h = 0; h < hits; h++) {
          const hitDmg = Math.floor(p.damage / hits);
          tm.currentHP = Math.max(0, tm.currentHP - hitDmg);
          console.log(`Hit ${h + 1}: ${tm.id} took ${hitDmg} damage${p.crit ? ' (CRIT)' : ''}.`);
          if (tm.currentHP <= 0) { this.faintMon(p.slot); break; }
        }
      } else {
        tm.currentHP = Math.max(0, tm.currentHP - p.damage);
        console.log(`${move.name} hit ${tm.id} for ${p.damage}${p.crit ? ' (CRIT)' : ''}.`);
      }

      // On-hit items (rocky_helmet, eject_button)
      if (tm.currentHP > 0) {
        const onHitKeys = ['item:rocky_helmet', 'item:eject_button'];
        const tKey = 'item:' + tm.itemId;
        if (onHitKeys.includes(tKey)) this.triggerItem(tm.itemId, p.slot);
      }

      if (tm.currentHP <= 0) { this.faintMon(p.slot); continue; }

      // Effect hook (double-call for Serene Grace)
      if (move.effectId && moveEffects[move.effectId]) {
        moveEffects[move.effectId]({ engine: this, user, moveId, targets: [p.slot] });
        if (hasSereneGrace) {
          moveEffects[move.effectId]({ engine: this, user, moveId, targets: [p.slot] });
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
    if (userMon.currentHP <= 0) this.faintMon(user);
  }

  // ── AI Execution ───────────────────────────────────────────────

  executeAITurn(side: TeamSide): void {
    const slot = this.getAISlot(side);
    if (!slot) return;
    const moveId = getAIMove(
      (s) => this.state[s.side].active[s.index],
      (id) => Monsters[id],
      slot,
    );
    if (moveId) this.executeMove(slot, moveId);
  }

  getAISlot(side: TeamSide): BattleSlot | null {
    for (let i = 0 as SlotIndex; i <= 2; i = (i + 1) as SlotIndex) {
      const m = this.state[side].active[i];
      if (m && m.currentHP > 0) return { side, index: i };
    }
    return null;
  }

  // ── Utility ────────────────────────────────────────────────────

  getMonsterTypes(mon: BattleMon): MonsterType[] {
    return (Monsters as Record<string, MonsterSchema>)[mon.id]?.types ?? [];
  }

  getElements(mon: BattleMon): Element[] {
    return (Monsters as Record<string, MonsterSchema>)[mon.id]?.elements ?? [];
  }
}
