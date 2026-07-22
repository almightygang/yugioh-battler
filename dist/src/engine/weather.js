"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Weathers = void 0;
exports.weatherDamageModifier = weatherDamageModifier;
exports.weatherAccuracyModifier = weatherAccuracyModifier;
exports.getWeatherTickDamage = getWeatherTickDamage;
exports.weatherSpeedModifier = weatherSpeedModifier;
exports.typeEffectiveness = typeEffectiveness;
const types_1 = require("../types");
exports.Weathers = {
    BLINDING_RADIANCE: { id: 'BLINDING_RADIANCE', duration: null },
    HARSH_SUNLIGHT: { id: 'HARSH_SUNLIGHT', duration: 5 },
    RAIN: { id: 'RAIN', duration: 5 },
    SANDSTORM: { id: 'SANDSTORM', duration: 5 },
    HAIL: { id: 'HAIL', duration: 5 },
};
function weatherDamageModifier(weather, moveElement) {
    if (!weather)
        return 1.0;
    switch (weather.id) {
        case 'BLING_RADIANCE':
        case 'BLINDING_RADIANCE':
            if (moveElement === types_1.Element.LIGHT)
                return 1.5;
            return 1.0;
        case 'HARSH_SUNLIGHT':
            if (moveElement === types_1.Element.FIRE)
                return 1.5;
            if (moveElement === types_1.Element.WATER)
                return 0.5;
            return 1.0;
        case 'RAIN':
            if (moveElement === types_1.Element.WATER)
                return 1.5;
            if (moveElement === types_1.Element.FIRE)
                return 0.5;
            return 1.0;
        case 'SANDSTORM':
            if (moveElement === types_1.Element.EARTH)
                return 1.3;
            return 1.0;
        case 'HAIL':
            if (moveElement === types_1.Element.WIND)
                return 1.3;
            return 1.0;
        default:
            return 1.0;
    }
}
function weatherAccuracyModifier(weather, targetElements) {
    if (!weather)
        return 1.0;
    if (weather.id === 'BLINDING_RADIANCE') {
        const nonLight = targetElements.every((e) => e !== types_1.Element.LIGHT);
        return nonLight ? 0.9 : 1.0;
    }
    return 1.0;
}
function getWeatherTickDamage(weather, mon, monsterTypes) {
    if (!weather)
        return 0;
    if (weather.id === 'SANDSTORM') {
        const immune = monsterTypes.some((t) => t === types_1.MonsterType.ROCK);
        if (!immune)
            return Math.floor(mon.maxHP / 16);
    }
    if (weather.id === 'HAIL') {
        const immune = monsterTypes.some((t) => t === types_1.MonsterType.WARRIOR);
        if (!immune)
            return Math.floor(mon.maxHP / 16);
    }
    return 0;
}
function weatherSpeedModifier(weather, abilityId) {
    if (!weather)
        return 1.0;
    if ((weather.id === 'HARSH_SUNLIGHT' && abilityId === 'chlorophyll') ||
        (weather.id === 'RAIN' && abilityId === 'swift_swim')) {
        return 2.0;
    }
    return 1.0;
}
function typeEffectiveness(moveElement, targetElements) {
    const chart = {
        LIGHT: { DARK: 2.0, LIGHT: 1.0, FIRE: 1.0, WATER: 1.0, EARTH: 1.0, WIND: 1.0, NORMAL: 1.0 },
        DARK: { LIGHT: 0.5, DARK: 1.0, FIRE: 1.0, WATER: 1.0, EARTH: 1.0, WIND: 1.0, NORMAL: 1.0 },
        FIRE: { WIND: 1.5, EARTH: 1.0, WATER: 0.5, FIRE: 0.5, LIGHT: 1.0, DARK: 1.0, NORMAL: 1.0 },
        WATER: { FIRE: 2.0, EARTH: 1.5, WIND: 0.5, WATER: 0.5, LIGHT: 1.0, DARK: 1.0, NORMAL: 1.0 },
        EARTH: { FIRE: 1.0, WATER: 1.0, WIND: 0.5, EARTH: 1.0, LIGHT: 1.0, DARK: 1.0, NORMAL: 1.0 },
        WIND: { EARTH: 2.0, FIRE: 0.5, WATER: 1.0, WIND: 1.0, LIGHT: 1.0, DARK: 1.0, NORMAL: 1.0 },
        NORMAL: { NORMAL: 1.0, LIGHT: 1.0, DARK: 1.0, FIRE: 1.0, WATER: 1.0, EARTH: 1.0, WIND: 1.0 },
    };
    let mult = 1.0;
    for (const te of targetElements) {
        const row = chart[moveElement];
        if (!row) {
            mult *= 1.0;
            continue;
        }
        mult *= row[te] ?? 1.0;
    }
    return mult;
}
