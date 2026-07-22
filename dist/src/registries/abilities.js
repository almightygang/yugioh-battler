"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Abilities = void 0;
const abilities_json_1 = __importDefault(require("../database/abilities.json"));
const raw = abilities_json_1.default.default ?? abilities_json_1.default;
exports.Abilities = {};
for (const key of Object.keys(raw)) {
    const entry = raw[key];
    exports.Abilities[key] = {
        id: entry.id,
        name: entry.name,
        description: entry.description,
        effectId: entry.effectId,
    };
}
