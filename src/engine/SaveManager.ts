import * as fs from "fs";
import { BattleState, Team } from "../types";
import { BattleEngine } from "./BattleEngine";

export class SaveManager {

  static saveToFile(engine: BattleEngine, filePath: string): void {
    const json = JSON.stringify(engine.state, null, 2);
    fs.writeFileSync(filePath, json, "utf-8");
    console.log(`Battle saved to ${filePath}`);
  }

  static loadFromFile(filePath: string): BattleEngine {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Save file not found: ${filePath}`);
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    const state: BattleState = JSON.parse(raw);
    return SaveManager.restoreEngine(state, filePath);
  }

  static exportState(engine: BattleEngine): string {
    return JSON.stringify(engine.state, null, 2);
  }

  static importState(json: string, filePath?: string): BattleEngine {
    const state: BattleState = JSON.parse(json);
    return SaveManager.restoreEngine(state, filePath);
  }

  private static restoreEngine(state: BattleState, _filePath?: string): BattleEngine {
    const emptyAlly: Team = { active: [null, null, null], bench: [] };
    const emptyOpp: Team = { active: [null, null, null], bench: [] };
    const engine = new BattleEngine(emptyAlly, emptyOpp);
    engine.state = state as any;
    return engine;
  }
}
