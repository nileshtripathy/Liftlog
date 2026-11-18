# Migration runbook (legacy Express/SQLite → Next.js/PostgreSQL)

The original app (`backend/`, `frontend/`) is **not modified** by any of this. Everything here is read-only against it.

## Step 0: back up and export (do this first, on your machine)

```bash
# 1. Verified backup of the committed SQLite DB (integrity check + row count + sha256 → backups/MANIFEST.txt)
node migration/scripts/backup-sqlite.mjs

# 2. Export what is actually LIVE on Render (read-only GET /workouts; retries through Render cold starts)
node migration/scripts/export-live.mjs            # or: --url https://your-service.onrender.com

# 3. Does live differ from the committed DB?  exit 0 = identical, 2 = different
node migration/scripts/compare.mjs --export migration/exports/live-<timestamp>.json
```

If step 3 reports differences, **import the live export, not the committed DB**: the committed file is just a snapshot and Render's disk is ephemeral. Exports and `.db` backups are git-ignored (personal data); keep them somewhere safe.
Requires Node ≥ 22.13 (built-in `node:sqlite`); no npm install needed for these scripts.

## Step 1: register in the new app, then dry-run

```bash
cd web
npm run import:legacy -- --file ../migration/exports/live-<ts>.json --timezone Asia/Kolkata   # DRY RUN: no DB access
```

Read the report: counts, sessions, and every quarantined row with its reason (see MAPPING.md).

## Step 2: apply

```bash
npm run import:legacy -- --file ../migration/exports/live-<ts>.json --email you@example.com --apply
```

Single transaction (all or nothing), idempotent (safe to re-run), uses the user's saved timezone unless `--timezone` is given. Reads `DIRECT_URL`/`DATABASE_URL` from `web/.env`.

## Rollback / safety

- The old app and its data are untouched; rolling back = not cutting over.
- To undo an import: delete rows with `source = 'LEGACY_IMPORT'` for that user (cascades to exercises-in-session and sets); custom exercises created by the import can be removed afterwards.
- Do not retire Netlify/Render until the new app is verified with your imported data.
