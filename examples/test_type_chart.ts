import { Element } from "../src/types";
import { typeEffectiveness } from "../src/engine/weather";

const elements: Element[] = [
  Element.LIGHT,
  Element.DARK,
  Element.FIRE,
  Element.WATER,
  Element.EARTH,
  Element.WIND,
  Element.NORMAL,
];

console.log('Type effectiveness table: rows=attacker, cols=defender');
const header = ['    ', ...elements.map((e) => e.padEnd(6))].join(' | ');
console.log(header);
console.log('-'.repeat(header.length));

for (const atk of elements) {
  const row = [atk.padEnd(4)];
  for (const def of elements) {
    const mult = typeEffectiveness(atk, [def]);
    row.push(mult.toFixed(2).padEnd(6));
  }
  console.log(row.join(' | '));
}

// Quick assertions
function assertEqual(a: number, b: number, msg: string) {
  if (Math.abs(a - b) > 1e-9) throw new Error(`Assertion failed: ${msg} (${a} != ${b})`);
}

// Expected relationships based on the implemented chart
// LIGHT > DARK (2x), DARK < LIGHT (0.5x)
assertEqual(typeEffectiveness(Element.LIGHT, [Element.DARK]), 2.0, 'LIGHT should be strong vs DARK');
assertEqual(typeEffectiveness(Element.DARK, [Element.LIGHT]), 0.5, 'DARK should be weak vs LIGHT');

// FIRE > WIND (1.5), FIRE < WATER (0.5) example expectations from our chart
console.log('Sanity checks passed.');
