/**
 * Pure mapping from legacy SQLite `workouts` rows to the new relational model.
 * No I/O here: this is what the dry-run reports and what --apply writes.
 * See migration/MAPPING.md for the rationale behind each rule.
 */

export interface LegacyRow {
  id: unknown;
  exercise: unknown;
  weight: unknown;
  reps: unknown;
  date: unknown;
}

export interface PlannedSet {
  legacyId: number;
  setNumber: number;
  weightKg: string; // fixed 2dp string, safe for Prisma Decimal
  reps: number;
  completedAt: Date;
}
export interface PlannedExercise {
  displayName: string;
  normalizedName: string;
  sets: PlannedSet[];
}
export interface PlannedSession {
  date: string; // YYYY-MM-DD (user-local calendar day)
  name: string;
  startedAt: Date;
  endedAt: Date;
  exercises: PlannedExercise[];
}
export interface Quarantined {
  id: unknown;
  reason: string;
  row: LegacyRow;
}
export interface ImportPlan {
  sessions: PlannedSession[];
  quarantined: Quarantined[];
  stats: { rows: number; imported: number; quarantined: number; sessions: number; exercises: number };
}

const MAX_NAME = 80;

export function normalizeExerciseName(raw: string): { displayName: string; normalizedName: string } {
  const displayName = raw.normalize("NFKC").trim().replace(/\s+/g, " ");
  return { displayName, normalizedName: displayName.toLowerCase() };
}

function isRealDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  if (y < 2000 || y > 2100) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** 12:00 local wall-clock on `date` in IANA timezone `tz`, as a UTC instant. */
export function localNoonToUtc(date: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const offsetAt = (utcMs: number) => {
    const p = Object.fromEntries(fmt.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
    const asUtc = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!);
    return asUtc - utcMs;
  };
  const wall = Date.UTC(y, m - 1, d, 12);
  let utc = wall - offsetAt(wall);
  utc = wall - offsetAt(utc); // re-evaluate once to settle across DST boundaries
  return new Date(utc);
}

type Valid = { id: number; displayName: string; normalizedName: string; weightKg: number; reps: number; date: string };

function validate(row: LegacyRow): { ok: true; v: Valid } | { ok: false; reason: string } {
  const id = row.id;
  if (typeof id !== "number" || !Number.isInteger(id) || id < 1) return { ok: false, reason: "invalid id" };
  if (typeof row.exercise !== "string") return { ok: false, reason: "exercise is not text" };
  const { displayName, normalizedName } = normalizeExerciseName(row.exercise);
  if (!displayName) return { ok: false, reason: "empty exercise name" };
  if (displayName.length > MAX_NAME) return { ok: false, reason: `exercise name longer than ${MAX_NAME} characters` };
  if (/[<>]/.test(displayName)) return { ok: false, reason: "exercise name contains markup characters (<, >)" };
  const w = row.weight;
  if (typeof w !== "number" || !Number.isFinite(w)) return { ok: false, reason: "weight is not a number" };
  if (w < 0 || w > 5000) return { ok: false, reason: "weight outside 0–5000 kg" };
  const r = row.reps;
  if (typeof r !== "number" || !Number.isInteger(r)) return { ok: false, reason: "reps is not a whole number" };
  if (r < 1 || r > 1000) return { ok: false, reason: "reps outside 1–1000" };
  if (typeof row.date !== "string" || !isRealDate(row.date)) return { ok: false, reason: "date is not a valid YYYY-MM-DD" };
  return { ok: true, v: { id, displayName, normalizedName, weightKg: Math.round(w * 100) / 100, reps: r, date: row.date } };
}

/**
 * Rules: one session per calendar day; one session-exercise per distinct exercise
 * (case/whitespace-insensitive, ordered by first appearance); sets numbered by legacy id.
 * Legacy weights are kilograms (the old UI labelled every weight "kg").
 */
export function planImport(rows: LegacyRow[], opts: { timezone: string }): ImportPlan {
  const quarantined: Quarantined[] = [];
  const valid: Valid[] = [];
  for (const row of rows) {
    const res = validate(row);
    if (res.ok) valid.push(res.v);
    else quarantined.push({ id: row.id, reason: res.reason, row });
  }
  valid.sort((a, b) => a.id - b.id);
  quarantined.sort((a, b) =>
    typeof a.id === "number" && typeof b.id === "number" ? a.id - b.id : String(a.id).localeCompare(String(b.id)),
  );

  const byDate = new Map<string, Valid[]>();
  for (const v of valid) byDate.set(v.date, [...(byDate.get(v.date) ?? []), v]);

  const sessions: PlannedSession[] = [];
  for (const date of [...byDate.keys()].sort()) {
    const startedAt = localNoonToUtc(date, opts.timezone);
    const exercises = new Map<string, PlannedExercise>();
    let tick = 0;
    for (const v of byDate.get(date)!) {
      let ex = exercises.get(v.normalizedName);
      if (!ex) {
        ex = { displayName: v.displayName, normalizedName: v.normalizedName, sets: [] };
        exercises.set(v.normalizedName, ex);
      }
      ex.sets.push({
        legacyId: v.id,
        setNumber: ex.sets.length + 1,
        weightKg: v.weightKg.toFixed(2),
        reps: v.reps,
        completedAt: new Date(startedAt.getTime() + tick++ * 60_000),
      });
    }
    sessions.push({
      date,
      name: "Imported workout",
      startedAt,
      endedAt: new Date(startedAt.getTime() + Math.max(tick - 1, 0) * 60_000),
      exercises: [...exercises.values()],
    });
  }
  const exerciseNames = new Set(sessions.flatMap((s) => s.exercises.map((e) => e.normalizedName)));
  return {
    sessions,
    quarantined,
    stats: {
      rows: rows.length,
      imported: valid.length,
      quarantined: quarantined.length,
      sessions: sessions.length,
      exercises: exerciseNames.size,
    },
  };
}
