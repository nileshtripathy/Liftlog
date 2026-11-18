import { describe, expect, it } from "vitest";
import { localNoonToUtc, normalizeExerciseName, planImport } from "@/lib/legacy-import/plan";

const row = (id: number, exercise: unknown, weight: unknown, reps: unknown, date: unknown) => ({ id, exercise, weight, reps, date });

describe("localNoonToUtc", () => {
  it("converts local noon for positive, negative and half-hour offsets", () => {
    expect(localNoonToUtc("2026-11-18", "Asia/Kolkata").toISOString()).toBe("2026-11-18T06:30:00.000Z");
    expect(localNoonToUtc("2026-11-18", "America/Los_Angeles").toISOString()).toBe("2026-11-18T20:00:00.000Z");
    expect(localNoonToUtc("2026-07-01", "America/Los_Angeles").toISOString()).toBe("2026-07-01T19:00:00.000Z"); // DST
    expect(localNoonToUtc("2026-07-01", "UTC").toISOString()).toBe("2026-07-01T12:00:00.000Z");
  });
  it("keeps the intended calendar day in the user's timezone", () => {
    const d = localNoonToUtc("2026-11-18", "Asia/Kolkata");
    expect(d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })).toBe("2026-11-18");
  });
});

describe("normalizeExerciseName", () => {
  it("trims, collapses whitespace and case-folds for matching", () => {
    expect(normalizeExerciseName("  Bench   Press ")).toEqual({ displayName: "Bench Press", normalizedName: "bench press" });
  });
});

describe("planImport", () => {
  const rows = [
    row(1, "Bench Press", 60, 8, "2026-11-10"),
    row(2, "  bench press ", 62.5, 6, "2026-11-10"),
    row(3, "Squat", 100, 5, "2026-11-10"),
    row(4, "Pull-up", 0, 8, "2026-11-12"), // bodyweight is valid
    row(5, "X", "abc", 5, "2026-11-12"),
    row(6, "X", -50, 5, "2026-11-12"),
    row(7, "X", 50, 0, "2026-11-12"),
    row(8, "X", 50, 5, "not-a-date"),
    row(9, "X", 50, 5, "2026-02-31"),
    row(10, "<img src=x onerror=alert(1)>", 50, 5, "2026-11-12"),
    row(11, { a: 1 }, 50, 5, "2026-11-12"),
    row(12, "Deadlift", 99999999, 5, "2026-11-12"),
    row(13, "Row", 40.456, 10, "2026-11-12"),
  ];
  const plan = planImport(rows, { timezone: "Asia/Kolkata" });

  it("groups by day, merges exercise name variants, numbers sets by legacy id", () => {
    expect(plan.sessions.map((s) => s.date)).toEqual(["2026-11-10", "2026-11-12"]);
    const day1 = plan.sessions[0]!;
    expect(day1.exercises.map((e) => e.displayName)).toEqual(["Bench Press", "Squat"]);
    expect(day1.exercises[0]!.sets.map((s) => [s.legacyId, s.setNumber, s.weightKg, s.reps])).toEqual([
      [1, 1, "60.00", 8],
      [2, 2, "62.50", 6],
    ]);
  });
  it("accepts weight 0 and rounds to 2dp", () => {
    const day2 = plan.sessions[1]!;
    expect(day2.exercises.find((e) => e.normalizedName === "pull-up")!.sets[0]!.weightKg).toBe("0.00");
    expect(day2.exercises.find((e) => e.normalizedName === "row")!.sets[0]!.weightKg).toBe("40.46");
  });
  it("quarantines every invalid legacy row with a reason, never importing it", () => {
    expect(plan.quarantined.map((q) => q.id)).toEqual([5, 6, 7, 8, 9, 10, 11, 12]);
    expect(plan.quarantined.every((q) => q.reason.length > 0)).toBe(true);
    expect(plan.stats).toMatchObject({ rows: 13, imported: 5, quarantined: 8, sessions: 2, exercises: 4 });
  });
  it("every session ends at or after it starts", () => {
    for (const s of plan.sessions) expect(s.endedAt.getTime()).toBeGreaterThanOrEqual(s.startedAt.getTime());
  });
  it("is deterministic regardless of input order", () => {
    expect(planImport([...rows].reverse(), { timezone: "Asia/Kolkata" })).toEqual(plan);
  });
});
