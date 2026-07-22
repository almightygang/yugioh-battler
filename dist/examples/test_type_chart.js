"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("../src/types");
const weather_1 = require("../src/engine/weather");
const elements = [
    types_1.Element.LIGHT,
    types_1.Element.DARK,
    types_1.Element.FIRE,
    types_1.Element.WATER,
    types_1.Element.EARTH,
    types_1.Element.WIND,
    types_1.Element.NORMAL,
];
console.log('Type effectiveness table: rows=attacker, cols=defender');
const header = ['    ', ...elements.map((e) => e.padEnd(6))].join(' | ');
console.log(header);
console.log('-'.repeat(header.length));
for (const atk of elements) {
    const row = [atk.padEnd(4)];
    for (const def of elements) {
        const mult = (0, weather_1.typeEffectiveness)(atk, [def]);
        row.push(mult.toFixed(2).padEnd(6));
    }
    console.log(row.join(' | '));
}
// Quick assertions
function assertEqual(a, b, msg) {
    if (Math.abs(a - b) > 1e-9)
        throw new Error(`Assertion failed: ${msg} (${a} != ${b})`);
}
// Expected relationships based on the implemented chart
// LIGHT > DARK (2x), DARK < LIGHT (0.5x)
assertEqual((0, weather_1.typeEffectiveness)(types_1.Element.LIGHT, [types_1.Element.DARK]), 2.0, 'LIGHT should be strong vs DARK');
assertEqual((0, weather_1.typeEffectiveness)(types_1.Element.DARK, [types_1.Element.LIGHT]), 0.5, 'DARK should be weak vs LIGHT');
// FIRE > WIND (1.5), FIRE < WATER (0.5) example expectations from our chart
console.log('Sanity checks passed.');
