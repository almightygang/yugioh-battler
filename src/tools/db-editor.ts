import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const DB_DIR = path.resolve(__dirname, "..", "database");

type FieldDef =
  | { type: "string"; key: string; label: string; optional?: true }
  | { type: "number"; key: string; label: string; optional?: true }
  | { type: "boolean"; key: string; label: string; optional?: true }
  | { type: "enum"; key: string; label: string; values: string[]; optional?: true }
  | { type: "string[]"; key: string; label: string; values?: string[]; optional?: true }
  | { type: "object"; key: string; label: string; fields: FieldDef[]; optional?: true };

interface DbMeta {
  file: string;
  idField: string;
  fields: FieldDef[];
}

const DATABASES: Record<string, DbMeta> = {
  abilities: {
    file: "abilities.json",
    idField: "id",
    fields: [
      { type: "string", key: "id", label: "ID" },
      { type: "string", key: "name", label: "Name" },
      { type: "string", key: "description", label: "Description" },
      { type: "string", key: "effectId", label: "Effect ID" },
    ],
  },
  items: {
    file: "items.json",
    idField: "id",
    fields: [
      { type: "string", key: "id", label: "ID" },
      { type: "string", key: "name", label: "Name" },
      { type: "string", key: "description", label: "Description" },
      { type: "string", key: "effectId", label: "Effect ID" },
    ],
  },
  moves: {
    file: "moves.json",
    idField: "id",
    fields: [
      { type: "string", key: "id", label: "ID" },
      { type: "string", key: "name", label: "Name" },
      { type: "enum", key: "element", label: "Element", values: ["LIGHT", "DARK", "FIRE", "WATER", "EARTH", "WIND", "NORMAL"] },
      { type: "enum", key: "category", label: "Category", values: ["Physical", "Special", "Status"] },
      { type: "number", key: "power", label: "Power" },
      { type: "number", key: "accuracy", label: "Accuracy" },
      { type: "number", key: "priority", label: "Priority" },
      { type: "number", key: "maxPP", label: "Max PP" },
      { type: "enum", key: "targetScope", label: "Target Scope", values: ["SINGLE_ADJACENT", "SINGLE_ANY", "ALL_OPPONENTS", "ALL_ADJACENT_ALLIES", "EVERYONE_BUT_USER", "SELF"] },
      { type: "string", key: "effectId", label: "Effect ID", optional: true },
      { type: "number", key: "hpCostPercent", label: "HP Cost %", optional: true },
      { type: "number", key: "healPercent", label: "Heal %", optional: true },
      { type: "number", key: "hpThreshold", label: "HP Threshold %", optional: true },
      { type: "object", key: "multiHit", label: "Multi-Hit", optional: true, fields: [
        { type: "number", key: "minHits", label: "Min Hits" },
        { type: "number", key: "maxHits", label: "Max Hits" },
      ] },
    ],
  },
  monsters: {
    file: "monsters.json",
    idField: "id",
    fields: [
      { type: "string", key: "id", label: "ID" },
      { type: "string", key: "name", label: "Name" },
      { type: "string", key: "archetype", label: "Archetype" },
      { type: "boolean", key: "isLegendary", label: "Is Legendary" },
      { type: "object", key: "baseStats", label: "Base Stats", fields: [
        { type: "number", key: "hp", label: "HP" },
        { type: "number", key: "atk", label: "ATK" },
        { type: "number", key: "def", label: "DEF" },
        { type: "number", key: "spAtk", label: "SpAtk" },
        { type: "number", key: "spDef", label: "SpDef" },
        { type: "number", key: "spe", label: "SPE" },
      ] },
      { type: "string[]", key: "elements", label: "Elements", values: ["LIGHT", "DARK", "FIRE", "WATER", "EARTH", "WIND", "NORMAL"] },
      { type: "string[]", key: "types", label: "Types", values: ["DRAGON", "WARRIOR", "SPELLCASTER", "SUPPORT", "ZOMBIE", "FIEND", "FAIRY", "MACHINE", "ROCK"] },
      { type: "string", key: "abilityId", label: "Ability ID", optional: true },
      { type: "string[]", key: "learnset", label: "Learnset" },
    ],
  },
};

// ── Helpers ────────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function askNumber(query: string, defaultVal?: number): Promise<number | undefined> {
  const a = await ask(query);
  if (!a.trim() && defaultVal !== undefined) return defaultVal;
  const n = Number(a);
  return isNaN(n) ? undefined : n;
}

async function askBoolean(query: string, defaultVal?: boolean): Promise<boolean | undefined> {
  const a = (await ask(query)).toLowerCase();
  if (!a.trim() && defaultVal !== undefined) return defaultVal;
  if (a === "y" || a === "yes" || a === "true") return true;
  if (a === "n" || a === "no" || a === "false") return false;
  return undefined;
}

async function askEnum(query: string, values: string[], defaultVal?: string): Promise<string | undefined> {
  console.log(`  Options: ${values.join(", ")}`);
  const a = (await ask(query)).trim();
  if (!a && defaultVal !== undefined) return defaultVal;
  if (values.includes(a)) return a;
  console.log(`  Invalid. Must be one of: ${values.join(", ")}`);
  return undefined;
}

async function askStringArray(query: string, validValues?: string[]): Promise<string[] | undefined> {
  const a = (await ask(query)).trim();
  if (!a) return undefined;
  const items = a.split(",").map((s) => s.trim()).filter(Boolean);
  if (validValues) {
    const invalid = items.filter((i) => !validValues.includes(i));
    if (invalid.length > 0) {
      console.log(`  Invalid values: ${invalid.join(", ")}`);
      console.log(`  Valid options: ${validValues.join(", ")}`);
      return undefined;
    }
  }
  return items;
}

function loadDb(name: string): Record<string, any> {
  const meta = DATABASES[name];
  if (!meta) throw new Error(`Unknown database: ${name}`);
  const p = path.join(DB_DIR, meta.file);
  const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
  return raw;
}

function saveDb(name: string, data: Record<string, any>): void {
  const meta = DATABASES[name];
  const p = path.join(DB_DIR, meta.file);
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
  console.log(`Saved ${meta.file}`);
}

// ── Interactive field editor ───────────────────────────────────────

async function editFields(entry: Record<string, any>, fields: FieldDef[], prefix = ""): Promise<Record<string, any>> {
  const result = { ...entry };
  for (const f of fields) {
    const key = f.key;
    const prompt = (def: string) => `  ${f.label} (${def}): `;

    if (f.type === "object") {
      const sub = result[key] ?? {};
      const edited = await editFields(sub, f.fields, `${prefix}${key}.`);
      if (Object.keys(edited).length > 0) result[key] = edited;
      else if (f.optional) delete result[key];
      continue;
    }

    const currentVal = result[key];
    const defStr = currentVal !== undefined && currentVal !== null ? String(currentVal) : "(none)";

    if (f.type === "string") {
      const a = await ask(prompt(defStr));
      if (a.trim()) result[key] = a.trim();
      else if (currentVal !== undefined) { /* keep existing */ }
      else if (!f.optional) result[key] = "";
    } else if (f.type === "number") {
      const n = await askNumber(prompt(defStr), currentVal);
      if (n !== undefined) result[key] = n;
      else if (f.optional) { if (result.hasOwnProperty(key) && currentVal === undefined) delete result[key]; }
    } else if (f.type === "boolean") {
      const b = await askBoolean(prompt(defStr), currentVal);
      if (b !== undefined) result[key] = b;
    } else if (f.type === "enum") {
      const e = await askEnum(prompt(defStr), f.values, currentVal);
      if (e !== undefined) result[key] = e;
    } else if (f.type === "string[]") {
      console.log(`  ${f.label} current: ${(currentVal as string[])?.join(", ") ?? "(none)"}`);
      if (f.values) console.log(`  Valid values: ${f.values.join(", ")}`);
      const a = await ask(`  ${f.label} (comma-separated, Enter to keep): `);
      if (a.trim()) {
        const items = a.split(",").map((s) => s.trim()).filter(Boolean);
        if (f.values) {
          const invalid = items.filter((i) => !(f.values as string[]).includes(i));
          if (invalid.length > 0) {
            console.log(`  Invalid: ${invalid.join(", ")} — set anyway.`);
          }
        }
        result[key] = items;
      }
    }
  }
  return result;
}

async function displayEntry(entry: Record<string, any>, indent = ""): Promise<void> {
  for (const [k, v] of Object.entries(entry)) {
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      console.log(`${indent}${k}:`);
      await displayEntry(v, indent + "  ");
    } else {
      console.log(`${indent}${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
    }
  }
}

// ── CRUD Operations ────────────────────────────────────────────────

async function listEntries(dbName: string): Promise<void> {
  const data = loadDb(dbName);
  const meta = DATABASES[dbName];
  const entries = Object.keys(data);
  console.log(`\n${dbName} — ${entries.length} entries:\n`);
  for (const id of entries) {
    const entry = data[id];
    const name = entry.name || entry.id || id;
    console.log(`  ${id}  (${name})`);
  }
}

async function viewEntry(dbName: string): Promise<void> {
  const data = loadDb(dbName);
  const id = await ask("Entry ID: ");
  if (!id.trim()) return;
  const entry = data[id.trim()];
  if (!entry) { console.log("Not found."); return; }
  console.log("");
  await displayEntry(entry);
}

async function createEntry(dbName: string): Promise<void> {
  const data = loadDb(dbName);
  const meta = DATABASES[dbName];
  const entry: Record<string, any> = {};
  const edited = await editFields(entry, meta.fields);
  if (!edited.id) { console.log("ID is required."); return; }
  if (data[edited.id]) { console.log(`Entry "${edited.id}" already exists.`); return; }
  data[edited.id] = edited;
  saveDb(dbName, data);
  console.log(`Created ${dbName}/${edited.id}.`);
}

async function editEntry(dbName: string): Promise<void> {
  const data = loadDb(dbName);
  const meta = DATABASES[dbName];
  const id = await ask("Entry ID to edit: ");
  if (!id.trim()) return;
  if (!data[id.trim()]) { console.log("Not found."); return; }
  const edited = await editFields(data[id.trim()], meta.fields);
  data[id.trim()] = edited;
  saveDb(dbName, data);
  console.log(`Updated ${dbName}/${id.trim()}.`);
}

async function deleteEntry(dbName: string): Promise<void> {
  const data = loadDb(dbName);
  const id = await ask("Entry ID to delete: ");
  if (!id.trim()) return;
  if (!data[id.trim()]) { console.log("Not found."); return; }
  const confirm = await ask(`Delete "${id.trim()}"? (y/N): `);
  if (confirm.toLowerCase() === "y") {
    delete data[id.trim()];
    saveDb(dbName, data);
    console.log(`Deleted ${dbName}/${id.trim()}.`);
  }
}

// ── DB Menu ────────────────────────────────────────────────────────

async function dbMenu(dbName: string): Promise<void> {
  while (true) {
    console.log(`\n--- ${dbName} ---`);
    console.log("1. List entries");
    console.log("2. View entry");
    console.log("3. Create entry");
    console.log("4. Edit entry");
    console.log("5. Delete entry");
    console.log("6. Back");
    const choice = await ask("Choice (1-6): ");
    switch (choice.trim()) {
      case "1": await listEntries(dbName); break;
      case "2": await viewEntry(dbName); break;
      case "3": await createEntry(dbName); break;
      case "4": await editEntry(dbName); break;
      case "5": await deleteEntry(dbName); break;
      case "6": return;
      default: console.log("Invalid choice.");
    }
  }
}

// ── Main Menu ──────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`
╔══════════════════════════╗
║  Yu-Gi-Oh! Battler       ║
║  Database Editor         ║
╚══════════════════════════╝
`);
  while (true) {
    console.log("Databases:");
    const dbNames = Object.keys(DATABASES);
    for (let i = 0; i < dbNames.length; i++) {
      const data = loadDb(dbNames[i]);
      console.log(`  ${i + 1}. ${dbNames[i]}  (${Object.keys(data).length} entries)`);
    }
    console.log(`  ${dbNames.length + 1}. Exit`);
    const choice = await ask(`Select (1-${dbNames.length + 1}): `);
    const idx = parseInt(choice.trim(), 10);
    if (idx >= 1 && idx <= dbNames.length) {
      await dbMenu(dbNames[idx - 1]);
    } else if (idx === dbNames.length + 1) {
      break;
    } else {
      console.log("Invalid choice.");
    }
  }
  rl.close();
}

main().catch((err) => {
  console.error(err);
  rl.close();
});
