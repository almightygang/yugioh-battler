"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Moves = void 0;
const types_1 = require("../types");
const moves_json_1 = __importDefault(require("../database/moves.json"));
const raw = moves_json_1.default.default ?? moves_json_1.default;
exports.Moves = {};
function parseEnum(enumObj, value) {
    return enumObj[value] ?? value;
}
for (const key of Object.keys(raw)) {
    const entry = raw[key];
    let multiHit;
    if (entry.multiHit) {
        multiHit = { minHits: entry.multiHit.minHits, maxHits: entry.multiHit.maxHits };
    }
    exports.Moves[key] = {
        id: entry.id,
        name: entry.name,
        element: parseEnum(types_1.Element, entry.element),
        category: parseEnum(types_1.Category, entry.category),
        power: entry.power,
        accuracy: entry.accuracy,
        priority: entry.priority,
        maxPP: entry.maxPP,
        targetScope: parseEnum(types_1.TargetScope, entry.targetScope),
        effectId: entry.effectId,
        hpCostPercent: entry.hpCostPercent,
        healPercent: entry.healPercent,
        hpThreshold: entry.hpThreshold,
        multiHit,
    };
}
