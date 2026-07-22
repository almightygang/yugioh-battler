# Yu-Gi-Oh! Battler — Codebase Documentation

> **Version:** 0.0.4  
> **Language:** TypeScript (ES2020, CommonJS)  
> **Runtime:** Node.js 26.x  
> **Architecture:** Turn-based 3v3 monster battle simulator with Pokémon-style mechanics, Yu-Gi-Oh! theming.

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Type System](#2-type-system)
3. [Database Layer](#3-database-layer)
4. [Battle Engine](#4-battle-engine)
5. [Weather System](#5-weather-system)
6. [Field System](#6-field-system)
7. [Effects System](#7-effects-system)
8. [Status Effects](#8-status-effects)
9. [Life Conversion](#9-life-conversion)
10. [Graveyard & Banish Zone](#10-graveyard--banish-zone)
11. [Damage Formula](#11-damage-formula)
12. [Target Resolution](#12-target-resolution)
13. [Demonstration & Tests](#13-demonstration--tests)
14. [Build & Run Commands](#14-build--run-commands)
15. [Database Editor Tools](#15-database-editor-tools)
16. [Game Systems](#16-game-systems)
17. [Known Limitations](#17-known-limitations-v004)

---

## 1. Project Structure

```
yugioh-battler/
├── docs/                      # Documentation files
├── changelogs/                # Version changelogs
├── examples/
│   ├── demo.ts                # Full system demo (runnable)
│   └── test_type_chart.ts     # Type effectiveness chart test
├── public/
│   └── images/
│       └── monsters/          # Monster sprite PNGs (user-provided)
├── src/
│   ├── database/              # JSON data files (editable data layer)
│   │   ├── abilities.json     # 16 abilities
│   │   ├── effects.json       # 88 effect metadata entries
│   │   ├── items.json         # 23 items
│   │   ├── moves.json         # 49 moves
│   │   └── monsters.json      # 8 monsters
│   ├── engine/                # Core game logic
│   │   ├── AI.ts              # Simple AI opponent move selection
│   │   ├── BattleEngine.ts    # Central battle engine (~820 lines)
│   │   ├── effects.ts         # Move/Ability/Item effect hooks
│   │   ├── field.ts           # Field spell system
│   │   ├── SaveManager.ts     # Battle state serialization
│   │   └── weather.ts         # Weather system + type chart
│   ├── game/                  # Game loop & progression
│   │   ├── types.ts           # Game-specific data types
│   │   ├── player.ts          # Player profile, inventory, team CRUD
│   │   ├── shop.ts            # Pack definitions, gacha pulls
│   │   ├── arena.ts           # Battle stages, NPC gen, rewards
│   │   ├── hub.html           # SPA frontend (hub, collection, teambuilder, shop, arena)
│   │   └── save.json          # Persistent player state (auto-created)
│   ├── registries/            # Thin loaders from JSON → typed objects
│   │   ├── abilities.ts
│   │   ├── items.ts
│   │   ├── monsters.ts
│   │   └── moves.ts
│   ├── tools/                 # Developer tooling
│   │   ├── db-editor.ts       # Interactive CLI database editor
│   │   ├── db-server.ts       # HTTP API server + auto-schema generator
│   │   └── db-gui.html        # Single-page web GUI frontend
│   └── types.ts               # All enums, interfaces, and factory functions
├── tsconfig.json
└── package.json
```

---

## 2. Type System

All canonical types are defined in `src/types.ts`.

### 2.1 Element (7 attributes)

```typescript
enum Element { LIGHT, DARK, FIRE, WATER, EARTH, WIND, NORMAL }
```

- **Purpose:** Determines type matchup effectiveness via the type chart.
- **Mapping:** Maps to Yu-Gi-Oh! Attributes. Moves with sub-types like Fairy, Psychic, Ghost map to the nearest Element (Fairy→LIGHT, Ghost→DARK, etc.).

### 2.2 Category (3 move categories)

```typescript
enum Category { Physical, Special, Status }
```

- Physical: uses ATK stat, targets DEF stat.
- Special: uses SPATK stat, targets SPDEF stat.
- Status: deals no damage (power = 0).

### 2.3 TargetScope (6 targeting patterns)

```typescript
enum TargetScope {
  SINGLE_ADJACENT,   // Nearest adjacent opponent
  SINGLE_ANY,        // Any single opponent
  ALL_OPPONENTS,     // All enemy slots
  ALL_ADJACENT_ALLIES, // All allied slots
  EVERYONE_BUT_USER, // All slots except the user
  SELF               // The user only
}
```

### 2.4 MonsterType (9 species types)

```typescript
enum MonsterType { DRAGON, WARRIOR, SPELLCASTER, SUPPORT, ZOMBIE, FIEND, FAIRY, MACHINE, ROCK }
```

- Monster Types act as **search terms and condition filters** for Moves, Abilities, and Items (e.g., "If active monster is Dragon-type…").
- They do **not** affect damage multipliers directly.

### 2.5 PrimaryStatus (9 non-volatile conditions)

```typescript
enum PrimaryStatus { NONE, STACKED, PIERCED, CURSED, BLINDED, VITALIZED, BURN, POISON, PARALYSIS }
```

- Only **one** primary status can affect a monster at a time.
- Applying a new primary status replaces the old one.

### 2.6 SecondaryStatus (5 volatile conditions)

```typescript
enum SecondaryStatus { SKILL_DRAINED, CHARMED, CHAINED, LIFE_DRAINED, TETHERED }
```

- Can **stack** with primary statuses and other secondary statuses.
- Clears when the monster switches out.

### 2.7 Core Interfaces

| Interface | Fields | Description |
|-----------|--------|-------------|
| `MonsterSchema` | id, name, archetype, isLegendary, baseStats, elements[], types[], abilityId, learnset[] | Static database definition of a monster species |
| `MoveSchema` | id, name, element, category, power, accuracy, priority, maxPP, targetScope, effectId, hpCostPercent, healPercent, hpThreshold | Static definition of a move |
| `AbilitySchema` | id, name, description, effectId | Static definition of an ability |
| `ItemSchema` | id, name, description, effectId | Static definition of an item |
| `StatStages` | atk, def, spAtk, spDef, spe (each -6..+6) | Stat stage modifiers tracked per monster |
| `Hazard` | STEALTH_ROCK | Entry hazard types |
| `MultiHitConfig` | minHits, maxHits | Multi-hit move configuration |
| `BattleMon` | id, nickname, level, currentHP, maxHP, stats, abilityId, itemId, statStages, lockedMoveId, primaryStatus, primaryStatusTurns, stackedCount, secondaryStatuses[], secondaryStatusTurns, statusSource | Runtime instance of a monster in battle |
| `BattleSlot` | side ('ally'\|'opp'), index (0\|1\|2) | A position on the field |
| `SlotIndex` | 0 \| 1 \| 2 | Type alias for the 3 active slot positions |
| `Team` | active[3], bench[] | Team with 3 active slots and up to 3 bench slots (6 total) |
| `BattleState` | ally, opp, weather, field, graveyard, banish, hazards, turnCount | Full runtime battle state |
| `MoveEffectContext` | engine, user, moveId, targets[] | Context passed to effect hooks |

### 2.8 Factory Function

```typescript
function createBattleMon(id, level, stats, abilityId?, itemId?, nickname?): BattleMon
```

Initializes a `BattleMon` with HP = stats.hp * 10 and default zero-status values.

---

## 3. Database Layer

All game data is stored as **JSON files** in `src/database/`. The registry files in `src/registries/` load these JSON files at runtime, parse string values into the correct TypeScript enums, and export typed `Record<string, Schema>` objects.

### 3.1 Abilities (`src/database/abilities.json`)

**16 abilities total:**

| ID | Name | Effect Summary |
|----|------|---------------|
| `beacon_of_white` | Beacon of White | Summons Blinding Radiance weather on entry |
| `eyes_of_blue` | Eyes of Blue | Redirects Dragon-targeting attacks + SpAtk buff |
| `graveyard_king` | Graveyard King | +30% ATK when 2+ GY monsters |
| `zombie_lord` | Zombie Lord | Auto-Vitalized on entry |
| `intimidate` | Intimidate | Lowers adjacent opponents' ATK on entry |
| `regenerator` | Regenerator | Heal 33% max HP when switching out |
| `levitate` | Levitate | Immunity to EARTH-type attacks |
| `prankster` | Prankster | +1 priority on Status moves |
| `guts` | Guts | 1.5x ATK when statused; ignores Burn penalty |
| `sturdy` | Sturdy | Survive 1-hit KO from full HP at 1 HP |
| `serene_grace` | Serene Grace | Doubles secondary effect chances |
| `mold_breaker` | Mold Breaker | Ignores defensive abilities |
| `flash_fire` | Flash Fire | FIRE immunity + damage boost |
| `volt_absorb` | Volt Absorb | LIGHT immunity + heal on hit |
| `swift_swim` | Swift Swim | Double SPE when weather active |
| `chlorophyll` | Chlorophyll | Double SPE in harsh sunlight |

### 3.2 Items (`src/database/items.json`)

**23 items total** — mapped from Yu-Gi-Oh! cards to Pokémon equivalents:

| ID | Yu-Gi-Oh! Origin | Pokémon Equivalent | Effect |
|----|-------------------|-------------------|--------|
| `ancient_rules` | Ancient Rules | (custom) | +1 priority for Dragon moves (once) |
| `revival_ring` | (custom) | (custom) | Auto-revive from GY at 30% HP |
| `life_amulet` | (custom) | (custom) | Regen 15% max HP per turn |
| `choice_band` | Pot of Greed | Choice Band | 1.5x ATK, locked to first move |
| `choice_specs` | Graceful Charity | Choice Specs | 1.5x SPATK, locked to first move |
| `choice_scarf` | Upstart Goblin | Choice Scarf | 1.5x SPE, locked to first move |
| `focus_sash` | Swords of Revealing Light | Focus Sash | Survive OHKO from full HP |
| `life_orb` | Supply Squad | Life Orb | 1.3x damage, 10% HP recoil |
| `leftovers` | Dian Keto the Cure Master | Leftovers | 1/16 max HP regen per turn |
| `expert_belt` | Mage Power | Expert Belt | 1.2x super-effective damage |
| `assault_vest` | Solemn Judgment | Assault Vest | 1.5x SPDEF, no Status moves |
| `heavy_duty_boots` | Mystical Space Typhoon | Heavy-Duty Boots | Hazard immunity on switch |
| `rocky_helmet` | Mirror Force | Rocky Helmet | 1/6 max HP recoil on contact |
| `eject_button` | Heavy Storm | Eject Button | Switch out when hit |
| `air_balloon` | Waboku | Air Balloon | EARTH immunity (breaks on hit) |
| `sitrus_berry` | Monster Reborn | Sitrus Berry | 25% HP heal at <50% HP |
| `mental_herb` | Dark Bribe | Mental Herb | Cure infatuation/taunt/bind |
| `iron_ball` | Book of Moon | Iron Ball | Half SPE, grounds airborne |
| `flame_orb` | Foolish Burial | Flame Orb | Self-burn at end of turn |
| `toxic_orb` | Card Destruction | Toxic Orb | Self-badly poison at end of turn |
| `lagging_tail` | Imperial Order | Lagging Tail | Always moves last in priority |
| `white_herb` | Limiter Removal | White Herb | Reset stats once |
| `black_sludge` | United We Stand | Black Sludge | Heal ZOMBIE/FIEND, hurt others |

### 3.3 Moves (`src/database/moves.json`)

**49 moves total** organized by element theme:

**DARK (8 moves):** alternative_burst, dark_burst, curse_web, skill_crush, spectral_chain, life_drain, knock_off, sucker_punch, dark_pulse, shadow_ball, taunt, banish_strike, revive_from_gy, life_conversion_sacrifice

**LIGHT (9 moves):** burst_stream_of_destruction, set_blinding_radiance, blinding_flash, vital_light, charm_glow, play_rough, zen_headbutt, dazzling_gleam, luster_purge, light_screen, life_conversion_heal

**WIND (7 moves):** tether_bind, brave_bird, dual_wingbeat, hurricane, air_slash, tailwind, ice_spinner, blizzard

**EARTH (7 moves):** piercing_claw, megalith_portal_activate, earthquake, stone_edge, earth_power, flash_cannon, stealth_rock

**FIRE (6 moves):** flare_blitz, fire_punch, flamethrower, fire_blast, will_o_wisp, sunny_day

**WATER (3 moves):** wave_crash, hydro_pump

**Field (2 moves):** zombie_world_activate, megalith_portal_activate

Each move has:
- `element`, `category`, `power`, `accuracy`, `priority`, `maxPP`, `targetScope`
- Optional: `effectId` (link to effects hook), `hpCostPercent`, `healPercent`, `hpThreshold` (Life Conversion), `multiHit` (MultiHitConfig)

### 3.4 Monsters (`src/database/monsters.json`)

**8 monsters** across 5 archetypes:

| ID | Name | Archetype | Types | Elements | Role |
|----|------|-----------|-------|----------|------|
| `blue_eyes_white_dragon` | Blue-Eyes White Dragon | Blue-Eyes | DRAGON | LIGHT | Legendary attacker |
| `the_striker` | Blue-Eyes Alternative White Dragon | Blue-Eyes | DRAGON | LIGHT | Physical attacker |
| `the_support` | Maiden with Eyes of Blue | Blue-Eyes | SUPPORT | LIGHT | Redirect support |
| `the_setter` | The White Stone of Ancients | Blue-Eyes | SUPPORT | LIGHT | Weather setter |
| `dark_magician` | Dark Magician | Dark Magician | SPELLCASTER | DARK | Legendary spellcaster |
| `zombie_world_ruler` | Zombie World Ruler | Zombie | ZOMBIE | DARK/EARTH | Field control |
| `graveyard_king` | Graveyard King | Zombie | ZOMBIE | DARK | Legendary GY abuser |
| `megalith_sentry` | Megalith Sentry | Megalith | ROCK | EARTH | Defensive wall |

---

## 4. Battle Engine

**File:** `src/engine/BattleEngine.ts` (~820 lines)

The `BattleEngine` class is the central runtime. It manages all battle state and exposes methods for combat flow.

### 4.1 State Shape

```typescript
state = {
  ally: Team,           // { active: [BattleMon|null]³, bench: BattleMon[] (max 3) }
  opp: Team,
  weather: Weather | null,
  field: FieldState | null,
  graveyard: { ally: BattleMon[], opp: BattleMon[] },
  banish: { ally: BattleMon[], opp: BattleMon[] },
  hazards: { ally: Hazard[], opp: Hazard[] },
  buffs: { ally: BuffState | null, opp: BuffState | null },
  itemConsumed: Record<string, boolean>,
  turnCount: number,
}
```

### 4.2 Lifecycle

1. **Constructor** — Accepts two `Team` objects. Initializes state arrays for GY, Banish, buffs, hazards. Calls `enterBattle()` for each active monster, triggering on-entry abilities.
2. **`executeMove(user, moveId)`** — Main combat flow:
   - Look up move from registry
   - Check Charmed (30% skip chance)
   - Check Skill Drained (ability suppression flag)
   - Check Life Conversion thresholds/costs/heals
   - Process held items (Ancient Rules priority boost)
   - Resolve targets via `resolveTargets()`
   - Per-target: accuracy check → crit roll → damage calc → apply damage → effect hooks
   - Multi-hit loop for moves with MultiHitConfig (Dual Wingbeat)
   - Apply spread tax (0.75x) if hitting multiple targets
   - Check faint conditions (Sturdy, Focus Sash, etc.)
3. **`advanceTurn()`** — End-of-turn processing:
   - Decrement buff durations
   - Decrement field duration, clear if expired
   - Process status ticks (Burn, Poison, Cursed, Life Drained) for all active monsters
   - Process held item tick effects (Leftovers, Black Sludge, Life Amulet, Sitrus Berry, Flame Orb, Toxic Orb)

### 4.3 Key Methods

| Method | Description |
|--------|-------------|
| `applyPrimaryStatus(slot, status, turns)` | Set primary status; STACKED increments counter, detonates at 5 |
| `removePrimaryStatus(slot)` | Clear primary status to NONE |
| `applySecondaryStatus(slot, status, turns, source?)` | Add secondary status with optional source tracking |
| `removeSecondaryStatus(slot, status)` | Remove specific secondary status |
| `faintMon(slot)` | Set HP=0, push to GY, set slot to null |
| `banishMon(slot)` | Push to banish zone, set slot to null |
| `reviveFromGY(side, gyIndex, targetSlot)` | Splice monster from GY to active slot at 50% HP |
| `switchMon(slot, benchIndex)` | Switch active with bench monster; triggers entry hazards |
| `modifyStatStage(slot, stat, delta)` | Modify a stat stage (clamped -6/+6) |
| `getEffectiveStat(mon, stat)` | Get stage-modified stat value |
| `setWeather(weatherId)` | Set weather (overrides existing) |
| `clearWeather()` | Clear active weather |
| `setField(fieldId)` | Set field from FieldRegistry (overrides existing) |
| `clearField()` | Clear active field |
| `applyHazard(side, hazard)` | Add entry hazard to a side |
| `clearHazards(side)` | Remove all hazards from a side |
| `executeAITurn(side)` | AI picks and executes a random legal move |
| `lifeConversionSacrifice(slot, percent)` | Deduct % of max HP, returns false if insufficient |
| `lifeConversionHeal(slot, percent)` | Restore % of max HP |
| `getHPPercent(slot)` | Get current HP percentage |
| `resolveTargets(user, scope, moveId?)` | Resolve target slots with Eyes of Blue redirection |
| `computeDamage(userSide, userMon, targetMon, move, isCritical)` | Full damage formula (uses effective stats) |
| `checkHit(move, userMon, targetMon)` | Accuracy check with weather/status modifiers |

### 4.4 Redirection (Eyes of Blue)

In `resolveTargets()`, if a Dragon-type monster is targeted and an ally has the `eyes_of_blue` ability, the attack is redirected to the ability holder and a 1.2x SpAtk buff is applied to that side for 2 turns.

---

## 5. Weather System

**File:** `src/engine/weather.ts`

### 5.1 Weather Types (5 total)

| ID | Effect | Duration |
|----|--------|----------|
| `BLINDING_RADIANCE` | LIGHT moves 1.5x; non-LIGHT monsters accuracy 0.9 | Infinite (until replaced) |
| `HARSH_SUNLIGHT` | FIRE moves 1.5x; WATER moves 0.5x | Infinite (until replaced) |
| `RAIN` | WATER moves 1.5x; FIRE moves 0.5x | Infinite (until replaced) |
| `SANDSTORM` | Non-ROCK monsters take 1/16 max HP/turn | Infinite (until replaced) |
| `HAIL` | Non-ICE monsters take 1/16 max HP/turn; Blizzard always hits | Infinite (until replaced) |

### 5.2 Speed Bonuses

| Ability | Condition |
|---------|-----------|
| Swift Swim | 2x SPE in Rain |
| Chlorophyll | 2x SPE in Harsh Sunlight |

### 5.3 Functions

```typescript
function weatherDamageModifier(weather, moveElement): number         // Element-specific damage boosts/penalties
function weatherAccuracyModifier(weather, targetMonsterTypes): number // Accuracy modifiers per weather
function weatherTickDamage(weather, mon, monsterTypes): number         // Sandstorm/Hail chip damage
function getWeatherSpeedBonus(weather, abilityId): number             // Swift Swim / Chlorophyll
```

---

## 6. Field System

**File:** `src/engine/field.ts`

### 6.1 Field Types

| ID | Effect | Duration |
|----|--------|----------|
| `ZOMBIE_WORLD` | All monsters are treated as DARK element | 5 turns |
| `MEGALITH_PORTAL` | EARTH moves deal 1.3x damage | 5 turns |

### 6.2 Properties

- Fields last **5 turns** by default.
- Fields can only be **overridden by other fields** (not weather).
- Field effects parallel weather but are separate systems.

### 6.3 Functions

```typescript
function getFieldElementOverride(field): Element | null      // ZOMBIE_WORLD → DARK
function fieldDamageModifier(field, moveElement): number      // MEGALITH_PORTAL → 1.3x EARTH
function fieldDefenseModifier(field, targetPrimaryStatus): number
```

### 6.4 Interaction with Combat

In `computeDamage()`, if a field is active:
- Target elements are checked for overrides (e.g., ZOMBIE_WORLD forces all targets to DARK).
- `fieldDamageModifier` applies alongside weather modifiers.

---

## 7. Effects System

**File:** `src/engine/effects.ts` (~700 lines)

Effects are event-driven hooks called during move execution, ability triggers, and item activations. The engine checks `move.effectId` and calls the corresponding hook if it exists.

### 7.1 Move Effects (30+ total)

**Status application moves:** dark_burst (CURSED), blinding_flash (BLINDED all opponents), piercing_claw (PIERCED), vital_light (VITALIZED self), curse_web (STACKED all opponents), skill_crush (SKILL_DRAINED), charm_glow (CHARMED), spectral_chain (CHAINED), life_drain (LIFE_DRAINED 4 turns), tether_bind (tethered 3 turns), will_o_wisp (BURN)

**Recoil moves:** brave_bird, flare_blitz, wave_crash (33% max HP recoil), life_conversion_sacrifice (30% max HP recoil)

**Field/weather:** set_blinding_radiance, set_zombie_world, set_megalith_portal, sunny_day (HARSH_SUNLIGHT)

**Utility:** revive_from_gy (revive last fainted ally 50% HP), banish_strike (exile target), knock_off (remove item; respects Heavy-Duty Boots immunity), stealth_rock (set hazard on opponent side), sucker_punch (priority if target attacking — framework), light_screen (SpDef buff — framework)

**Stat-stage moves:** All remaining moves apply stat stage drops (ATK/DEF/SPATK/SPDEF/SPE -1) on hit.

### 7.2 Ability Effects (16 total — all implemented)

| Effect ID | Trigger | Behavior |
|-----------|---------|----------|
| `ability:beacon_of_white` | On entry | Sets Blinding Radiance weather |
| `ability:eyes_of_blue` | On target | Redirects Dragon-targeting moves + SpAtk buff |
| `ability:graveyard_king` | On entry | +30% ATK if 2+ GY monsters |
| `ability:zombie_lord` | On entry | Apply VITALIZED to self |
| `ability:intimidate` | On entry | Lower adjacent opponents' ATK by 1 stage |
| `ability:regenerator` | On switch-out | Heal 33% max HP |
| `ability:levitate` | On damage calc | EARTH immunity |
| `ability:flash_fire` | On damage calc | FIRE immunity + FIRE damage boost |
| `ability:volt_absorb` | On damage calc | LIGHT immunity + heal 25% max HP |
| `ability:prankster` | On move priority | +1 priority for Status moves |
| `ability:guts` | On damage calc | 1.5x ATK when statused; ignores Burn ATK reduction |
| `ability:sturdy` | On damage calc | Survive OHKO from full HP at 1 HP |
| `ability:swift_swim` | On speed calc | 2x SPE in Rain |
| `ability:chlorophyll` | On speed calc | 2x SPE in Harsh Sunlight |
| `ability:serene_grace` | On secondary effect | Doubles secondary effect rates (framework) |
| `ability:mold_breaker` | On ability check | Ignores defensive abilities (framework) |

### 7.3 Item Effects (22 total — all implemented)

| Effect ID | Trigger | Behavior |
|-----------|---------|----------|
| `item:ancient_rules` | On move priority | +1 priority for Dragon-targeting moves (once) |
| `item:revival_ring` | On faint | Revive from GY at 30% HP (once) |
| `item:life_amulet` | End of turn | Heal 15% max HP |
| `item:choice_band` | On damage calc | 1.5x ATK; locks to first used move |
| `item:choice_specs` | On damage calc | 1.5x SPATK; locks to first used move |
| `item:choice_scarf` | On speed calc | 1.5x SPE; locks to first used move |
| `item:focus_sash` | On damage calc | Survive OHKO from full HP at 1 HP (once) |
| `item:life_orb` | On damage calc | 1.3x damage; 10% max HP recoil |
| `item:leftovers` | End of turn | Heal 1/16 max HP |
| `item:expert_belt` | On damage calc | 1.2x super-effective damage |
| `item:assault_vest` | On damage calc | 1.5x SPDEF; cannot select Status moves |
| `item:heavy_duty_boots` | On entry | Hazard immunity (framework) |
| `item:rocky_helmet` | On contact | 1/6 max HP recoil to attacker (framework) |
| `item:eject_button` | On hit | Switch out when hit (framework) |
| `item:air_balloon` | On damage calc | EARTH immunity (breaks on hit — framework) |
| `item:sitrus_berry` | End of turn | Heal 25% max HP when <50% HP (once) |
| `item:mental_herb` | On status | Cure infatuation/taunt/etc. (framework) |
| `item:iron_ball` | On speed calc | Half SPE; grounds airborne (framework) |
| `item:flame_orb` | End of turn | Self-burn at end of turn (once) |
| `item:toxic_orb` | End of turn | Self-toxic at end of turn (once) |
| `item:lagging_tail` | On speed calc | Always moves last (framework) |
| `item:white_herb` | On entry | Reset stat stages once (framework) |
| `item:black_sludge` | End of turn | Heal 1/16 HP for ZOMBIE/FIEND; deal 1/16 HP to others |

---

## 8. Status Effects

### 8.1 Primary Statuses (mutually exclusive)

| Status | Application | Duration | Tick Effect | Expiry |
|--------|------------|----------|-------------|--------|
| **STACKED** | Increment counter (max 5) | Variable | At 5 stacks: detonates into Paralysis+Confusion; otherwise +1 stack/turn | Clears on detonation or removal |
| **PIERCED** | Applied by moves | 3 turns | Defensive stats ignored; spread tax bypassed | After duration expires |
| **CURSED** | Applied by moves | 4 turns | 1/8 max HP damage/turn; if faints, attacker takes 25% max HP recoil | After duration expires |
| **BLINDED** | Applied by moves | 3 turns | Accuracy ×0.67; no critical hits; no secondary effects | After duration expires |
| **VITALIZED** | Applied by moves/abilities | 4 turns | All recovery/drain moves heal 1.5x | After duration expires |
| **BURN** | Applied by moves | Permanent | Halves physical ATK; 1/16 max HP damage/turn during processStatusTick | Cured via items |
| **POISON** | Applied by moves | Permanent | 1/8 max HP damage/turn during processStatusTick | Cured via items |
| **PARALYSIS** | Applied by moves | Permanent | 25% chance to skip turn; halves SPE during speed calc | Cured via items |

### 8.2 Secondary Statuses (stackable, clear on switch)

| Status | Application | Duration | Tick Effect | Expiry |
|--------|------------|----------|-------------|--------|
| **SKILL_DRAINED** | Applied by moves | 2-3 turns | Ability suppressed; passive items/effects disabled | After duration expires |
| **CHARMED** | Applied by moves | 3 turns | 30% skip action; 20% heal opponent 1/16 HP | After duration expires |
| **CHAINED** | Applied by moves | 3 turns | Can't switch; can't use priority; -10% SPE/turn | After duration expires |
| **LIFE_DRAINED** | Applied by moves | 4 turns | 1/8 max HP damage/turn; source heals for same amount | After duration expires |
| **TETHERED** | Applied by moves | 3 turns | Can't switch; if force-switched, partner takes 33% max HP damage | After duration expires |
| **FLINCHED** | Applied by moves | 1 turn | Skips the user's next move attempt | Auto-clear at end of turn |
| **CONFUSED** | Applied by moves | 2-4 turns | 1/3 chance to hit self each turn | After duration expires |
| **INFATUATED** | Applied by moves | Via moves | 50% skip action; 30% chance heal opponent 1/16 HP/turn | After duration expires |

---

## 9. Life Conversion

Life Conversion is a mechanic that uses HP as a resource instead of standard PP/MP.

### 9.1 Move-Level Life Conversion

Configured directly on `MoveSchema`:

```typescript
interface MoveSchema {
  hpCostPercent?: number;   // % of max HP sacrificed on use
  healPercent?: number;     // % of max HP healed on use
  hpThreshold?: number;     // Requires user HP ≤ this % to use
}
```

**Example:** `life_conversion_sacrifice` move has `power: 180, hpCostPercent: 30, hpThreshold: 50` — powerful attack but requires ≤50% HP and costs 30% max HP.

### 9.2 Engine Methods

| Method | Purpose |
|--------|---------|
| `lifeConversionSacrifice(slot, percent)` | Deducts % of max HP, returns false if insufficient HP |
| `lifeConversionHeal(slot, percent)` | Restores % of max HP (capped at max) |
| `getHPPercent(slot)` | Returns current HP as percentage |

---

## 10. Graveyard & Banish Zone

### 10.1 Graveyard (GY)

- **Storage:** `state.graveyard[side]` — array of `BattleMon` objects.
- **Entry:** When a monster's HP reaches 0, `faintMon()` pushes it to the GY and sets its slot to null.
- **Exit:** `reviveFromGY()` splices a monster from GY to an active slot with 50% HP.
- **Scaling:** Abilities like Graveyard King check GY count for stat boosts.

### 10.2 Banish Zone

- **Storage:** `state.banish[side]` — array of `BattleMon` objects.
- **Entry:** `banishMon()` moves a monster directly to the banish zone (no HP threshold needed).
- **Properties:** Monsters in the banish zone cannot be revived by normal GY-targeting effects.

---

## 11. Damage Formula

Pokémon-style damage calculation in `computeDamage()`:

```
base = floor(((2 * level / 5 + 2) * power * (A/D)) / 50 + 2)
modifiers = crit * random * STAB * typeEff * weatherMod * fieldMod * pierceMod
damage = max(1, floor(base * modifiers))
```

### Modifier Stack

| Modifier | Value | Source |
|----------|-------|--------|
| `crit` | 1.5 if critical hit, else 1.0 | Random 6.25% base |
| `random` | 0.85–1.0 | Uniform random |
| `STAB` | 1.5 if move element matches user element, else 1.0 | MonsterSchema.elements |
| `typeEff` | 0.5, 1.0, 1.5, or 2.0 | Type chart in weather.ts |
| `weatherMod` | 1.0–1.5 | Weather system |
| `fieldMod` | 1.0–1.3 | Field system (Megalith Portal) |
| `pierceMod` | 1.3 if target is PIERCED, else 1.0 | Primary status |

### Stat Selection (with Stage Multiplier)

The effective stat used in damage is computed as `getEffectiveStat(mon, stat)` which applies the stage multiplier:

```typescript
function stageMultiplier(stage: number): number {
  if (stage >= 0) return (2 + stage) / 2;   // +1 → 1.5x, +6 → 4.0x
  return 2 / (2 - stage);                     // -1 → 0.67x, -6 → 0.25x
}
```

| Category | Attack Stat | Defense Stat |
|----------|------------|-------------|
| Physical | ATK (× stage multiplier) | DEF (× stage multiplier) |
| Special | SPATK (× stage multiplier) | SPDEF (× stage multiplier) |

### Spread Tax

If a move hits more than 1 target, each target takes 0.75x damage (unless the target has PIERCED status, which bypasses this reduction).

### Accuracy

```
finalAcc = (move.accuracy / 100) × weatherAccMod × statusAccMod
```

Where `statusAccMod` is 0.67 if target is BLINDED, and 0.05 per STACKED stack.

---

## 12. Target Resolution

`resolveTargets()` maps `TargetScope` to actual `BattleSlot[]`:

| Scope | Behavior |
|-------|----------|
| `SINGLE_ADJACENT` | Checks user's index, then index-1, then index+1; returns first living target |
| `SINGLE_ANY` | Iterates indices 0→2; returns first living target |
| `ALL_OPPONENTS` | Returns all living opponents |
| `EVERYONE_BUT_USER` | Returns all living slots except the user (both sides) |
| `ALL_ADJACENT_ALLIES` | Returns all living allies |
| `SELF` | Returns the user slot |

**Redirection:** Before returning, each candidate slot is passed through `maybeRedirect()`, which checks for Dragon-typed targets and Eyes of Blue redirect.

---

## 13. Demonstration & Tests

### 13.1 Demo (`examples/demo.ts`)

Runnable example that exercises every v0.0.2 system:
1. Team construction with bench slots and held items
2. Stat stage system (ATK/SPATK modifiers)
3. Weather system (HARSH_SUNLIGHT)
4. Hazard system (Stealth Rock on ally side)
5. Switch system (bench → active with Stealth Rock damage)
6. Status tick damage (Burn 1/16, Poison 1/8)
7. Multi-hit move (Dual Wingbeat 2-hit sequence)
8. End-of-turn tick processing (items + status)
9. AI opponent turn execution
10. Item effects (Life Orb recoil, Leftovers regen)
11. Field spell (Zombie World)

### 13.2 Type Chart Test (`examples/test_type_chart.ts`)

Validates the full 7×7 type effectiveness matrix with assertions for LIGHT > DARK and DARK < LIGHT relationships.

---

## 14. Build & Run Commands

```bash
npm run build       # Compile TypeScript → dist/
npm run demo        # Build + run full system demo
npm test            # Build + run type chart test
npm run db-editor   # Build + launch interactive CLI database editor
npm run db-gui      # Build + start server (port 3000)
npx tsc --noEmit    # Type-check only (no output)
```

After starting the server with `npm run db-gui`:
- **Database Editor:** http://localhost:3000/
- **Game Hub:** http://localhost:3000/game/

---

## 15. Database Editor Tools

**Files:** `src/tools/db-editor.ts`, `src/tools/db-server.ts`, `src/tools/db-gui.html`

Two interfaces for editing the JSON databases: an interactive CLI and a web GUI. Both support full CRUD on all 5 databases and auto-adapt to schema changes.

### 15.1 CLI Editor (`npm run db-editor`)

Terminal-based interactive editor:
- Select a database (abilities/effects/items/moves/monsters)
- Browse/search entries, view full details
- Edit any field with proper input types (string, number, boolean, enum select, string[] tag editor, nested object editing)
- Create new entries or delete existing ones

### 15.2 Web GUI (`npm run db-gui`)

Starts an HTTP server on `http://localhost:3000` serving a single-page web app:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/databases` | GET | List all databases with entry counts |
| `/api/schema` | GET | Auto-generated field schemas for all databases |
| `/api/databases/:name` | GET | List all entries in a database |
| `/api/databases/:name` | POST | Create a new entry |
| `/api/databases/:name/:id` | GET | Get a single entry |
| `/api/databases/:name/:id` | PUT | Update an entry |
| `/api/databases/:name/:id` | DELETE | Delete an entry |

### 15.3 Auto-Schema Generation

The `GET /api/schema` endpoint scans every entry in each database and dynamically infers field types:

| Inferred Type | Criteria | Rendered As |
|---------------|----------|-------------|
| `string` | Free-text string values | Text input (textarea for description/effectId) |
| `number` | All numeric values | Number input |
| `boolean` | All boolean values | Checkbox |
| `enum` | String with 2–40 unique values across entries | Select dropdown |
| `object` | Nested objects (e.g., baseStats, multiHit) | Recursive nested form |
| `string[]` | Arrays of strings | Tag editor with optional value suggestions |

Adding new fields to any JSON database automatically updates the editor — no code changes needed.

---

## 16. Game Systems

**Files:** `src/game/player.ts`, `src/game/shop.ts`, `src/game/arena.ts`, `src/game/hub.html`

The game loop is a single-page web application served at `http://localhost:3000/game/`. It wraps the battle engine with progression mechanics (gacha collection, team building, arena battles).

### 16.1 Architecture

```
Main Hub
  ├── Shop        → Master Pack (500cr) → random Lv.100 monster (no dupes)
  ├── Collection  → grid of owned monsters → detail modal with stats
  ├── Team Builder → 6-slot roster (L/C/R active + B1/B2/B3 bench)
  └── Arena       → 5 stages → NPC team → battle → rewards
```

### 16.2 Player Profile (`src/game/player.ts`)

- Auto-created on first launch at `src/game/save.json`
- Currency (start with 1000cr), monster vault, item vault
- All 23 items unlocked by default
- 10 team slots with name, save/load/clone/clear
- Team validation: 3 active slots required + unique-item-clause

### 16.3 Shop (`src/game/shop.ts`)

- Single **Master Pack** (500 currency)
- Contains all 8 monster species with weighted rarity
- **No duplicates** — only unowned monsters appear in the pool
- Refunds if all monsters already collected
- All pulls at Lv.100

### 16.4 Battle Arena (`src/game/arena.ts`)

| Stage | Difficulty | Reward | NPC Team Size |
|-------|-----------|--------|---------------|
| Rookie League | 1 | 100cr | 3 |
| Intermediate League | 2 | 200cr | 4 |
| Advanced League | 3 | 350cr | 5 |
| Elite League | 4 | 500cr | 6 |
| Champion League | 5 | 1000cr | 6 |

- NPC teams generated dynamically at Lv.100 with random items
- Uses full `BattleEngine` for combat (10-turn cap, HP comparison on timeout)
- Combat log displayed in frontend

### 16.5 Frontend Pages

| Route | Page | Features |
|-------|------|----------|
| `#hub` | Hub | Dashboard with stats, quick navigation cards |
| `#collection` | Collection | Monster grid with sprites, click for stat modal |
| `#teambuilder` | Team Builder | Slot roster + vault tabs, save/clone/clear |
| `#shop` | Shop | Pack purchase, pull results overlay |
| `#arena` | Arena | Stage selection, team pick, battle log |

### 16.6 Monster Sprites

Sprite files go in `public/images/monsters/{id}.png` (e.g. `blue_eyes_white_dragon.png`). The server serves them at `/images/monsters/{id}.png`. If no sprite file exists, a placeholder is shown.

---

## 17. Known Limitations (v0.0.4)

- **No speed-ordering turn queue** — Moves execute in caller order (`executeMove()` is called directly). `getEffectiveSpeed()` exists but isn't wired into a turn queue.
- **No double battles / tag-team mechanics** — Triple battle format only (3 active + 3 bench).
- **No network multiplayer** — Local single-player only.
- **AI is simple random-pick** — No strategy, type-matchup awareness, or prediction.
- **No battle animations or UI** — Text log only.
- **No formal Terrain system** — (Psychic/Grassy/Misty/Electric terrains not implemented).
- **Serene Grace / Mold Breaker** — Framework hooks not wired into move effect probability rolls.
- **Effects are code-defined** — `effects.json` stores metadata only; new functional effects require code in `effects.ts`.
- **No monster evolution or level-up** — All monsters fixed at Lv.100.
- **No equipment system** — All items always unlocked; no loot or crafting.
