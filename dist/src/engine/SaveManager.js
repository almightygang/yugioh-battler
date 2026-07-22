"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaveManager = void 0;
const fs = __importStar(require("fs"));
const BattleEngine_1 = require("./BattleEngine");
class SaveManager {
    static saveToFile(engine, filePath) {
        const json = JSON.stringify(engine.state, null, 2);
        fs.writeFileSync(filePath, json, "utf-8");
        console.log(`Battle saved to ${filePath}`);
    }
    static loadFromFile(filePath) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`Save file not found: ${filePath}`);
        }
        const raw = fs.readFileSync(filePath, "utf-8");
        const state = JSON.parse(raw);
        return SaveManager.restoreEngine(state, filePath);
    }
    static exportState(engine) {
        return JSON.stringify(engine.state, null, 2);
    }
    static importState(json, filePath) {
        const state = JSON.parse(json);
        return SaveManager.restoreEngine(state, filePath);
    }
    static restoreEngine(state, _filePath) {
        const emptyAlly = { active: [null, null, null], bench: [] };
        const emptyOpp = { active: [null, null, null], bench: [] };
        const engine = new BattleEngine_1.BattleEngine(emptyAlly, emptyOpp);
        engine.state = state;
        return engine;
    }
}
exports.SaveManager = SaveManager;
