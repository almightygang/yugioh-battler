import { MoveEffectContext, PrimaryStatus, SecondaryStatus, BattleSlot, MonsterType, MonsterSchema } from "../types";
import { Monsters } from "../registries/monsters";

// ===================== Move Effects =====================

export const moveEffects: Record<string, (ctx: MoveEffectContext) => void> = {
  'effect:set_blinding_radiance': (ctx) => {
    (ctx.engine as any).setWeather('BLINDING_RADIANCE');
  },

  'effect:sunny_day': (ctx) => {
    (ctx.engine as any).setWeather('HARSH_SUNLIGHT');
  },

  'effect:dark_burst': (ctx) => {
    for (const t of ctx.targets) (ctx.engine as any).applyPrimaryStatus(t, PrimaryStatus.CURSED, 4);
  },

  'effect:blinding_flash': (ctx) => {
    for (const t of ctx.targets) (ctx.engine as any).applyPrimaryStatus(t, PrimaryStatus.BLINDED, 3);
  },

  'effect:piercing_claw': (ctx) => {
    for (const t of ctx.targets) (ctx.engine as any).applyPrimaryStatus(t, PrimaryStatus.PIERCED, 3);
  },

  'effect:vital_light': (ctx) => {
    for (const t of ctx.targets) (ctx.engine as any).applyPrimaryStatus(t, PrimaryStatus.VITALIZED, 4);
  },

  'effect:curse_web': (ctx) => {
    for (const t of ctx.targets) (ctx.engine as any).applyPrimaryStatus(t, PrimaryStatus.STACKED, 0);
  },

  'effect:skill_crush': (ctx) => {
    for (const t of ctx.targets) (ctx.engine as any).applySecondaryStatus(t, SecondaryStatus.SKILL_DRAINED, 3, ctx.user);
  },

  'effect:charm_glow': (ctx) => {
    for (const t of ctx.targets) (ctx.engine as any).applySecondaryStatus(t, SecondaryStatus.CHARMED, 3, ctx.user);
  },

  'effect:spectral_chain': (ctx) => {
    for (const t of ctx.targets) (ctx.engine as any).applySecondaryStatus(t, SecondaryStatus.CHAINED, 3, ctx.user);
  },

  'effect:life_drain': (ctx) => {
    for (const t of ctx.targets) (ctx.engine as any).applySecondaryStatus(t, SecondaryStatus.LIFE_DRAINED, 4, ctx.user);
  },

  'effect:tether_bind': (ctx) => {
    if (ctx.targets.length >= 2) {
      (ctx.engine as any).applySecondaryStatus(ctx.targets[0], SecondaryStatus.TETHERED, 3, ctx.targets[1]);
      (ctx.engine as any).applySecondaryStatus(ctx.targets[1], SecondaryStatus.TETHERED, 3, ctx.targets[0]);
    }
  },

  'effect:revive_from_gy': (ctx) => {
    const engine = ctx.engine as any;
    const targetSlot = ctx.targets[0];
    if (!targetSlot) return;
    const gy = engine.state.graveyard[targetSlot.side];
    if (gy.length > 0) {
      const revived = gy.pop();
      if (revived) {
        revived.currentHP = Math.floor(revived.maxHP / 2);
        engine.state[targetSlot.side].active[targetSlot.index] = revived;
      }
    }
  },

  'effect:banish_strike': (ctx) => {
    for (const t of ctx.targets) (ctx.engine as any).banishMon(t);
  },

  'effect:life_conversion_sacrifice': (ctx) => {
    const engine = ctx.engine as any;
    const userMon = engine.state[ctx.user.side].active[ctx.user.index];
    if (!userMon) return;
    const cost = Math.floor(userMon.maxHP * 0.3);
    userMon.currentHP = Math.max(0, userMon.currentHP - cost);
    if (userMon.currentHP <= 0) engine.faintMon(ctx.user);
  },

  'effect:set_zombie_world': (ctx) => {
    (ctx.engine as any).setField('ZOMBIE_WORLD');
  },

  'effect:set_megalith_portal': (ctx) => {
    (ctx.engine as any).setField('MEGALITH_PORTAL');
  },

  'effect:knock_off': (ctx) => {
    const engine = ctx.engine as any;
    for (const t of ctx.targets) {
      const mon = engine.state[t.side].active[t.index];
      if (mon && mon.itemId) {
        if (mon.itemId === 'heavy_duty_boots') {
          console.log(`Knock Off failed: Heavy-Duty Boots protected ${mon.id}.`);
        } else {
          console.log(`Knock Off: removed ${mon.itemId} from ${mon.id}.`);
          mon.itemId = null;
        }
      }
    }
  },

  'effect:brave_bird': (ctx) => {
    const engine = ctx.engine as any;
    const userMon = engine.state[ctx.user.side].active[ctx.user.index];
    if (!userMon) return;
    userMon.currentHP = Math.max(0, userMon.currentHP - Math.floor(userMon.maxHP / 3));
    if (userMon.currentHP <= 0) engine.faintMon(ctx.user);
  },

  'effect:flare_blitz': (ctx) => {
    const engine = ctx.engine as any;
    const userMon = engine.state[ctx.user.side].active[ctx.user.index];
    if (!userMon) return;
    userMon.currentHP = Math.max(0, userMon.currentHP - Math.floor(userMon.maxHP / 3));
    if (userMon.currentHP <= 0) engine.faintMon(ctx.user);
  },

  'effect:will_o_wisp': (ctx) => {
    for (const t of ctx.targets) (ctx.engine as any).applyPrimaryStatus(t, PrimaryStatus.BURN, 0);
  },

  'effect:wave_crash': (ctx) => {
    const engine = ctx.engine as any;
    const userMon = engine.state[ctx.user.side].active[ctx.user.index];
    if (!userMon) return;
    userMon.currentHP = Math.max(0, userMon.currentHP - Math.floor(userMon.maxHP / 3));
    if (userMon.currentHP <= 0) engine.faintMon(ctx.user);
  },

  'effect:taunt': (ctx) => {
    for (const t of ctx.targets) (ctx.engine as any).applySecondaryStatus(t, SecondaryStatus.SKILL_DRAINED, 3, ctx.user);
  },

  'effect:play_rough': (ctx) => {
    for (const t of ctx.targets) {
      if (Math.random() < 0.1) (ctx.engine as any).modifyStatStage(t, 'atk', -1);
    }
  },

  'effect:zen_headbutt': (ctx) => {
    for (const t of ctx.targets) {
      if (Math.random() < 0.2) (ctx.engine as any).applySecondaryStatus(t, SecondaryStatus.FLINCHED, 1, ctx.user);
    }
  },

  'effect:dark_pulse': (ctx) => {
    for (const t of ctx.targets) {
      if (Math.random() < 0.2) (ctx.engine as any).applySecondaryStatus(t, SecondaryStatus.FLINCHED, 1, ctx.user);
    }
  },

  'effect:shadow_ball': (ctx) => {
    for (const t of ctx.targets) {
      if (Math.random() < 0.2) (ctx.engine as any).modifyStatStage(t, 'spDef', -1);
    }
  },

  'effect:luster_purge': (ctx) => {
    for (const t of ctx.targets) {
      if (Math.random() < 0.5) (ctx.engine as any).modifyStatStage(t, 'spDef', -1);
    }
  },

  'effect:earth_power': (ctx) => {
    for (const t of ctx.targets) {
      if (Math.random() < 0.1) (ctx.engine as any).modifyStatStage(t, 'spDef', -1);
    }
  },

  'effect:flash_cannon': (ctx) => {
    for (const t of ctx.targets) {
      if (Math.random() < 0.1) (ctx.engine as any).modifyStatStage(t, 'spDef', -1);
    }
  },

  'effect:flamethrower': (ctx) => {
    for (const t of ctx.targets) {
      if (Math.random() < 0.1) (ctx.engine as any).applyPrimaryStatus(t, PrimaryStatus.BURN, 0);
    }
  },

  'effect:fire_blast': (ctx) => {
    for (const t of ctx.targets) {
      if (Math.random() < 0.1) (ctx.engine as any).applyPrimaryStatus(t, PrimaryStatus.BURN, 0);
    }
  },

  'effect:fire_punch': (ctx) => {
    for (const t of ctx.targets) {
      if (Math.random() < 0.1) (ctx.engine as any).applyPrimaryStatus(t, PrimaryStatus.BURN, 0);
    }
  },

  'effect:hurricane': (ctx) => {
    for (const t of ctx.targets) {
      if (Math.random() < 0.3) {
        const turns = 2 + Math.floor(Math.random() * 3);
        (ctx.engine as any).applySecondaryStatus(t, SecondaryStatus.CONFUSED, turns, ctx.user);
      }
    }
  },

  'effect:air_slash': (ctx) => {
    for (const t of ctx.targets) {
      if (Math.random() < 0.3) (ctx.engine as any).applySecondaryStatus(t, SecondaryStatus.FLINCHED, 1, ctx.user);
    }
  },

  'effect:blizzard': (ctx) => {
    for (const t of ctx.targets) {
      if (Math.random() < 0.1) (ctx.engine as any).applyPrimaryStatus(t, PrimaryStatus.PARALYSIS, 0);
    }
  },

  'effect:light_screen': (ctx) => {
    const engine = ctx.engine as any;
    engine.state.buffs[ctx.user.side] = { spAtkMultiplier: 0.67, remainingTurns: 5 };
  },

  'effect:tailwind': (ctx) => {
    const engine = ctx.engine as any;
    for (let i = 0; i <= 2; i++) {
      const ally = engine.state[ctx.user.side].active[i];
      if (ally) engine.modifyStatStage({ side: ctx.user.side, index: i }, 'spe', 2);
    }
  },

  'effect:stealth_rock': (ctx) => {
    const engine = ctx.engine as any;
    const oppSide = ctx.user.side === 'ally' ? 'opp' : 'ally';
    engine.applyHazard(oppSide, 'STEALTH_ROCK');
  },

  'effect:alternative_burst': (ctx) => {},
  'effect:burst_stream_of_destruction': (ctx) => {},
  'effect:sucker_punch': (ctx) => {},
  'effect:dazzling_gleam': (ctx) => {},
  'effect:dual_wingbeat': (ctx) => {},
  'effect:earthquake': (ctx) => {},
  'effect:stone_edge': (ctx) => {},
  'effect:ice_spinner': (ctx) => {},
  'effect:hydro_pump': (ctx) => {},
};

// ===================== Ability Effects =====================

export const abilityEffects: Record<string, (ctx: { engine: any; source: BattleSlot }) => void> = {
  'ability:beacon_of_white': (ctx) => {
    ctx.engine.setWeather('BLINDING_RADIANCE');
    const mon = ctx.engine.state[ctx.source.side].active[ctx.source.index];
    if (mon) console.log(`Beacon of White: Blinding Radiance active.`);
  },

  'ability:eyes_of_blue': (ctx) => {},

  'ability:graveyard_king': (ctx) => {
    const count = ctx.engine.state.graveyard[ctx.source.side].length;
    if (count >= 2) {
      ctx.engine.modifyStatStage(ctx.source, 'atk', 2);
      console.log(`Graveyard King: +2 ATK for ${count} GY monsters.`);
    }
  },

  'ability:zombie_lord': (ctx) => {
    const mon = ctx.engine.state[ctx.source.side].active[ctx.source.index];
    if (mon && mon.primaryStatus === PrimaryStatus.NONE) {
      ctx.engine.applyPrimaryStatus(ctx.source, PrimaryStatus.VITALIZED, 0);
      console.log(`Zombie Lord: ${mon.id} Vitalized.`);
    }
  },

  'ability:intimidate': (ctx) => {
    const opp = ctx.source.side === 'ally' ? 'opp' : 'ally';
    for (let i = 0; i <= 2; i++) {
      const t = ctx.engine.state[opp].active[i];
      if (t && t.currentHP > 0) ctx.engine.modifyStatStage({ side: opp, index: i }, 'atk', -1);
    }
    console.log(`Intimidate activated.`);
  },

  'ability:regenerator': (ctx) => {
    const mon = ctx.engine.state[ctx.source.side].active[ctx.source.index];
    if (mon && mon.currentHP > 0) {
      const heal = Math.floor(mon.maxHP * 0.33);
      mon.currentHP = Math.min(mon.maxHP, mon.currentHP + heal);
      console.log(`Regenerator: ${mon.id} healed ${heal} HP.`);
    }
  },

  'ability:levitate': (ctx) => {},
  'ability:prankster': (ctx) => {},
  'ability:guts': (ctx) => {},
  'ability:sturdy': (ctx) => {},
  'ability:serene_grace': (ctx) => {},
  'ability:mold_breaker': (ctx) => {},
  'ability:flash_fire': (ctx) => {},
  'ability:volt_absorb': (ctx) => {},
  'ability:swift_swim': (ctx) => {},
  'ability:chlorophyll': (ctx) => {},
};

// ===================== Item Effects =====================

export const itemEffects: Record<string, (ctx: { engine: any; holder: BattleSlot }) => void> = {
  'item:ancient_rules': (ctx) => {},

  'item:revival_ring': (ctx) => {
    const side = ctx.holder.side;
    const gy = ctx.engine.state.graveyard[side];
    if (gy.length > 0) {
      const revived = gy.pop();
      if (revived) {
        revived.currentHP = Math.floor(revived.maxHP * 0.3);
        const slot = ctx.holder;
        ctx.engine.state[side].active[slot.index] = revived;
        console.log(`Revival Ring: ${revived.id} revived from GY with 30% HP.`);
      }
    }
  },

  'item:life_amulet': (ctx) => {
    const mon = ctx.engine.state[ctx.holder.side].active[ctx.holder.index];
    if (mon && mon.currentHP > 0) {
      const heal = Math.floor(mon.maxHP * 0.15);
      mon.currentHP = Math.min(mon.maxHP, mon.currentHP + heal);
      console.log(`Life Amulet: ${mon.id} healed ${heal} HP.`);
    }
  },

  'item:choice_band': (ctx) => {},
  'item:choice_specs': (ctx) => {},
  'item:choice_scarf': (ctx) => {},
  'item:focus_sash': (ctx) => {},
  'item:life_orb': (ctx) => {},
  'item:leftovers': (ctx) => {
    const mon = ctx.engine.state[ctx.holder.side].active[ctx.holder.index];
    if (mon && mon.currentHP > 0) {
      const heal = Math.floor(mon.maxHP / 16);
      mon.currentHP = Math.min(mon.maxHP, mon.currentHP + heal);
      console.log(`Leftovers: ${mon.id} healed ${heal} HP.`);
    }
  },

  'item:expert_belt': (ctx) => {},
  'item:assault_vest': (ctx) => {},
  'item:heavy_duty_boots': (ctx) => {},

  'item:rocky_helmet': (ctx) => {
    const engine = ctx.engine as any;
    const mon = engine.state[ctx.holder.side].active[ctx.holder.index];
    if (!mon || mon.currentHP <= 0) return;
    const attacker = engine._lastAttacker;
    if (attacker) {
      const aMon = engine.state[attacker.side].active[attacker.index];
      if (aMon && aMon.currentHP > 0) {
        const recoil = Math.floor(aMon.maxHP / 6);
        aMon.currentHP = Math.max(0, aMon.currentHP - recoil);
        console.log(`Rocky Helmet: ${aMon.id} took ${recoil} recoil damage.`);
        if (aMon.currentHP <= 0) engine.faintMon(attacker);
      }
    }
  },

  'item:eject_button': (ctx) => {
    const engine = ctx.engine as any;
    const side = ctx.holder.side;
    const bench = engine.state[side].bench;
    if (bench.length === 0) return;
    const mon = engine.state[side].active[ctx.holder.index];
    if (!mon || mon.currentHP <= 0) return;
    const replacement = bench[0];
    if (!replacement || replacement.currentHP <= 0) return;
    bench[0] = mon;
    engine.state[side].active[ctx.holder.index] = replacement;
    console.log(`Eject Button: ${mon.id} switched out, ${replacement.id} switched in.`);
    engine.processHazards(ctx.holder);
    engine.enterBattle(ctx.holder);
  },

  'item:air_balloon': (ctx) => {},

  'item:sitrus_berry': (ctx) => {
    const mon = ctx.engine.state[ctx.holder.side].active[ctx.holder.index];
    if (mon && mon.currentHP > 0 && (mon.currentHP / mon.maxHP) * 100 < 50) {
      const heal = Math.floor(mon.maxHP * 0.25);
      mon.currentHP = Math.min(mon.maxHP, mon.currentHP + heal);
      mon.itemId = null;
      console.log(`Sitrus Berry: ${mon.id} restored ${heal} HP and was consumed.`);
    }
  },

  'item:mental_herb': (ctx) => {
    const mon = ctx.engine.state[ctx.holder.side].active[ctx.holder.index];
    if (mon && mon.secondaryStatuses.length > 0) {
      mon.secondaryStatuses = [];
      mon.secondaryStatusTurns = {};
      mon.statusSource = {};
      mon.itemId = null;
      console.log(`Mental Herb: ${mon.id} cured of status and consumed.`);
    }
  },

  'item:iron_ball': (ctx) => {},

  'item:flame_orb': (ctx) => {
    const mon = ctx.engine.state[ctx.holder.side].active[ctx.holder.index];
    if (mon && mon.primaryStatus === PrimaryStatus.NONE) {
      ctx.engine.applyPrimaryStatus(ctx.holder, PrimaryStatus.BURN, 0);
      console.log(`Flame Orb: ${mon.id} was burned.`);
    }
  },

  'item:toxic_orb': (ctx) => {
    const mon = ctx.engine.state[ctx.holder.side].active[ctx.holder.index];
    if (mon && mon.primaryStatus === PrimaryStatus.NONE) {
      ctx.engine.applyPrimaryStatus(ctx.holder, PrimaryStatus.POISON, 0);
      console.log(`Toxic Orb: ${mon.id} was poisoned.`);
    }
  },

  'item:lagging_tail': (ctx) => {},

  'item:white_herb': (ctx) => {
    const mon = ctx.engine.state[ctx.holder.side].active[ctx.holder.index];
    if (mon) {
      const hasNeg = (Object.values(mon.statStages) as number[]).some((v: number) => v < 0);
      if (hasNeg) {
        mon.statStages = { atk: 0, def: 0, spAtk: 0, spDef: 0, spe: 0, accuracy: 0, evasion: 0 };
        mon.itemId = null;
        console.log(`White Herb: ${mon.id} stats reset and consumed.`);
      }
    }
  },

  'item:black_sludge': (ctx) => {
    const mon = ctx.engine.state[ctx.holder.side].active[ctx.holder.index];
    if (!mon) return;
    const reg: MonsterSchema | undefined = Monsters[mon.id];
    const isFitting = reg && reg.types.some((t: MonsterType) => t === MonsterType.ZOMBIE || t === MonsterType.FIEND);
    if (isFitting) {
      const heal = Math.floor(mon.maxHP / 16);
      mon.currentHP = Math.min(mon.maxHP, mon.currentHP + heal);
      console.log(`Black Sludge: ${mon.id} healed ${heal} HP.`);
    } else {
      const dmg = Math.floor(mon.maxHP / 16);
      mon.currentHP = Math.max(0, mon.currentHP - dmg);
      console.log(`Black Sludge: ${mon.id} took ${dmg} damage.`);
      if (mon.currentHP <= 0) ctx.engine.faintMon(ctx.holder);
    }
  },
};
