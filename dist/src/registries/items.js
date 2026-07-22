"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Items = void 0;
const items_json_1 = __importDefault(require("../database/items.json"));
const raw = items_json_1.default.default ?? items_json_1.default;
exports.Items = {};
for (const key of Object.keys(raw)) {
    const entry = raw[key];
    exports.Items[key] = {
        id: entry.id,
        name: entry.name,
        description: entry.description,
        effectId: entry.effectId,
    };
}
