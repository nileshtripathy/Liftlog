#!/usr/bin/env node
/**
 * Compare a live export with the committed/backup SQLite database.
 *
 *   node migration/scripts/compare.mjs --export migration/exports/live-*.json [--db backend/liftlog.db]
 *
 * Exit code: 0 = identical, 2 = differences found, 1 = error.
 */
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const exportFile = flag("--export");
if (!exportFile) { console.error("--export <file> is required"); process.exit(1); }
const dbPath = resolve(flag("--db", join(root, "backend", "liftlog.db")));

const parsed = JSON.parse(readFileSync(resolve(exportFile), "utf8"));
const live = Array.isArray(parsed) ? parsed : parsed.rows;
const db = new DatabaseSync(dbPath, { readOnly: true });
const local = db.prepare("SELECT id, exercise, weight, reps, date FROM workouts ORDER BY id").all();
db.close();

const L = new Map(live.map((r) => [r.id, r]));
const D = new Map(local.map((r) => [r.id, r]));
const onlyLive = [...L.keys()].filter((id) => !D.has(id));
const onlyDb = [...D.keys()].filter((id) => !L.has(id));
const changed = [...L.keys()].filter((id) => D.has(id)).filter((id) =>
  ["exercise", "weight", "reps", "date"].some((k) => L.get(id)[k] !== D.get(id)[k]));

console.log(`live rows: ${live.length}   sqlite rows: ${local.length}`);
console.log(`only in live: ${onlyLive.length}  only in sqlite: ${onlyDb.length}  changed: ${changed.length}`);
if (onlyLive.length) console.log("  live-only ids:", onlyLive.join(", "));
if (onlyDb.length) console.log("  sqlite-only ids:", onlyDb.join(", "));
for (const id of changed) console.log(`  id ${id}: sqlite=${JSON.stringify(D.get(id))} live=${JSON.stringify(L.get(id))}`);
const identical = !onlyLive.length && !onlyDb.length && !changed.length;
console.log(identical ? "RESULT: identical" : "RESULT: DIFFERENT — import the live export, not the committed DB");
process.exit(identical ? 0 : 2);
