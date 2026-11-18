# Legacy → PostgreSQL migration mapping

Source: SQLite table `workouts(id INTEGER PK AUTOINCREMENT, exercise TEXT NOT NULL, weight REAL NOT NULL, reps INTEGER NOT NULL, date TEXT NOT NULL)` (`backend/database.js`).
Implementation: `web/src/lib/legacy-import/plan.ts` (pure, unit-tested) + `web/scripts/import-legacy.ts` (CLI).

## Structural mapping

| Legacy | New | Rule |
|---|---|---|
| a calendar day (`date`) | `WorkoutSession` | One session per day per user, `source = LEGACY_IMPORT`, name "Imported workout". Legacy had no session concept; same-day rows are treated as one gym visit. |
| `exercise` (text) | `Exercise` + `SessionExercise` | Name is trimmed, whitespace-collapsed, NFKC-normalised, case-folded for matching. Matched to a global library exercise first, then the user's own; otherwise a **custom** exercise is created (`muscleGroup`/`equipment` = `OTHER`). Order within a day = first appearance by legacy id. |
| one row | `SetLog` | `setNumber` follows legacy id order within the exercise/day. `weightKg = weight`, `reps = reps`. |
| `id` | `SetLog.legacyId` (unique) | Makes re-imports idempotent and keeps traceability to the old row. |
| `date` | `WorkoutSession.startedAt` | **12:00 local time** on that date in the user's timezone (legacy stored no time), stored as UTC. Each set's `completedAt` = start + N minutes (preserves order). `endedAt` = last set. |

## Value rules

- **Units:** legacy UI labelled every weight "kg" (`frontend/script.js`), so weights are imported as kilograms and displayed per user preference (KG/LB) afterwards.
- **Rounding:** weight rounded to 2 decimals (`DECIMAL(7,2)`).
- **Weight 0 is valid** (bodyweight/empty bar). The legacy API rejected it; the new schema allows it.

## Rows that are NOT imported (quarantined and reported with a reason)

The legacy API had no real validation (audit B1–B3), so rows can be bad. A row is quarantined if:
non-integer/missing `id`; `exercise` not text, empty, >80 chars, or containing `<` / `>` (stored-XSS payloads); `weight` not a finite number or outside 0–5000; `reps` not an integer in 1–1000; `date` not a real `YYYY-MM-DD` (2000–2100).
Quarantined rows are never deleted from the source: fix or discard them manually after reading the report.

## Not mapped (nothing to map)

Users, routines, RPE, notes: legacy has none. All imported data is assigned to **one existing user** (`--email`), because the legacy app was single-tenant.

## Known limitation

Day grouping is by the date string only. If you lifted twice in one day it becomes one session. Acceptable for a log with no time-of-day information.
