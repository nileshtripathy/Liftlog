#!/usr/bin/env node
/**
 * Consistent, verified backup of the legacy SQLite database.
 *
 *   node migration/scripts/backup-sqlite.mjs [--db backend/liftlog.db]
 *
 * - Opens the source READ-ONLY (never modifies it).
 * - Runs PRAGMA integrity_check and counts rows.
 * - Writes a consistent copy with VACUUM INTO (safe even if the DB is in use).
 * - Appends "<sha256>  <file>  rows=<n>  <timestamp>" to backups/MANIFEST.txt.
 * Requires Node >= 22.13 (built-in node:sqlite). No dependencies.
 */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { readFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};

const source = resolve(flag("--db", join(root, "backend", "liftlog.db")));
const backupDir = resolve(flag("--out", join(root, "migration", "backups")));
if (!existsSync(source)) {
  console.error(`Source database not found: ${source}`);
  process.exit(1);
}
mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dest = join(backupDir, `liftlog-${stamp}.db`);

const db = new DatabaseSync(source, { readOnly: true });
const integrity = db.prepare("PRAGMA integrity_check").get();
const ok = Object.values(integrity)[0] === "ok";
if (!ok) {
  console.error("integrity_check FAILED:", integrity);
  process.exit(1);
}
const rows = db.prepare("SELECT COUNT(*) AS n FROM workouts").get().n;
db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
db.close();

// Verify the copy independently.
const copy = new DatabaseSync(dest, { readOnly: true });
const copyRows = copy.prepare("SELECT COUNT(*) AS n FROM workouts").get().n;
copy.close();
if (copyRows !== rows) {
  console.error(`Backup row count mismatch: source=${rows} copy=${copyRows}`);
  process.exit(1);
}

const sha = createHash("sha256").update(readFileSync(dest)).digest("hex");
const srcSha = createHash("sha256").update(readFileSync(source)).digest("hex");
appendFileSync(
  join(backupDir, "MANIFEST.txt"),
  `${sha}  ${dest.split("/").pop()}  rows=${rows}  source_sha256=${srcSha}  created=${new Date().toISOString()}\n`,
);
console.log(`OK  integrity_check=ok  rows=${rows}`);
console.log(`backup: ${dest}`);
console.log(`sha256: ${sha}`);
