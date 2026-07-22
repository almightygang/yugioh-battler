"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Hazard = exports.SecondaryStatus = exports.PrimaryStatus = exports.MonsterType = exports.TargetScope = exports.Category = exports.Element = void 0;
exports.stageMultiplier = stageMultiplier;
exports.createDefaultStages = createDefaultStages;
exports.createBattleMon = createBattleMon;
var Element;
(function (Element) {
    Element["LIGHT"] = "LIGHT";
    Element["DARK"] = "DARK";
    Element["FIRE"] = "FIRE";
    Element["WATER"] = "WATER";
    Element["EARTH"] = "EARTH";
    Element["WIND"] = "WIND";
    Element["NORMAL"] = "NORMAL";
})(Element || (exports.Element = Element = {}));
var Category;
(function (Category) {
    Category["Physical"] = "Physical";
    Category["Special"] = "Special";
    Category["Status"] = "Status";
})(Category || (exports.Category = Category = {}));
var TargetScope;
(function (TargetScope) {
    TargetScope["SINGLE_ADJACENT"] = "SINGLE_ADJACENT";
    TargetScope["SINGLE_ANY"] = "SINGLE_ANY";
    TargetScope["ALL_OPPONENTS"] = "ALL_OPPONENTS";
    TargetScope["ALL_ADJACENT_ALLIES"] = "ALL_ADJACENT_ALLIES";
    TargetScope["EVERYONE_BUT_USER"] = "EVERYONE_BUT_USER";
    TargetScope["SELF"] = "SELF";
})(TargetScope || (exports.TargetScope = TargetScope = {}));
var MonsterType;
(function (MonsterType) {
    MonsterType["DRAGON"] = "DRAGON";
    MonsterType["WARRIOR"] = "WARRIOR";
    MonsterType["SPELLCASTER"] = "SPELLCASTER";
    MonsterType["SUPPORT"] = "SUPPORT";
    MonsterType["ZOMBIE"] = "ZOMBIE";
    MonsterType["FIEND"] = "FIEND";
    MonsterType["FAIRY"] = "FAIRY";
    MonsterType["MACHINE"] = "MACHINE";
    MonsterType["ROCK"] = "ROCK";
})(MonsterType || (exports.MonsterType = MonsterType = {}));
var PrimaryStatus;
(function (PrimaryStatus) {
    PrimaryStatus["NONE"] = "NONE";
    PrimaryStatus["STACKED"] = "STACKED";
    PrimaryStatus["PIERCED"] = "PIERCED";
    PrimaryStatus["CURSED"] = "CURSED";
    PrimaryStatus["BLINDED"] = "BLINDED";
    PrimaryStatus["VITALIZED"] = "VITALIZED";
    PrimaryStatus["BURN"] = "BURN";
    PrimaryStatus["POISON"] = "POISON";
    PrimaryStatus["PARALYSIS"] = "PARALYSIS";
})(PrimaryStatus || (exports.PrimaryStatus = PrimaryStatus = {}));
var SecondaryStatus;
(function (SecondaryStatus) {
    SecondaryStatus["SKILL_DRAINED"] = "SKILL_DRAINED";
    SecondaryStatus["CHARMED"] = "CHARMED";
    SecondaryStatus["CHAINED"] = "CHAINED";
    SecondaryStatus["LIFE_DRAINED"] = "LIFE_DRAINED";
    SecondaryStatus["TETHERED"] = "TETHERED";
    SecondaryStatus["FLINCHED"] = "FLINCHED";
    SecondaryStatus["CONFUSED"] = "CONFUSED";
    SecondaryStatus["INFATUATED"] = "INFATUATED";
})(SecondaryStatus || (exports.SecondaryStatus = SecondaryStatus = {}));
function stageMultiplier(stage) {
    if (stage >= 0)
        return (2 + stage) / 2;
    return 2 / (2 - stage);
}
function createDefaultStages() {
    return { atk: 0, def: 0, spAtk: 0, spDef: 0, spe: 0, accuracy: 0, evasion: 0 };
}
var Hazard;
(function (Hazard) {
    Hazard["STEALTH_ROCK"] = "STEALTH_ROCK";
})(Hazard || (exports.Hazard = Hazard = {}));
function createBattleMon(id, level, stats, abilityId, itemId, nickname) {
    const hp = stats.hp * 10;
    return {
        id,
        nickname,
        level,
        currentHP: hp,
        maxHP: hp,
        stats,
        abilityId,
        itemId: itemId ?? null,
        primaryStatus: PrimaryStatus.NONE,
        primaryStatusTurns: 0,
        stackedCount: 0,
        secondaryStatuses: [],
        secondaryStatusTurns: {},
        statusSource: {},
        statStages: createDefaultStages(),
    };
}
