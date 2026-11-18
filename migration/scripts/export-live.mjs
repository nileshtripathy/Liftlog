#!/usr/bin/env node
/**
 * Export live legacy data from the Render API (read-only GET /workouts).
 *
 *   node migration/scripts/export-live.mjs [--url https://liftlog-30a3.onrender.com]
 *
 * Render free instances sleep; the first request can take 30-60s, so this
 * retries with backoff. Output: migration/exports/live-<timestamp>.json
 * (git-ignored). Run it from YOUR machine: it needs network access to Render.
 */
import { createHash } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const args = process.argv.slice(2);
const i = args.indexOf("--url");
const base = (i >= 0 ? args[i + 1] : process.env.LEGACY_API_URL ?? "https://liftlog-30a3.onrender.com").replace(/\/$/, "");
const outDir = join(root, "migration", "exports");
mkdirSync(outDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, attempts = 6) {
  let lastErr;
  for (let n = 1; n <= attempts; n++) {
    try {
      console.log(`GET ${url}  (attempt ${n}/${attempts})`);
      const res = await fetch(url, { signal: AbortSignal.timeout(90_000), headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      console.warn(`  failed: ${err.message}`);
      await sleep(Math.min(5000 * n, 20_000));
    }
  }
  throw lastErr;
}

const rows = await fetchWithRetry(`${base}/workouts`);
if (!Array.isArray(rows)) {
  console.error("Unexpected response: expected a JSON array");
  process.exit(1);
}
rows.sort((a, b) => a.id - b.id);
const payload = {
  meta: {
    source: `${base}/workouts`,
    fetchedAt: new Date().toISOString(),
    count: rows.length,
    rowsSha256: createHash("sha256").update(JSON.stringify(rows)).digest("hex"),
  },
  rows,
};
const file = join(outDir, `live-${payload.meta.fetchedAt.replace(/[:.]/g, "-")}.json`);
writeFileSync(file, JSON.stringify(payload, null, 2));
console.log(`OK  rows=${rows.length}`);
console.log(`export: ${file}`);
