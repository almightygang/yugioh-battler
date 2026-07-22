"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Monsters = void 0;
const types_1 = require("../types");
const monsters_json_1 = __importDefault(require("../database/monsters.json"));
const raw = monsters_json_1.default.default ?? monsters_json_1.default;
exports.Monsters = {};
function parseEnumList(enumObj, values) {
    return values.map((v) => (enumObj[v] ?? v));
}
for (const key of Object.keys(raw)) {
    const entry = raw[key];
    exports.Monsters[key] = {
        id: entry.id,
        name: entry.name,
        archetype: entry.archetype,
        isLegendary: entry.isLegendary,
        baseStats: { ...entry.baseStats },
        elements: parseEnumList(types_1.Element, entry.elements),
        types: parseEnumList(types_1.MonsterType, entry.types),
        abilityId: entry.abilityId ?? undefined,
        learnset: [...entry.learnset],
    };
}
