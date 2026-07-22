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
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const player_1 = require("../game/player");
const shop_1 = require("../game/shop");
const arena_1 = require("../game/arena");
const PORT = parseInt(process.env.PORT || "3000", 10);
function findRoot(dir) {
    const pkg = path.join(dir, "package.json");
    if (fs.existsSync(pkg))
        return dir;
    const parent = path.dirname(dir);
    if (parent === dir)
        throw new Error("Could not find project root");
    return findRoot(parent);
}
const PROJECT_ROOT = findRoot(__dirname);
const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");
const SRC_DIR = path.join(PROJECT_ROOT, "src");
const DB_DIR = path.join(SRC_DIR, "database");
const HTML_PATH = path.join(SRC_DIR, "tools", "db-gui.html");
const GAME_HTML_PATH = path.join(SRC_DIR, "game", "hub.html");
const DB_FILES = ["abilities.json", "effects.json", "items.json", "moves.json", "monsters.json"];
const ENUM_MAX = 40;
function inferType(values) {
    const nonNull = values.filter((v) => v !== null && v !== undefined);
    if (nonNull.length === 0)
        return "string";
    const types = new Set(nonNull.map((v) => (Array.isArray(v) ? "array" : typeof v)));
    if (types.has("number"))
        return "number";
    if (types.has("boolean"))
        return "boolean";
    if (types.has("string"))
        return "string";
    if (types.has("object") || types.has("array"))
        return "object";
    return "string";
}
function collectUnique(values) {
    const set = new Set();
    for (const v of values) {
        if (v !== null && v !== undefined && v !== "")
            set.add(String(v));
    }
    return [...set].sort();
}
function collectArrayValues(values) {
    const set = new Set();
    for (const v of values) {
        if (Array.isArray(v))
            for (const item of v)
                set.add(String(item));
    }
    return [...set].sort();
}
function generateSchema(db) {
    const entries = Object.values(db);
    if (entries.length === 0)
        return [{ key: "id", type: "string" }];
    // Union of all keys across all entries (flatten one level for nested objects)
    const allKeys = new Set();
    for (const entry of entries) {
        for (const k of Object.keys(entry))
            allKeys.add(k);
    }
    const sortedKeys = [...allKeys].sort();
    // Count how many entries have each key
    const keyCount = {};
    for (const k of sortedKeys) {
        keyCount[k] = entries.filter((e) => e[k] !== undefined && e[k] !== null).length;
    }
    const schema = [];
    // id is always first, always required
    if (sortedKeys.includes("id")) {
        schema.push({ key: "id", type: "string" });
    }
    const remaining = sortedKeys.filter((k) => k !== "id");
    for (const key of remaining) {
        const values = entries.map((e) => e[key]).filter((v) => v !== undefined);
        if (values.length === 0)
            continue;
        const rawType = inferType(values);
        const allHave = keyCount[key] === entries.length;
        let field = { key, type: "string", optional: !allHave };
        if (rawType === "number") {
            field.type = "number";
        }
        else if (rawType === "boolean") {
            field.type = "boolean";
        }
        else if (rawType === "object") {
            // Check if all values are arrays
            const isArray = values.every((v) => Array.isArray(v));
            if (isArray) {
                field.type = "string[]";
                const arrValues = collectArrayValues(values);
                if (arrValues.length >= 2 && arrValues.length <= ENUM_MAX) {
                    field.values = arrValues;
                }
                else if (arrValues.length > ENUM_MAX) {
                    // Too many to show as enum; still pass top 100 as suggestions
                    field.values = arrValues.slice(0, 100);
                }
            }
            else {
                // Nested object — recurse
                field.type = "object";
                field.fields = generateNestedSchema(values);
            }
        }
        else {
            // string — check if it's enum-like
            const unique = collectUnique(values);
            if (unique.length >= 2 && unique.length <= ENUM_MAX) {
                field.type = "enum";
                field.values = unique;
            }
        }
        schema.push(field);
    }
    return schema;
}
function generateNestedSchema(values) {
    const objs = values.filter((v) => v !== null && v !== undefined && typeof v === "object" && !Array.isArray(v));
    if (objs.length === 0)
        return [];
    const allKeys = new Set();
    for (const o of objs)
        for (const k of Object.keys(o))
            allKeys.add(k);
    const sortedKeys = [...allKeys].sort();
    const keyCount = {};
    for (const k of sortedKeys) {
        keyCount[k] = objs.filter((o) => o[k] !== undefined && o[k] !== null).length;
    }
    const fields = [];
    for (const key of sortedKeys) {
        const vals = objs.map((o) => o[key]).filter((v) => v !== undefined);
        if (vals.length === 0)
            continue;
        const allHave = keyCount[key] === objs.length;
        const rawType = inferType(vals);
        let field = { key, type: "string", optional: !allHave };
        if (rawType === "number") {
            field.type = "number";
        }
        else if (rawType === "boolean") {
            field.type = "boolean";
        }
        else if (rawType === "object") {
            const isArray = vals.every((v) => Array.isArray(v));
            if (isArray) {
                field.type = "string[]";
                const arrValues = collectArrayValues(vals);
                if (arrValues.length >= 2 && arrValues.length <= ENUM_MAX) {
                    field.values = arrValues;
                }
            }
            else {
                field.type = "object";
                field.fields = generateNestedSchema(vals);
            }
        }
        else {
            const unique = collectUnique(vals);
            if (unique.length >= 2 && unique.length <= ENUM_MAX) {
                field.type = "enum";
                field.values = unique;
            }
        }
        fields.push(field);
    }
    return fields;
}
// ── Database Helpers ───────────────────────────────────────────────
function loadAll() {
    const result = {};
    for (const f of DB_FILES) {
        const p = path.join(DB_DIR, f);
        result[f.replace(".json", "")] = JSON.parse(fs.readFileSync(p, "utf-8"));
    }
    return result;
}
function loadDb(name) {
    const f = DB_FILES.find((x) => x.startsWith(name));
    if (!f)
        return null;
    const p = path.join(DB_DIR, f);
    return JSON.parse(fs.readFileSync(p, "utf-8"));
}
function saveDb(name, data) {
    const f = DB_FILES.find((x) => x.startsWith(name));
    if (!f)
        throw new Error(`Unknown database: ${name}`);
    fs.writeFileSync(path.join(DB_DIR, f), JSON.stringify(data, null, 2) + "\n");
}
function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => resolve(body));
        req.on("error", reject);
    });
}
function json(res, status, data) {
    res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(data));
}
// ── API Router ─────────────────────────────────────────────────────
async function handleApi(req, res, url, method) {
    const parts = url.split("/").filter(Boolean);
    if (parts.length === 2 && parts[0] === "api" && parts[1] === "databases") {
        const all = loadAll();
        const summary = Object.entries(all).map(([name, data]) => ({
            name,
            file: DB_FILES.find((f) => f.startsWith(name)),
            count: Object.keys(data).length,
        }));
        return json(res, 200, summary);
    }
    // GET /api/schema — auto-generated schemas for all databases
    if (parts.length === 2 && parts[0] === "api" && parts[1] === "schema") {
        const all = loadAll();
        const schemas = {};
        for (const [name, db] of Object.entries(all)) {
            schemas[name] = generateSchema(db);
        }
        return json(res, 200, schemas);
    }
    if (parts.length === 3 && parts[0] === "api" && parts[1] === "databases") {
        const dbName = parts[2];
        const db = loadDb(dbName);
        if (!db)
            return json(res, 404, { error: `Unknown database: ${dbName}` });
        if (method === "GET") {
            const entries = Object.entries(db).map(([id, entry]) => ({
                id,
                name: entry.name || id,
            }));
            return json(res, 200, { database: dbName, entries });
        }
        if (method === "POST") {
            const body = JSON.parse(await readBody(req));
            if (!body.id)
                return json(res, 400, { error: "id is required" });
            if (db[body.id])
                return json(res, 409, { error: `Entry "${body.id}" already exists` });
            db[body.id] = body;
            saveDb(dbName, db);
            return json(res, 201, { id: body.id });
        }
        return json(res, 405, { error: "Method not allowed" });
    }
    if (parts.length === 4 && parts[0] === "api" && parts[1] === "databases") {
        const dbName = parts[2];
        const entryId = parts[3];
        const db = loadDb(dbName);
        if (!db)
            return json(res, 404, { error: `Unknown database: ${dbName}` });
        if (method === "GET") {
            const entry = db[entryId];
            if (!entry)
                return json(res, 404, { error: `Entry "${entryId}" not found` });
            return json(res, 200, entry);
        }
        if (method === "PUT") {
            const body = JSON.parse(await readBody(req));
            db[entryId] = { ...db[entryId], ...body };
            saveDb(dbName, db);
            return json(res, 200, { id: entryId });
        }
        if (method === "DELETE") {
            if (!db[entryId])
                return json(res, 404, { error: `Entry "${entryId}" not found` });
            delete db[entryId];
            saveDb(dbName, db);
            return json(res, 200, { deleted: entryId });
        }
        return json(res, 405, { error: "Method not allowed" });
    }
    // ── Game API ───────────────────────────────────────────────────────
    if (parts.length >= 3 && parts[0] === "api" && parts[1] === "game") {
        return handleGameApi(req, res, parts, method);
    }
    json(res, 404, { error: "Not found" });
}
// ── Game API ────────────────────────────────────────────────────────
async function handleGameApi(req, res, parts, method) {
    // GET /api/game/profile
    if (parts.length === 3 && parts[2] === "profile" && method === "GET") {
        const profile = (0, player_1.getProfile)();
        return json(res, 200, {
            name: profile.name,
            currency: profile.currency,
            monsterCount: profile.monsterVault.length,
            itemCount: profile.itemVault.length,
            teamCount: profile.teams.length,
            unlockedTeamSlots: profile.unlockedTeamSlots,
            packsOpened: profile.packsOpened,
        });
    }
    // PUT /api/game/profile/name
    if (parts.length === 4 && parts[2] === "profile" && parts[3] === "name" && method === "PUT") {
        const body = JSON.parse(await readBody(req));
        const p = (0, player_1.getProfile)();
        p.name = body.name;
        (0, player_1.saveProfile)(p);
        return json(res, 200, { name: p.name });
    }
    // GET /api/game/packs
    if (parts.length === 3 && parts[2] === "packs" && method === "GET") {
        return json(res, 200, (0, shop_1.getPacks)());
    }
    // POST /api/game/packs/:packId/open
    if (parts.length === 5 && parts[2] === "packs" && parts[4] === "open" && method === "POST") {
        const result = (0, shop_1.openPack)(parts[3]);
        if (!result)
            return json(res, 400, { error: "Cannot open pack. Check currency or pack ID." });
        return json(res, 200, result);
    }
    // GET /api/game/vault
    if (parts.length === 3 && parts[2] === "vault" && method === "GET") {
        const v = (0, shop_1.getVaultContents)();
        const p = (0, player_1.getProfile)();
        return json(res, 200, {
            monsters: v.monsters,
            items: v.items,
            monsterVault: p.monsterVault,
            itemVault: p.itemVault,
        });
    }
    // GET /api/game/teams
    if (parts.length === 3 && parts[2] === "teams" && method === "GET") {
        return json(res, 200, (0, player_1.getTeams)());
    }
    // PUT /api/game/teams/:index
    if (parts.length === 4 && parts[2] === "teams" && method === "PUT") {
        const idx = parseInt(parts[3], 10);
        const body = JSON.parse(await readBody(req));
        const result = (0, player_1.saveTeam)(idx, body);
        const validation = (0, player_1.validateTeam)(body);
        return json(res, 200, { saved: true, validation });
    }
    // POST /api/game/teams/:index/clone
    if (parts.length === 5 && parts[2] === "teams" && parts[4] === "clone" && method === "POST") {
        const idx = parseInt(parts[3], 10);
        const result = (0, player_1.cloneTeam)(idx);
        if (!result)
            return json(res, 400, { error: "Cannot clone team." });
        return json(res, 200, { cloned: true });
    }
    // POST /api/game/teams/:index/clear
    if (parts.length === 5 && parts[2] === "teams" && parts[4] === "clear" && method === "POST") {
        const idx = parseInt(parts[3], 10);
        (0, player_1.clearTeam)(idx);
        return json(res, 200, { cleared: true });
    }
    // POST /api/game/teams/:index/rename
    if (parts.length === 5 && parts[2] === "teams" && parts[4] === "rename" && method === "POST") {
        const idx = parseInt(parts[3], 10);
        const body = JSON.parse(await readBody(req));
        (0, player_1.renameTeam)(idx, body.name);
        return json(res, 200, { renamed: true });
    }
    // GET /api/game/stages
    if (parts.length === 3 && parts[2] === "stages" && method === "GET") {
        return json(res, 200, (0, arena_1.getStages)());
    }
    // POST /api/game/battle/:teamIndex/:stageId
    if (parts.length === 5 && parts[2] === "battle" && method === "POST") {
        const teamIndex = parseInt(parts[3], 10);
        const stageId = parts[4];
        const result = (0, arena_1.runBattle)(teamIndex, stageId);
        return json(res, 200, result);
    }
    json(res, 404, { error: "Game API endpoint not found" });
}
// ── Server ─────────────────────────────────────────────────────────
const MIME_TYPES = {
    ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp",
    ".ico": "image/x-icon", ".json": "application/json",
};
function serveStatic(res, filePath) {
    if (!fs.existsSync(filePath)) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
        return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const isBinary = ext === ".png" || ext === ".jpg" || ext === ".jpeg" || ext === ".gif" || ext === ".webp" || ext === ".ico";
    const content = isBinary ? fs.readFileSync(filePath) : fs.readFileSync(filePath, "utf-8");
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
}
const server = http.createServer(async (req, res) => {
    const url = req.url || "/";
    const method = req.method || "GET";
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (method === "OPTIONS") {
        res.writeHead(204);
        return res.end();
    }
    if (url.startsWith("/api/")) {
        return handleApi(req, res, url, method);
    }
    // Serve static files from public/
    if (url.startsWith("/images/") || url.startsWith("/public/")) {
        const relPath = url.replace(/^\/public\//, "").replace(/^\//, "");
        const filePath = path.join(PUBLIC_DIR, relPath);
        return serveStatic(res, filePath);
    }
    if (url === "/" || url === "/index.html") {
        return serveStatic(res, HTML_PATH);
    }
    if (url === "/game" || url === "/game/" || url === "/game/index.html") {
        return serveStatic(res, GAME_HTML_PATH);
    }
    json(res, 404, { error: "Not found" });
});
server.listen(PORT, () => {
    console.log(`\n  Yu-Gi-Oh! Battler`);
    console.log(`  Database Editor: http://localhost:${PORT}/`);
    console.log(`  Game Hub:        http://localhost:${PORT}/game/\n`);
});
