/**
 * Integration tests against a REAL PostgreSQL database.
 * Run with:  TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/liftlog_test npm test
 * Skipped automatically when TEST_DATABASE_URL is unset. Refuses to run unless the
 * database name ends in "_test" because it DROPS and recreates the public schema.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";

const url = process.env.TEST_DATABASE_URL;
const dbName = url ? new URL(url).pathname.replace("/", "") : "";
const enabled = Boolean(url) && dbName.endsWith("_test");

describe.skipIf(!enabled)("database schema (PostgreSQL)", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    const root = join(process.cwd(), "prisma", "migrations");
    const dirs = readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    for (const dir of dirs) await client.query(readFileSync(join(root, dir, "migration.sql"), "utf8"));
    await client.end();
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  let n = 0;
  const makeUser = (extra: Record<string, unknown> = {}) =>
    prisma.user.create({ data: { id: `u${++n}`, name: `User ${n}`, email: `u${n}@example.com`, ...extra } });

  const makeExercise = (userId: string | null, name = "Squat") =>
    prisma.exercise.create({ data: { userId, name, normalizedName: name.toLowerCase() } });

  async function makeSet(userId: string, exerciseId: string, set: Record<string, unknown> = {}) {
    const s = await prisma.workoutSession.create({ data: { userId, name: "W", startedAt: new Date("2026-01-01T10:00:00Z") } });
    const se = await prisma.sessionExercise.create({ data: { sessionId: s.id, exerciseId, position: 0 } });
    return prisma.setLog.create({
      data: { sessionExerciseId: se.id, setNumber: 1, weightKg: 100, reps: 5, completedAt: new Date(), ...set },
    });
  }

  it("applies defaults for user preferences", async () => {
    const u = await makeUser();
    expect(u.weightUnit).toBe("KG");
    expect(u.timezone).toBe("UTC");
    expect(u.goalDaysPerWeek).toBe(4);
  });

  it("rejects out-of-range goalDaysPerWeek", async () => {
    await expect(makeUser({ goalDaysPerWeek: 0 })).rejects.toThrow(/goalDaysPerWeek_range/);
    await expect(makeUser({ goalDaysPerWeek: 8 })).rejects.toThrow(/goalDaysPerWeek_range/);
  });

  describe("set log integrity (fixes legacy validation gaps)", () => {
    it("allows weight 0 (bodyweight) — the legacy API rejected it", async () => {
      const u = await makeUser();
      const ex = await makeExercise(u.id, "Pull-up");
      const set = await makeSet(u.id, ex.id, { weightKg: 0, reps: 8 });
      expect(set.weightKg.toString()).toBe("0");
    });

    it("rejects negative weight, zero/oversized reps, and absurd weight", async () => {
      const u = await makeUser();
      const ex = await makeExercise(u.id, "Bench");
      await expect(makeSet(u.id, ex.id, { weightKg: -50 })).rejects.toThrow(/weightKg_range/);
      await expect(makeSet(u.id, ex.id, { reps: 0 })).rejects.toThrow(/reps_range/);
      await expect(makeSet(u.id, ex.id, { reps: 1001 })).rejects.toThrow(/reps_range/);
      await expect(makeSet(u.id, ex.id, { weightKg: 99999 })).rejects.toThrow(/weightKg_range/);
      await expect(makeSet(u.id, ex.id, { rpe: 11 })).rejects.toThrow(/rpe_range/);
    });

    it("round-trips decimal weights without float error", async () => {
      const u = await makeUser();
      const ex = await makeExercise(u.id, "Deadlift");
      const set = await makeSet(u.id, ex.id, { weightKg: "102.50" });
      expect(set.weightKg.toString()).toBe("102.5");
    });

    it("enforces unique set numbers per exercise and idempotent legacy ids", async () => {
      const u = await makeUser();
      const ex = await makeExercise(u.id, "Row");
      const first = await makeSet(u.id, ex.id, { legacyId: 777 });
      await expect(
        prisma.setLog.create({
          data: { sessionExerciseId: first.sessionExerciseId, setNumber: 1, weightKg: 1, reps: 1, completedAt: new Date() },
        }),
      ).rejects.toThrow();
      await expect(makeSet(u.id, ex.id, { legacyId: 777 })).rejects.toThrow(/legacyId/);
    });
  });

  it("rejects a session that ends before it starts", async () => {
    const u = await makeUser();
    await expect(
      prisma.workoutSession.create({
        data: { userId: u.id, name: "Bad", startedAt: new Date("2026-01-02"), endedAt: new Date("2026-01-01") },
      }),
    ).rejects.toThrow(/end_after_start/);
  });

  describe("exercise uniqueness", () => {
    it("allows one global exercise per normalized name", async () => {
      await makeExercise(null, "Overhead Press");
      await expect(makeExercise(null, "Overhead Press")).rejects.toThrow();
    });
    it("allows different users to own the same custom name, but not duplicates within a user", async () => {
      const a = await makeUser();
      const b = await makeUser();
      await makeExercise(a.id, "Zercher Squat");
      await makeExercise(b.id, "Zercher Squat");
      await expect(makeExercise(a.id, "Zercher Squat")).rejects.toThrow();
    });
    it("lets a user's custom exercise shadow a global name", async () => {
      const u = await makeUser();
      await makeExercise(null, "Global Curl");
      await expect(makeExercise(u.id, "Global Curl")).resolves.toBeTruthy();
    });
  });

  describe("user-level data isolation & lifecycle", () => {
    it("scoped queries never return another user's data", async () => {
      const a = await makeUser();
      const b = await makeUser();
      const ex = await makeExercise(a.id, "A-only");
      const s = await prisma.workoutSession.create({ data: { userId: a.id, name: "Mine", startedAt: new Date() } });
      expect(await prisma.workoutSession.findFirst({ where: { id: s.id, userId: b.id } })).toBeNull();
      expect(await prisma.workoutSession.count({ where: { userId: b.id } })).toBe(0);
      expect(await prisma.workoutSession.findFirst({ where: { id: s.id, userId: a.id } })).not.toBeNull();
      expect(ex.userId).toBe(a.id);
    });

    it("cascades user deletion through sessions to sets", async () => {
      const u = await makeUser();
      const ex = await makeExercise(u.id, "Cascade Lift");
      const set = await makeSet(u.id, ex.id);
      await prisma.user.delete({ where: { id: u.id } });
      expect(await prisma.setLog.findUnique({ where: { id: set.id } })).toBeNull();
      expect(await prisma.workoutSession.count({ where: { userId: u.id } })).toBe(0);
    });

    it("blocks deleting an exercise that has logged history (NO ACTION)", async () => {
      const u = await makeUser();
      const ex = await makeExercise(null, "Protected Lift");
      await makeSet(u.id, ex.id);
      await expect(prisma.exercise.delete({ where: { id: ex.id } })).rejects.toThrow();
    });
  });
});
